// Package dnsx: MX verification with public resolvers + Valkey cache (anti rate-limit).
package dnsx

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"tempmail/internal/config"

	"github.com/miekg/dns"
	"github.com/redis/go-redis/v9"
)

// errCacheTTL adalah negative-cache untuk kegagalan total lookup (semua resolver
// gagal), supaya retry klien yang rapat tidak menghantam resolver lagi.
const errCacheTTL = time.Minute

type cacheEntry struct {
	Valid   bool     `json:"valid"`
	Records []string `json:"records"`
}

// CheckMX reports whether domain's MX records include cfg.MXTarget.
// Cached in Valkey at {TEMPMAIL_REDIS_PREFIX}mx:check:<domain> (1h hit / 5min miss);
// skipCache forces a fresh lookup and refreshes the cache.
func CheckMX(ctx context.Context, rdb *redis.Client, cfg *config.Config, domain string, skipCache bool) (valid bool, records []string, cacheHit bool, err error) {
	domain = strings.ToLower(strings.TrimSpace(domain))
	key := cfg.RedisPrefix + "mx:check:" + domain

	if !skipCache && rdb != nil {
		if raw, gerr := rdb.Get(ctx, key).Result(); gerr == nil {
			var e cacheEntry
			if json.Unmarshal([]byte(raw), &e) == nil {
				return e.Valid, e.Records, true, nil
			}
		}
	}

	records, err = lookupMX(ctx, pickResolvers(cfg), domain, cfg.DNSLookupTimeout, cfg.DNSLookupRounds)
	if err != nil {
		// Negative-cache singkat agar retry klien tidak menghantam resolver lagi.
		if raw, merr := json.Marshal(cacheEntry{Valid: false}); merr == nil && rdb != nil {
			_ = rdb.Set(ctx, key, raw, errCacheTTL).Err()
		}
		return false, nil, false, err
	}
	for _, h := range records {
		if strings.TrimSuffix(h, ".") == cfg.MXTarget {
			valid = true
			break
		}
	}

	ttl := 5 * time.Minute
	if valid {
		ttl = time.Hour
	}
	if raw, merr := json.Marshal(cacheEntry{Valid: valid, Records: records}); merr == nil && rdb != nil {
		_ = rdb.Set(ctx, key, raw, ttl).Err()
	}
	return valid, records, false, nil
}

// lookupMX queries resolvers (miekg/dns, UDP), mencoba setiap resolver sampai
// `rounds` putaran. Resolver sudah di-round-robin/di-sample oleh pickResolvers.
// Error jaringan dan rcode transien (SERVFAIL/REFUSED/dst.) retryable — lanjut
// resolver berikutnya. NXDOMAIN adalah jawaban negatif definitif (domain tidak
// ada): tetap scan resolver lain mencari jawaban positif; jika tidak ada yang
// positif, kembalikan list kosong tanpa error agar domain bogus tetap bisa
// di-grace-delete.
func lookupMX(ctx context.Context, resolvers []string, domain string, timeout time.Duration, rounds int) ([]string, error) {
	if len(resolvers) == 0 {
		return nil, errors.New("dnsx: no resolvers configured")
	}
	if rounds < 1 {
		rounds = 1
	}

	msg := new(dns.Msg)
	msg.SetQuestion(dns.Fqdn(domain), dns.TypeMX)
	msg.RecursionDesired = true

	client := &dns.Client{Timeout: timeout}
	var lastErr error
	sawNXDOMAIN := false
	for round := 0; round < rounds; round++ {
		if round > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(200 * time.Millisecond):
			}
		}
		for _, resolver := range resolvers {
			r, _, err := client.ExchangeContext(ctx, msg, resolver)
			if err != nil {
				lastErr = err
				continue
			}
			if r.Rcode == dns.RcodeNameError {
				sawNXDOMAIN = true
				continue
			}
			if r.Rcode != dns.RcodeSuccess {
				lastErr = fmt.Errorf("dnsx: %s returned %s", resolver, dns.RcodeToString[r.Rcode])
				continue
			}
			records := []string{}
			for _, a := range r.Answer {
				if mx, ok := a.(*dns.MX); ok {
					records = append(records, mx.Mx)
				}
			}
			return records, nil
		}
	}
	if sawNXDOMAIN {
		return []string{}, nil
	}
	return nil, lastErr
}
