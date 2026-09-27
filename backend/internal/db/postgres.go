package db

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"tempmail/internal/config"
	"tempmail/internal/models"

	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver
	"github.com/jmoiron/sqlx"
	ulidlib "github.com/oklog/ulid/v2"
)

// PG bundles the connection pool with all SQL for the service tables.
// Tables mirror the previous MongoDB collections; JSONB columns carry the
// nested values (sender, recipients, headers, attachments).
//
// NOTE: PostgreSQL has no TTL index. Expiry enforcement moved fully to the
// hourly asynq cleanup:purge job (queue.cleanupPurge).
type PG struct {
	DB *sqlx.DB
}

// ConnectPostgres connects (5s ping timeout) and returns the pool.
func ConnectPostgres(dsn string) (*PG, error) {
	db, err := sqlx.Connect("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("postgres connect: %w", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("postgres ping: %w", err)
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)
	return &PG{DB: db}, nil
}

// Close releases the pool.
func (p *PG) Close() error { return p.DB.Close() }

// EnsureSchema creates tables and indexes idempotently.
func (p *PG) EnsureSchema(ctx context.Context) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS inboxes (
			address        TEXT PRIMARY KEY,
			username       TEXT NOT NULL,
			domain         TEXT NOT NULL,
			total_received INTEGER NOT NULL DEFAULT 0,
			unread_count   INTEGER NOT NULL DEFAULT 0,
			expires_at     TIMESTAMPTZ NOT NULL,
			created_at     TIMESTAMPTZ NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS inboxes_expires_at_idx ON inboxes (expires_at)`,
		`CREATE TABLE IF NOT EXISTS emails (
			id            TEXT PRIMARY KEY,
			inbox_address TEXT NOT NULL,
			sender        JSONB NOT NULL,
			recipients    JSONB NOT NULL,
			subject       TEXT NOT NULL,
			body_text      TEXT NOT NULL DEFAULT '',
			body_html      TEXT NOT NULL DEFAULT '',
			raw_headers    TEXT NOT NULL DEFAULT '',
			headers        JSONB NOT NULL,
			attachments    JSONB NOT NULL,
			message_id    TEXT NOT NULL DEFAULT '',
			size          INTEGER NOT NULL DEFAULT 0,
			is_read       BOOLEAN NOT NULL DEFAULT FALSE,
			expires_at    TIMESTAMPTZ NOT NULL,
			created_at    TIMESTAMPTZ NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS emails_inbox_created_idx ON emails (inbox_address, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS emails_expires_at_idx ON emails (expires_at)`,
		`CREATE TABLE IF NOT EXISTS domains (
			id                  TEXT PRIMARY KEY,
			name                TEXT NOT NULL UNIQUE,
			is_default          BOOLEAN NOT NULL DEFAULT FALSE,
			is_active           BOOLEAN NOT NULL DEFAULT FALSE,
			mx_verified         BOOLEAN NOT NULL DEFAULT FALSE,
			mx_invalid_since    TIMESTAMPTZ,
			mx_verified_at      TIMESTAMPTZ,
			registry_status     TEXT[],
			registry_expires_at TIMESTAMPTZ,
			usage_count         INTEGER NOT NULL DEFAULT 0,
			created_at          TIMESTAMPTZ NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS apikeys (
			id           TEXT PRIMARY KEY,
			name         TEXT NOT NULL,
			key          TEXT NOT NULL UNIQUE,
			prefix       TEXT NOT NULL,
			rate_limit   INTEGER NOT NULL DEFAULT 100,
			usage_count  INTEGER NOT NULL DEFAULT 0,
			last_used_at TIMESTAMPTZ,
			is_active    BOOLEAN NOT NULL DEFAULT TRUE,
			created_at   TIMESTAMPTZ NOT NULL
		)`,
	}
	for _, s := range stmts {
		if _, err := p.DB.ExecContext(ctx, s); err != nil {
			return fmt.Errorf("schema: %w", err)
		}
	}
	return nil
}

// Seed upserts the default domain (sole active default) and the public API key.
func (p *PG) Seed(ctx context.Context, cfg *config.Config) error {
	now := time.Now().UTC()

	// Only the configured default domain stays default+active.
	if _, err := p.DB.ExecContext(ctx,
		`UPDATE domains SET is_default = FALSE WHERE name <> $1 AND is_default = TRUE`,
		cfg.DefaultDomain); err != nil {
		return fmt.Errorf("seed domains deactivate: %w", err)
	}
	if _, err := p.DB.ExecContext(ctx,
		`INSERT INTO domains (id, name, is_default, is_active, mx_verified, usage_count, created_at)
		 VALUES ($1, $2, TRUE, TRUE, FALSE, 0, $3)
		 ON CONFLICT (name) DO UPDATE SET is_default = TRUE, is_active = TRUE`,
		newID(), cfg.DefaultDomain, now); err != nil {
		return fmt.Errorf("seed domains upsert: %w", err)
	}

	prefix := cfg.PublicAPIKey
	if len(prefix) > 8 {
		prefix = prefix[:8]
	}
	if _, err := p.DB.ExecContext(ctx,
		`INSERT INTO apikeys (id, name, key, prefix, rate_limit, usage_count, is_active, created_at)
		 VALUES ($1, 'public', $2, $3, 100, 0, TRUE, $4)
		 ON CONFLICT (key) DO UPDATE SET is_active = TRUE`,
		newID(), cfg.PublicAPIKey, prefix, now); err != nil {
		return fmt.Errorf("seed apikeys upsert: %w", err)
	}

	log.Printf("seed: default domain %s active, public API key ready", cfg.DefaultDomain)
	return nil
}

// DomainActive reports whether a domain is served (active).
func (p *PG) DomainActive(ctx context.Context, name string) bool {
	var n int
	err := p.DB.QueryRowxContext(ctx, `SELECT 1 FROM domains WHERE name = $1 AND is_active = TRUE`, name).Scan(&n)
	return err == nil
}

// InboxExists reports whether an inbox was claimed (address generated via UI/API).
// SMTP rejects recipients without one so spam to guessed addresses never lands.
func (p *PG) InboxExists(ctx context.Context, address string) bool {
	var n int
	err := p.DB.QueryRowxContext(ctx, `SELECT 1 FROM inboxes WHERE address = $1`, address).Scan(&n)
	return err == nil
}

// UpsertInbox inserts an inbox or refreshes expiry of an existing one;
// the original created_at is preserved. Returns the stored row.
func (p *PG) UpsertInbox(ctx context.Context, address, username, domain string, expires time.Time) (models.Inbox, error) {
	now := time.Now().UTC()
	_, err := p.DB.ExecContext(ctx,
		`INSERT INTO inboxes (address, username, domain, total_received, unread_count, expires_at, created_at)
		 VALUES ($1, $2, $3, 0, 0, $4, $5)
		 ON CONFLICT (address) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
		address, username, domain, expires, now)
	if err != nil {
		return models.Inbox{}, fmt.Errorf("upsert inbox: %w", err)
	}
	return p.GetInbox(ctx, address)
}

// GetInbox returns one inbox by address.
func (p *PG) GetInbox(ctx context.Context, address string) (models.Inbox, error) {
	var ib models.Inbox
	if err := p.DB.QueryRowxContext(ctx,
		`SELECT address, username, domain, total_received, unread_count, expires_at, created_at
		 FROM inboxes WHERE address = $1`, address).
		StructScan(&ib); err != nil {
		return ib, err
	}
	return ib, nil
}

// ListActiveDomainNames returns all active domain names (random pick for inbox gen).
func (p *PG) ListActiveDomainNames(ctx context.Context) ([]string, error) {
	names := []string{}
	if err := p.DB.SelectContext(ctx, &names,
		`SELECT name FROM domains WHERE is_active = TRUE ORDER BY created_at ASC`); err != nil {
		return nil, err
	}
	return names, nil
}

// BumpDomainUsage increments the usage counter of a domain (best-effort).
func (p *PG) BumpDomainUsage(ctx context.Context, name string) {
	_, _ = p.DB.ExecContext(ctx, `UPDATE domains SET usage_count = usage_count + 1 WHERE name = $1`, name)
}

// EmailListItem is one row of an inbox listing (no bodies).
type EmailListItem struct {
	ID            string    `db:"id"`
	SenderAddress string    `db:"sender_address"`
	Subject       string    `db:"subject"`
	CreatedAt     time.Time `db:"created_at"`
}

// ListEmailsByInbox returns the newest 50 emails of an inbox.
func (p *PG) ListEmailsByInbox(ctx context.Context, inboxAddress string) ([]EmailListItem, error) {
	items := []EmailListItem{}
	err := p.DB.SelectContext(ctx, &items,
		`SELECT id, sender ->> 'address' AS sender_address, subject, created_at
		 FROM emails WHERE inbox_address = $1 ORDER BY created_at DESC LIMIT 50`, inboxAddress)
	return items, err
}

// GetEmail returns one email by id (full body + headers).
func (p *PG) GetEmail(ctx context.Context, id string) (models.Email, error) {
	var e models.Email
	err := p.DB.QueryRowxContext(ctx,
		`SELECT id, inbox_address, sender, subject, body_text, body_html, headers, created_at
		 FROM emails WHERE id = $1`, id).
		Scan(&e.ID, &e.InboxAddress, jsonScanner{&e.Sender}, &e.Subject, &e.BodyText, &e.BodyHTML,
			jsonScanner{&e.Headers}, &e.CreatedAt)
	return e, err
}

// MarkEmailRead flips is_read (first read only) and returns the inbox address.
func (p *PG) MarkEmailRead(ctx context.Context, id string) (inbox string, ok bool, err error) {
	err = p.DB.QueryRowxContext(ctx,
		`UPDATE emails SET is_read = TRUE WHERE id = $1 AND is_read = FALSE RETURNING inbox_address`, id).Scan(&inbox)
	return inbox, err == nil, err
}

// DecrementUnread decrements the unread counter (floored at 0).
func (p *PG) DecrementUnread(ctx context.Context, address string) {
	_, _ = p.DB.ExecContext(ctx,
		`UPDATE inboxes SET unread_count = unread_count - 1 WHERE address = $1 AND unread_count > 0`, address)
}

// DeleteEmail removes one email; reports whether a row was deleted.
func (p *PG) DeleteEmail(ctx context.Context, id string) (bool, error) {
	res, err := p.DB.ExecContext(ctx, `DELETE FROM emails WHERE id = $1`, id)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// SetDomainMXInvalidSince stamps the first-invalid observation (grace anchor).
func (p *PG) SetDomainMXInvalidSince(ctx context.Context, name string, now time.Time) {
	_, _ = p.DB.ExecContext(ctx,
		`UPDATE domains SET mx_invalid_since = $1 WHERE name = $2 AND mx_invalid_since IS NULL`,
		now, name)
}

// ClearEmails removes all emails of an inbox; returns the deleted count.
func (p *PG) ClearEmails(ctx context.Context, inboxAddress string) (int64, error) {
	res, err := p.DB.ExecContext(ctx, `DELETE FROM emails WHERE inbox_address = $1`, inboxAddress)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// Stats are the aggregate counters for GET /api/stats.
type Stats struct {
	TotalEmails    int64 `db:"total_emails"`
	TotalInboxes   int64 `db:"total_inboxes"`
	ActiveDomains  int64 `db:"active_domains"`
	Emails24h      int64 `db:"emails_24h"`
	UniqueSubjects int64 `db:"unique_subjects"`
}

// GetStats computes the global counters in one round trip.
func (p *PG) GetStats(ctx context.Context) (Stats, error) {
	var s Stats
	err := p.DB.QueryRowxContext(ctx, `
		SELECT (SELECT count(*) FROM emails) AS total_emails,
		       (SELECT count(*) FROM inboxes) AS total_inboxes,
		       (SELECT count(*) FROM domains WHERE is_active) AS active_domains,
		       (SELECT count(*) FROM emails WHERE created_at >= now() - interval '24 hours') AS emails_24h,
		       (SELECT count(DISTINCT subject) FROM emails) AS unique_subjects`,
	).StructScan(&s)
	return s, err
}

// HourCount is one hourly bucket from Statistics24h.
type HourCount struct {
	Hour  time.Time `db:"hour"`
	Count int64     `db:"count"`
}

// HourlyCounts groups email counts per UTC hour within [start, end).
func (p *PG) HourlyCounts(ctx context.Context, start, end time.Time) (map[time.Time]int64, error) {
	rows, err := p.DB.QueryxContext(ctx,
		`SELECT date_trunc('hour', created_at) AS hour, count(*) AS count
		 FROM emails WHERE created_at >= $1 AND created_at < $2 GROUP BY 1`, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	counts := map[time.Time]int64{}
	for rows.Next() {
		var hc HourCount
		if err := rows.StructScan(&hc); err != nil {
			continue
		}
		counts[hc.Hour] = hc.Count
	}
	return counts, rows.Err()
}

// TopNItem is one leaderboard entry (masking happens in the API layer).
type TopNItem struct {
	Value string `db:"value"`
	Count int64  `db:"count"`
}

// TopSubjects groups by subject, newest 10 by count.
func (p *PG) TopSubjects(ctx context.Context) ([]TopNItem, error) {
	var items []TopNItem
	err := p.DB.SelectContext(ctx, &items,
		`SELECT subject AS value, count(*) AS count FROM emails
		 GROUP BY subject ORDER BY count DESC, value ASC LIMIT 10`)
	return items, err
}

// TopDomains groups by the part after '@' of inbox_address.
func (p *PG) TopDomains(ctx context.Context) ([]TopNItem, error) {
	var items []TopNItem
	err := p.DB.SelectContext(ctx, &items,
		`SELECT split_part(inbox_address, '@', 2) AS value, count(*) AS count FROM emails
		 WHERE inbox_address LIKE '%@%' GROUP BY value ORDER BY count DESC, value ASC LIMIT 10`)
	return items, err
}

// TopSenders groups by sender address (JSONB field).
func (p *PG) TopSenders(ctx context.Context) ([]TopNItem, error) {
	var items []TopNItem
	err := p.DB.SelectContext(ctx, &items,
		`SELECT sender ->> 'address' AS value, count(*) AS count FROM emails
		 GROUP BY value ORDER BY count DESC, value ASC LIMIT 10`)
	return items, err
}

// DomainRow is one row of the domains list (projection).
type DomainRow struct {
	Name              string      `db:"name"`
	IsDefault         bool        `db:"is_default"`
	IsActive          bool        `db:"is_active"`
	MxVerified        bool        `db:"mx_verified"`
	RegistryStatus    StringSlice `db:"registry_status"`
	RegistryExpiresAt *time.Time  `db:"registry_expires_at"`
	UsageCount        int         `db:"usage_count"`
	CreatedAt         time.Time   `db:"created_at"`
}

// ListDomainRows lists domains (active-only by default) newest first.
func (p *PG) ListDomainRows(ctx context.Context, activeOnly bool) ([]DomainRow, error) {
	q := `SELECT name, is_default, is_active, mx_verified, registry_status, registry_expires_at, usage_count, created_at
	      FROM domains`
	if activeOnly {
		q += ` WHERE is_active = TRUE`
	}
	q += ` ORDER BY created_at DESC`
	var rows []DomainRow
	err := p.DB.SelectContext(ctx, &rows, q)
	return rows, err
}

// FindDomainByName returns a full domain row (zero value when absent).
func (p *PG) FindDomainByName(ctx context.Context, name string) (models.Domain, error) {
	var d models.Domain
	var st StringSlice
	err := p.DB.QueryRowxContext(ctx,
		`SELECT id, name, is_default, is_active, mx_verified, mx_invalid_since, mx_verified_at,
		        registry_status, registry_expires_at, usage_count, created_at
		 FROM domains WHERE name = $1`, name).
		Scan(&d.ID, &d.Name, &d.IsDefault, &d.IsActive, &d.MxVerified, &d.MxInvalidSince, &d.MxVerifiedAt,
			&st, &d.RegistryExpiresAt, &d.UsageCount, &d.CreatedAt)
	d.RegistryStatus = []string(st)
	return d, err
}

// DomainExists reports whether a domain row exists.
func (p *PG) DomainExists(ctx context.Context, name string) bool {
	var n int
	err := p.DB.QueryRowxContext(ctx, `SELECT 1 FROM domains WHERE name = $1`, name).Scan(&n)
	return err == nil
}

// InsertDomain inserts a new (unverified, inactive) domain row.
func (p *PG) InsertDomain(ctx context.Context, name string) error {
	_, err := p.DB.ExecContext(ctx,
		`INSERT INTO domains (id, name, is_default, is_active, mx_verified, usage_count, created_at)
		 VALUES ($1, $2, FALSE, FALSE, FALSE, 0, $3)`,
		newID(), name, time.Now().UTC())
	return err
}

// UpsertDomainVerified marks a domain MX-verified+active (register/verify path).
func (p *PG) UpsertDomainVerified(ctx context.Context, domain string, now time.Time) {
	_, _ = p.DB.ExecContext(ctx,
		`INSERT INTO domains (id, name, is_default, is_active, mx_verified, mx_verified_at, usage_count, created_at)
		 VALUES ($1, $2, FALSE, TRUE, TRUE, $3, 0, $4)
		 ON CONFLICT (name) DO UPDATE SET mx_verified = TRUE, is_active = TRUE, mx_verified_at = $3, mx_invalid_since = NULL`,
		newID(), domain, now, now)
}

// SetDomainRegistry persists RDAP status/expiry (nil expiry clears the column).
func (p *PG) SetDomainRegistry(ctx context.Context, domain string, status []string, expires *time.Time) {
	_, _ = p.DB.ExecContext(ctx,
		`UPDATE domains SET registry_status = $1, registry_expires_at = $2 WHERE name = $3`,
		status, expires, domain)
}

// SetDomainMXState applies the mxRefresh outcome (see queue.mxRefresh).
func (p *PG) SetDomainMXState(ctx context.Context, name string, valid bool, now time.Time, anchor *time.Time) {
	switch {
	case valid:
		_, _ = p.DB.ExecContext(ctx,
			`UPDATE domains SET mx_verified = TRUE, mx_verified_at = $1, mx_invalid_since = NULL WHERE name = $2`,
			now, name)
	case anchor != nil:
		// Non-default domain that just went invalid: anchor grace period now.
		_, _ = p.DB.ExecContext(ctx,
			`UPDATE domains SET mx_verified = FALSE, mx_verified_at = $1, is_active = FALSE, mx_invalid_since = $2 WHERE name = $3`,
			now, *anchor, name)
	default:
		// Still-invalid default domain: re-check timestamp only.
		_, _ = p.DB.ExecContext(ctx,
			`UPDATE domains SET mx_verified = FALSE, mx_verified_at = $1 WHERE name = $2`,
			now, name)
	}
}

// ListDomainsForSweep returns pending (unverified) non-default domains.
func (p *PG) ListDomainsForSweep(ctx context.Context) ([]models.Domain, error) {
	return p.selectDomains(ctx, `WHERE is_default = FALSE AND mx_verified = FALSE`)
}

// ListDomainsForRefresh returns all active domains.
func (p *PG) ListDomainsForRefresh(ctx context.Context) ([]models.Domain, error) {
	return p.selectDomains(ctx, `WHERE is_active = TRUE`)
}

// ListDomainsForRDAP returns all non-default domains.
func (p *PG) ListDomainsForRDAP(ctx context.Context) ([]models.Domain, error) {
	return p.selectDomains(ctx, `WHERE is_default = FALSE`)
}

const domainCols = `SELECT id, name, is_default, is_active, mx_verified, mx_invalid_since, mx_verified_at,
	registry_status, registry_expires_at, usage_count, created_at FROM domains `

func (p *PG) selectDomains(ctx context.Context, where string) ([]models.Domain, error) {
	rows, err := p.DB.QueryxContext(ctx, domainCols+where)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	domains := []models.Domain{}
	for rows.Next() {
		var d models.Domain
		var st StringSlice
		if err := rows.Scan(&d.ID, &d.Name, &d.IsDefault, &d.IsActive, &d.MxVerified,
			&d.MxInvalidSince, &d.MxVerifiedAt, &st, &d.RegistryExpiresAt, &d.UsageCount, &d.CreatedAt); err != nil {
			continue
		}
		d.RegistryStatus = []string(st)
		domains = append(domains, d)
	}
	return domains, rows.Err()
}

// DeleteDomain removes a domain by name (mx sweep / RDAP expired).
func (p *PG) DeleteDomain(ctx context.Context, name string) error {
	_, err := p.DB.ExecContext(ctx, `DELETE FROM domains WHERE name = $1`, name)
	return err
}

// FindAPIKeyByKey returns an active key row.
func (p *PG) FindAPIKeyByKey(ctx context.Context, key string) (models.APIKey, error) {
	var k models.APIKey
	err := p.DB.QueryRowxContext(ctx,
		`SELECT id, name, key, prefix, rate_limit, usage_count, last_used_at, is_active, created_at
		 FROM apikeys WHERE key = $1 AND is_active = TRUE`, key).StructScan(&k)
	return k, err
}

// BumpAPIKeyUsage increments usage count + stamps last_used_at (best-effort).
func (p *PG) BumpAPIKeyUsage(ctx context.Context, id string) {
	_, _ = p.DB.ExecContext(ctx,
		`UPDATE apikeys SET usage_count = usage_count + 1, last_used_at = $1 WHERE id = $2`,
		time.Now().UTC(), id)
}

// SaveEmailTx stores a parsed email and (when the inbox exists) bumps the
// inbox + domain counters atomically. Returns the email id.
func (p *PG) SaveEmailTx(ctx context.Context, e *models.Email, inboxExists bool) error {
	tx, err := p.DB.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	sender, err := json.Marshal(e.Sender)
	if err != nil {
		return err
	}
	recipients, err := json.Marshal(e.Recipients)
	if err != nil {
		return err
	}
	headers, err := json.Marshal(e.Headers)
	if err != nil {
		return err
	}
	attachments, err := json.Marshal(e.Attachments)
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO emails (id, inbox_address, sender, recipients, subject, body_text, body_html,
		                      raw_headers, headers, attachments, message_id, size, is_read, expires_at, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,FALSE,$13,$14)`,
		e.ID, e.InboxAddress, sender, recipients, e.Subject, e.BodyText, e.BodyHTML,
		e.RawHeaders, headers, attachments, e.MessageID, e.Size, e.ExpiresAt, e.CreatedAt); err != nil {
		return err
	}
	if inboxExists {
		if _, err := tx.ExecContext(ctx,
			`UPDATE inboxes SET total_received = total_received + 1, unread_count = unread_count + 1
			 WHERE address = $1`, e.InboxAddress); err != nil {
			return err
		}
		if i := strings.LastIndex(e.InboxAddress, "@"); i >= 0 {
			if _, err := tx.ExecContext(ctx,
				`UPDATE domains SET usage_count = usage_count + 1 WHERE name = $1`,
				e.InboxAddress[i+1:]); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}

// ExpiredInboxAddresses returns the addresses of expired inboxes (for purge).
func (p *PG) ExpiredInboxAddresses(ctx context.Context, now time.Time) ([]string, error) {
	addresses := []string{}
	err := p.DB.SelectContext(ctx, &addresses,
		`SELECT address FROM inboxes WHERE expires_at < $1`, now)
	return addresses, err
}

// PurgeEmailsByInboxes deletes all emails of the given inboxes.
func (p *PG) PurgeEmailsByInboxes(ctx context.Context, addresses []string) (int64, error) {
	if len(addresses) == 0 {
		return 0, nil
	}
	q, args, err := sqlx.In(`DELETE FROM emails WHERE inbox_address IN (?)`, addresses)
	if err != nil {
		return 0, err
	}
	res, err := p.DB.ExecContext(ctx, p.DB.Rebind(q), args...)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// PurgeExpiredInboxes deletes expired inboxes; returns deleted count.
func (p *PG) PurgeExpiredInboxes(ctx context.Context, now time.Time) (int64, error) {
	res, err := p.DB.ExecContext(ctx, `DELETE FROM inboxes WHERE expires_at < $1`, now)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// PurgeExpiredEmails deletes orphaned/self-expired emails (inbox gone or expired);
// returns deleted count.
func (p *PG) PurgeExpiredEmails(ctx context.Context, now time.Time) (int64, error) {
	res, err := p.DB.ExecContext(ctx, `DELETE FROM emails WHERE expires_at < $1`, now)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// newID returns a fresh ULID string (same id scheme as the MongoDB days).
func newID() string { return ulidlib.Make().String() }

// jsonScanner decodes a JSONB column into the target pointer.
type jsonScanner struct{ target any }

func (s jsonScanner) Scan(src any) error {
	if src == nil {
		return nil
	}
	b, ok := src.([]byte)
	if !ok {
		if str, ok := src.(string); ok {
			b = []byte(str)
		} else {
			return fmt.Errorf("jsonScanner: unexpected type %T", src)
		}
	}
	if len(b) == 0 {
		return nil
	}
	return json.Unmarshal(b, s.target)
}

// StringSlice scans a PostgreSQL text[] column regardless of the driver's
// representation (pgx stdlib may hand back []any, []byte, or string).
type StringSlice []string

func (s *StringSlice) Scan(src any) error {
	if src == nil {
		*s = nil
		return nil
	}
	switch v := src.(type) {
	case []string:
		*s = v
	case []any:
		out := make(StringSlice, 0, len(v))
		for _, e := range v {
			out = append(out, fmt.Sprint(e))
		}
		*s = out
	case string:
		return s.scanText(v)
	case []byte:
		return s.scanText(string(v))
	default:
		return fmt.Errorf("StringSlice: unexpected type %T", src)
	}
	return nil
}

// scanText parses a Postgres text[] literal like {a,"b c"}.
func (s *StringSlice) scanText(text string) error {
	if text == "" || text == "{}" {
		*s = nil
		return nil
	}
	if !strings.HasPrefix(text, "{") {
		*s = StringSlice{text}
		return nil
	}
	var out StringSlice
	for i := 1; i < len(text); i++ {
		var b strings.Builder
		switch text[i] {
		case '}':
			i = len(text)
		case '"':
			i++
			for i < len(text) && text[i] != '"' {
				b.WriteByte(text[i])
				i++
			}
		default:
			for i < len(text) && text[i] != ',' {
				b.WriteByte(text[i])
				i++
			}
		}
		out = append(out, b.String())
	}
	*s = out
	return nil
}
