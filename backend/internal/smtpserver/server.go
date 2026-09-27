// Package smtpserver is the MX intake listener (emersion/go-smtp).
package smtpserver

import (
	"context"
	"io"
	"log"
	"strings"
	"time"

	"tempmail/internal/config"
	"tempmail/internal/db"
	"tempmail/internal/realtime"

	"github.com/emersion/go-smtp"
)

// Start runs the SMTP server (blocking); call in a goroutine.
// hub may be nil (realtime disabled).
func Start(cfg *config.Config, m *db.PG, hub *realtime.Hub) error {
	s := smtp.NewServer(&backend{cfg: cfg, m: m, hub: hub})
	s.Addr = ":" + cfg.SMTPPort
	s.Domain = cfg.SMTPGreeting
	s.MaxMessageBytes = 10 << 20
	s.MaxRecipients = 5
	s.AllowInsecureAuth = false
	log.Printf("SMTP listening :%s", cfg.SMTPPort)
	return s.ListenAndServe()
}

type backend struct {
	cfg *config.Config
	m   *db.PG
	hub *realtime.Hub
}

func (b *backend) NewSession(c *smtp.Conn) (smtp.Session, error) {
	return &session{cfg: b.cfg, m: b.m, hub: b.hub}, nil
}

type session struct {
	cfg  *config.Config
	m    *db.PG
	hub  *realtime.Hub
	from string
}

func (s *session) Mail(from string, opts *smtp.MailOptions) error {
	s.from = from
	return nil
}

func (s *session) Rcpt(to string, opts *smtp.RcptOptions) error {
	if s.cfg.AppEnv != "production" {
		return nil // dev convenience: accept any recipient
	}
	domain := ""
	if i := strings.LastIndex(to, "@"); i >= 0 {
		domain = strings.ToLower(to[i+1:])
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if !s.m.DomainActive(ctx, domain) {
		return &smtp.SMTPError{Code: 550, EnhancedCode: smtp.EnhancedCode{5, 7, 1}, Message: "Domain not served by this MX cluster"}
	}
	// Only accept mail for claimed inboxes (addresses generated via the UI or
	// API). Guessed/dictionary addresses get a hard 550 so spam never reaches
	// the database.
	addr := strings.ToLower(strings.TrimSpace(to))
	if !s.m.InboxExists(ctx, addr) {
		return &smtp.SMTPError{Code: 550, EnhancedCode: smtp.EnhancedCode{5, 1, 1}, Message: "No such user here"}
	}
	return nil
}

func (s *session) Data(r io.Reader) error {
	raw, err := io.ReadAll(r)
	if err != nil {
		return smtpErr451
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	id, err := Save(ctx, s.m, s.cfg, s.hub, raw)
	if err != nil {
		log.Printf("smtp: parse/store failed: %v", err)
		return smtpErr451
	}
	log.Printf("smtp: stored message %s (%d bytes)", id, len(raw))
	return nil
}

func (s *session) Reset() {}

func (s *session) Logout() error { return nil }

var smtpErr451 = &smtp.SMTPError{Code: 451, EnhancedCode: smtp.EnhancedCode{4, 3, 0}, Message: "Local error in processing mail"}
