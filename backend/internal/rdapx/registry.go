// Package rdapx: pengecekan registry domain (RDAP) — status + tanggal
// kedaluwarsa — dengan cache Valkey (anti rate-limit registry).
package rdapx

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"tempmail/internal/config"

	"github.com/openrdap/rdap"
	"github.com/redis/go-redis/v9"
)

// errCacheTTL adalah negative-cache untuk kegagalan lookup registry (registry
// down / TLD tanpa RDAP), supaya retry task tidak menghantam registry lagi.
const errCacheTTL = 5 * time.Minute

type cacheEntry struct {
	Status    []string   `json:"status"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

// Info adalah hasil pengecekan registry satu domain.
type Info struct {
	Status    []string
	ExpiresAt *time.Time
}

// CheckRegistry mengambil status + tanggal kedaluwarsa domain via RDAP.
// Cached di Valkey di {TEMPMAIL_REDIS_PREFIX}rdap:check:<domain> dengan TTL
// cfg.RDAPCacheTTL; skipCache memaksa lookup baru dan me-refresh cache.
// Error lookup tetap di-negative-cache sebentar, tapi dikembalikan ke caller
// agar caller skip (jangan hapus domain karena false negative).
func CheckRegistry(ctx context.Context, rdb *redis.Client, cfg *config.Config, domain string, skipCache bool) (Info, error) {
	domain = strings.ToLower(strings.TrimSpace(domain))
	key := cfg.RedisPrefix + "rdap:check:" + domain

	if !skipCache && rdb != nil {
		if raw, gerr := rdb.Get(ctx, key).Result(); gerr == nil {
			var e cacheEntry
			if json.Unmarshal([]byte(raw), &e) == nil {
				return Info{Status: e.Status, ExpiresAt: e.ExpiresAt}, nil
			}
		}
	}

	info, err := lookup(ctx, cfg, domain)
	if err != nil {
		// Negative-cache singkat agar task berikutnya tidak menghantam registry lagi.
		if raw, merr := json.Marshal(cacheEntry{}); merr == nil && rdb != nil {
			_ = rdb.Set(ctx, key, raw, errCacheTTL).Err()
		}
		return Info{}, err
	}

	if raw, merr := json.Marshal(cacheEntry{Status: info.Status, ExpiresAt: info.ExpiresAt}); merr == nil && rdb != nil {
		_ = rdb.Set(ctx, key, raw, cfg.RDAPCacheTTL).Err()
	}
	return info, nil
}

// lookup menjalankan QueryDomain dengan batas waktu cfg.DNSLookupTimeout
// (QueryDomain tidak menerima context). Goroutine yang tertinggal setelah
// timeout dibiarkan; HTTP client milik library punya deadline sendiri.
func lookup(ctx context.Context, cfg *config.Config, domain string) (Info, error) {
	type result struct {
		info Info
		err  error
	}
	ch := make(chan result, 1)
	go func() {
		// Zero-value Client auto-defaults HTTP/Bootstrap on first use.
		client := &rdap.Client{}
		d, err := client.QueryDomain(domain)
		if err != nil {
			ch <- result{err: err}
			return
		}
		ch <- result{info: extract(d)}
	}()

	select {
	case <-ctx.Done():
		return Info{}, ctx.Err()
	case r := <-ch:
		return r.info, r.err
	case <-time.After(cfg.DNSLookupTimeout):
		return Info{}, context.DeadlineExceeded
	}
}

// extract menyalin status dan event "expiration" paling akhir dari respons RDAP.
// Tanggal yang gagal di-parse diabaikan; registry tanpa event expiration
// menghasilkan ExpiresAt nil (domain tidak akan dihapus oleh task ini).
func extract(d *rdap.Domain) Info {
	info := Info{}
	if len(d.Status) > 0 {
		info.Status = make([]string, len(d.Status))
		copy(info.Status, d.Status)
	}
	for _, e := range d.Events {
		if !strings.EqualFold(e.Action, "expiration") {
			continue
		}
		t, err := time.Parse(time.RFC3339, e.Date)
		if err != nil {
			continue
		}
		if info.ExpiresAt == nil || t.After(*info.ExpiresAt) {
			tt := t
			info.ExpiresAt = &tt
		}
	}
	return info
}
