package smtpserver

import (
	"bytes"
	"context"
	"html"
	netmail "net/mail"
	"strings"
	"time"

	"tempmail/internal/config"
	"tempmail/internal/db"
	"tempmail/internal/models"
	"tempmail/internal/realtime"

	"github.com/jhillyerd/enmime"
	"github.com/microcosm-cc/bluemonday"
	"github.com/oklog/ulid/v2"
)

var policy = bluemonday.UGCPolicy()

// isoTime matches the REST envelope timestamp format.
func isoTime(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05.000Z") }

// Save parses a raw RFC822 message and stores it per docs/backend/smtp-intake.md.
// Returns the ULID of the stored email.
func Save(ctx context.Context, m *db.PG, cfg *config.Config, hub *realtime.Hub, raw []byte) (string, error) {
	env, err := enmime.ReadEnvelope(bytes.NewReader(raw))
	if err != nil {
		return "", err
	}

	// 1. Recipients: first To address (lowercased) is the inbox.
	recipients := parseAddressList(env.GetHeader("To"))
	inbox := ""
	if len(recipients) > 0 {
		inbox = strings.ToLower(recipients[0].Address)
	}

	// 2. Sender.
	sender := models.Address{Address: "unknown@sender.com", Name: ""}
	if from := parseAddressList(env.GetHeader("From")); len(from) > 0 {
		sender = from[0]
	}

	// 3. Subject + bodies; html falls back to <pre>escaped text</pre>.
	subject := env.GetHeader("Subject")
	if subject == "" {
		subject = "(No Subject)"
	}
	text := env.Text
	body := env.HTML
	if body == "" && text != "" {
		body = "<pre>" + html.EscapeString(text) + "</pre>"
	}
	if body != "" {
		body = policy.Sanitize(body)
	}

	// 4. Header map (lowercase keys, first value wins) + raw header block.
	headers := map[string]string{}
	for k, v := range env.Root.Header {
		lk := strings.ToLower(k)
		if _, ok := headers[lk]; !ok && len(v) > 0 {
			headers[lk] = v[0]
		}
	}
	rawHeaders := string(raw)
	if i := bytes.Index(raw, []byte("\r\n\r\n")); i >= 0 {
		rawHeaders = string(raw[:i])
	}

	// 5. Attachments: metadata only, binary discarded.
	atts := make([]models.AttachmentMeta, 0, len(env.Attachments))
	for _, a := range env.Attachments {
		atts = append(atts, models.AttachmentMeta{
			Filename:    a.FileName,
			ContentType: a.ContentType,
			Size:        len(a.Content),
			ContentID:   a.ContentID,
		})
	}

	// 6. Expiry: mirror inbox expiry when known, else now+TEMPMAIL_MAX_INBOX_EXPIRATION.
	now := time.Now().UTC()
	expires := now.Add(cfg.MaxInboxExpiration)
	inboxExists := false
	if inbox != "" {
		if ib, err := m.GetInbox(ctx, inbox); err == nil {
			expires = ib.ExpiresAt
			inboxExists = true
		}
	}

	// 7. Insert email (ULID id), bump inbox counters + domain usage (atomic).
	id := ulid.Make().String()
	doc := models.Email{
		ID:           id,
		InboxAddress: inbox,
		Sender:       sender,
		Recipients:   recipients,
		Subject:      subject,
		BodyText:     text,
		BodyHTML:     body,
		RawHeaders:   rawHeaders,
		Headers:      headers,
		Attachments:  atts,
		MessageID:    env.GetHeader("Message-Id"),
		Size:         len(raw),
		IsRead:       false,
		ExpiresAt:    expires,
		CreatedAt:    now,
	}
	if err := m.SaveEmailTx(ctx, &doc, inboxExists); err != nil {
		return "", err
	}
	if hub != nil {
		from := sender.Address
		if sender.Name != "" {
			from = sender.Name + " <" + sender.Address + ">"
		}
		hub.EmitNew(inbox, realtime.EmailPayload{
			ID:         id,
			From:       from,
			Subject:    subject,
			ReceivedAt: isoTime(now),
		})
	}
	return id, nil
}

func parseAddressList(header string) []models.Address {
	if header == "" {
		return nil
	}
	list, err := netmail.ParseAddressList(header)
	if err != nil {
		return nil
	}
	out := make([]models.Address, 0, len(list))
	for _, a := range list {
		out = append(out, models.Address{Address: a.Address, Name: a.Name})
	}
	return out
}
