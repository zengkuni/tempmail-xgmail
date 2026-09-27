package models

import "time"

// Address is a display name + address pair (From / To / recipients).
// Stored as JSONB in the emails table (sender / recipients columns).
type Address struct {
	Address string `json:"address"`
	Name    string `json:"name"`
}

// AttachmentMeta — attachment metadata only; binary content is discarded.
// Stored as the attachments JSONB column.
type AttachmentMeta struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Size        int    `json:"size"`
	ContentID   string `json:"content_id"`
}

// Inbox — one row per generated address; primary key is the address itself.
type Inbox struct {
	ID            string    `db:"address" json:"-"`
	Username      string    `db:"username" json:"username"`
	Domain        string    `db:"domain" json:"domain"`
	TotalReceived int       `db:"total_received" json:"total_received"`
	UnreadCount   int       `db:"unread_count" json:"unread_count"`
	ExpiresAt     time.Time `db:"expires_at" json:"expires_at"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}

// Email — parsed inbound mail; id is a ULID string.
type Email struct {
	ID           string            `db:"id" json:"id"`
	InboxAddress string            `db:"inbox_address" json:"inbox_address"`
	Sender       Address           `json:"sender"`
	Recipients   []Address         `json:"recipients"`
	Subject      string            `db:"subject" json:"subject"`
	BodyText     string            `db:"body_text" json:"text"`
	BodyHTML     string            `db:"body_html" json:"html"`
	RawHeaders   string            `db:"raw_headers" json:"-"`
	Headers      map[string]string `json:"headers"`
	Attachments  []AttachmentMeta  `json:"attachments"`
	MessageID    string            `db:"message_id" json:"message_id"`
	Size         int               `db:"size" json:"size"`
	IsRead       bool              `db:"is_read" json:"is_read"`
	ExpiresAt    time.Time         `db:"expires_at" json:"expires_at"`
	CreatedAt    time.Time         `db:"created_at" json:"received_at"`
}

// Domain — a domain this MX cluster serves.
type Domain struct {
	ID         string `db:"id" json:"-"`
	Name       string `db:"name" json:"name"`
	IsDefault  bool   `db:"is_default" json:"is_default"`
	IsActive   bool   `db:"is_active" json:"is_active"`
	MxVerified bool   `db:"mx_verified" json:"mx_verified"`
	// Grace anchor saat MX tiba-tiba invalid (domain yang sebelumnya verified).
	MxInvalidSince *time.Time `db:"mx_invalid_since,omitempty" json:"mx_invalid_since,omitempty"`
	MxVerifiedAt   *time.Time `db:"mx_verified_at,omitempty" json:"mx_verified_at,omitempty"`
	// Status registry (RDAP) dan tanggal kedaluwarsa; diisi task rdap-refresh.
	RegistryStatus    []string   `db:"registry_status,omitempty" json:"registry_status,omitempty"`
	RegistryExpiresAt *time.Time `db:"registry_expires_at,omitempty" json:"registry_expires_at,omitempty"`
	UsageCount        int        `db:"usage_count" json:"usage_count"`
	CreatedAt         time.Time  `db:"created_at" json:"created_at"`
}

// APIKey — public/developer API keys for X-API-Key auth.
type APIKey struct {
	ID         string     `db:"id" json:"-"`
	Name       string     `db:"name" json:"name"`
	Key        string     `db:"key" json:"key"`
	Prefix     string     `db:"prefix" json:"prefix"`
	RateLimit  int        `db:"rate_limit" json:"rate_limit"`
	UsageCount int        `db:"usage_count" json:"usage_count"`
	LastUsedAt *time.Time `db:"last_used_at,omitempty" json:"last_used_at,omitempty"`
	IsActive   bool       `db:"is_active" json:"is_active"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
}
