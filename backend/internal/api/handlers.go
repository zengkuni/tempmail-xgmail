package api

import (
	"context"
	"crypto/rand"
	"errors"
	"log"
	"regexp"
	"strconv"
	"strings"
	"time"

	"tempmail/internal/config"
	"tempmail/internal/db"
	"tempmail/internal/otp"
	"tempmail/internal/realtime"

	"github.com/bolone-sengkuni/fakerindo"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type handlers struct {
	cfg *config.Config
	m   *db.PG
	rdb *redis.Client
	hub *realtime.Hub
}

func (h *handlers) Health(c *gin.Context) {
	c.JSON(200, gin.H{"status": "ok"})
}

// --- generate-email -------------------------------------------------------

var prefixAllowed = regexp.MustCompile(`[^a-z0-9._-]+`)

type generateBody struct {
	Prefix string `json:"prefix"`
	Domain string `json:"domain"`
}

func (h *handlers) GenerateEmail(c *gin.Context) {
	var body generateBody
	if c.Request.Method == "POST" && c.Request.Body != nil {
		_ = c.ShouldBindJSON(&body) // empty/invalid body behaves like no body
	}

	ctx := c.Request.Context()

	// Domain: explicit → must exist+active; else random active.
	domain := strings.ToLower(strings.TrimSpace(body.Domain))
	if domain != "" {
		if !h.m.DomainActive(ctx, domain) {
			fail(c, 400, "domain not supported")
			return
		}
	} else {
		var err error
		domain, err = h.randomActiveDomain(ctx)
		if err != nil {
			fail(c, 500, "no active domain available")
			return
		}
	}

	// Prefix: sanitize to [a-z0-9._-] (max 30); empty → fakerindo username.
	// Identity full name always comes from the same fakerindo draw.
	identity := fakerindo.Random()
	username := prefixAllowed.ReplaceAllString(strings.ToLower(body.Prefix), "")
	if len(username) > 30 {
		username = username[:30]
	}
	if username == "" {
		username = identity.Username
	}
	address := username + "@" + domain

	// Upsert inbox: existing address keeps original createdAt, refreshes expiry.
	now := time.Now().UTC()
	expires := now.Add(h.cfg.MaxInboxExpiration)
	inbox, err := h.m.UpsertInbox(ctx, address, username, domain, expires)
	if err != nil {
		fail(c, 500, "failed to create inbox")
		return
	}
	h.m.BumpDomainUsage(ctx, domain)

	ok(c, gin.H{"email": address, "full_name": identity.FullName, "created_at": iso(inbox.CreatedAt)})
}

func (h *handlers) randomActiveDomain(ctx context.Context) (string, error) {
	names, err := h.m.ListActiveDomainNames(ctx)
	if err != nil {
		return "", err
	}
	if len(names) == 0 {
		return "", errNoActiveDomains
	}
	return names[randInt(len(names))], nil
}

var errNoActiveDomains = errors.New("no active domains")

func randInt(n int) int {
	b := []byte{0}
	rand.Read(b)
	return int(b[0]) % n
}

// --- emails ---------------------------------------------------------------

func (h *handlers) ListEmails(c *gin.Context) {
	email := strings.ToLower(strings.TrimSpace(c.Query("email")))
	if email == "" {
		fail(c, 400, "email query parameter required")
		return
	}
	ctx := c.Request.Context()
	items, err := h.m.ListEmailsByInbox(ctx, email)
	if err != nil {
		fail(c, 500, "failed to list emails")
		return
	}

	emails := []gin.H{}
	for _, item := range items {
		emails = append(emails, gin.H{
			"id":          item.ID,
			"from":        item.SenderAddress,
			"subject":     item.Subject,
			"received_at": iso(item.CreatedAt),
			"code":        otp.Code(item.Subject, item.BodyText, item.BodyHTML),
		})
	}
	ok(c, gin.H{"email": email, "count": len(emails), "emails": emails})
}

func (h *handlers) GetEmail(c *gin.Context) {
	id := c.Param("id")
	ctx := c.Request.Context()
	e, err := h.m.GetEmail(ctx, id)
	if err != nil {
		fail(c, 404, "email not found")
		return
	}
	if !e.IsRead {
		if inbox, changed, err := h.m.MarkEmailRead(ctx, id); err == nil && changed {
			h.m.DecrementUnread(ctx, inbox)
		}
		e.IsRead = true
	}
	ok(c, gin.H{
		"id":          e.ID,
		"from":        e.Sender.Address,
		"to":          e.InboxAddress,
		"subject":     e.Subject,
		"code":        otp.Code(e.Subject, e.BodyText, e.BodyHTML),
		"received_at": iso(e.CreatedAt),
		"text":        e.BodyText,
		"html":        e.BodyHTML,
		"headers":     e.Headers,
	})
}

func (h *handlers) DeleteEmail(c *gin.Context) {
	id := c.Param("id")
	deleted, err := h.m.DeleteEmail(c.Request.Context(), id)
	if err != nil || !deleted {
		fail(c, 404, "email not found")
		return
	}
	ok(c, gin.H{"deleted": true, "id": id})
}

func (h *handlers) ClearEmails(c *gin.Context) {
	email := strings.ToLower(strings.TrimSpace(c.Query("email")))
	if email == "" {
		fail(c, 400, "email query parameter required")
		return
	}
	n, err := h.m.ClearEmails(c.Request.Context(), email)
	if err != nil {
		fail(c, 500, "failed to clear emails")
		return
	}
	ok(c, gin.H{"cleared": true, "email": email, "deleted_count": n})
}

// --- stats ----------------------------------------------------------------

func (h *handlers) Stats(c *gin.Context) {
	s, err := h.m.GetStats(c.Request.Context())
	if err != nil {
		fail(c, 500, "failed to load stats")
		return
	}
	ok(c, gin.H{
		"total_emails":    s.TotalEmails,
		"total_inboxes":   s.TotalInboxes,
		"active_domains":  s.ActiveDomains,
		"emails_24h":      s.Emails24h,
		"unique_subjects": s.UniqueSubjects,
	})
}

func (h *handlers) Statistics24h(c *gin.Context) {
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if offset < 0 {
		offset = 0
	}
	end := time.Now().UTC().Add(-time.Duration(offset) * 24 * time.Hour)
	start := end.Add(-24 * time.Hour)

	counts := map[time.Time]int64{}
	if m, err := h.m.HourlyCounts(c.Request.Context(), start, end); err != nil {
		log.Printf("statistics: hourly counts: %v", err)
	} else {
		counts = m
	}

	// Zero-fill exactly 24 hourly buckets, oldest → newest.
	hours := make([]gin.H, 0, 24)
	bucket := start.Truncate(time.Hour).UTC()
	for range 24 {
		hours = append(hours, gin.H{"hour": iso(bucket), "count": counts[bucket]})
		bucket = bucket.Add(time.Hour)
	}
	ok(c, gin.H{
		"offset":       offset,
		"window_start": iso(start),
		"window_end":   iso(end),
		"hours":        hours,
	})
}

func (h *handlers) TopSubjects(c *gin.Context) {
	h.topN(c, h.m.TopSubjects, maskMiddle)
}

func (h *handlers) TopDomains(c *gin.Context) {
	h.topN(c, h.m.TopDomains, maskDomain)
}

func (h *handlers) TopSenders(c *gin.Context) {
	h.topN(c, h.m.TopSenders, maskSender)
}

// topN runs a leaderboard query; values are masked before responding.
type topNQuery func(ctx context.Context) ([]db.TopNItem, error)

func (h *handlers) topN(c *gin.Context, q topNQuery, mask func(string) string) {
	items := []gin.H{}
	if rows, err := q(c.Request.Context()); err == nil {
		for _, row := range rows {
			items = append(items, gin.H{"value": mask(row.Value), "count": row.Count})
		}
	}
	ok(c, gin.H{"items": items})
}

// ── Privacy masking untuk leaderboard publik ──
// Gaya: prefix pendek dipertahankan, sisanya ditutup `*`.

const (
	maskMinPrefix = 3
	maskMinStars  = 4
)

// maskMiddle mempertahankan ~35% awal string (min maskMinPrefix), sisanya `*`.
func maskMiddle(s string) string {
	r := []rune(s)
	if len(r) == 0 {
		return s
	}
	keep := len(r) * 35 / 100
	if keep < maskMinPrefix {
		keep = maskMinPrefix
	}
	if keep > len(r) {
		keep = len(r)
	}
	stars := len(r) - keep
	if stars < maskMinStars {
		stars = maskMinStars
	}
	return string(r[:keep]) + strings.Repeat("*", stars)
}

// maskSender hanya menampilkan local part; domain disembunyikan.
func maskSender(address string) string {
	local, _, _ := strings.Cut(address, "@")
	return maskMiddle(local)
}

// maskDomain mempertahankan label pertama: "xgmail.bond" -> "xgmail.***".
func maskDomain(domain string) string {
	label, _, found := strings.Cut(domain, ".")
	if !found {
		return maskMiddle(domain)
	}
	return label + ".***"
}
