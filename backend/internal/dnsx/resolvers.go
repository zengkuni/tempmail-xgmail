// Package dnsx — pool resolver dinamis: fetch berkala daftar resolver publik
// (TEMPMAIL_DNS_RESOLVERS_URL), dipakai untuk round-robin + fallback saat MX lookup.
package dnsx

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"sync/atomic"
	"time"

	"tempmail/internal/config"
)

// Batas parsing daftar resolver (proteksi respons patologis).
const (
	maxResolverListBytes = 4 << 20
	maxResolverEntries   = 5000
)

// rrCounter memutar start index pool agar beban tersebar ke semua resolver.
var rrCounter atomic.Uint64

// poolStore menyimpan []string resolver hasil fetch; kosong → fallback ke
// TEMPMAIL_DNS_RESOLVERS statis dari env.
var poolStore atomic.Value

// dynamicResolvers mengembalikan pool hasil fetch terakhir (nil jika belum pernah sukses).
func dynamicResolvers() []string {
	if v := poolStore.Load(); v != nil {
		return v.([]string)
	}
	return nil
}

// pickResolvers memilih sampel resolver untuk satu lookup: pool dinamis jika
// tersedia, fallback ke TEMPMAIL_DNS_RESOLVERS statis; start index diputar round-robin
// lalu dipotong maksimal TEMPMAIL_DNS_LOOKUP_SAMPLE entri.
func pickResolvers(cfg *config.Config) []string {
	pool := cfg.DNSResolvers
	if dyn := dynamicResolvers(); len(dyn) > 0 {
		pool = dyn
	}
	if len(pool) == 0 {
		return nil
	}
	n := cfg.DNSLookupSample
	if n < 1 || n > len(pool) {
		n = len(pool)
	}
	off := int(rrCounter.Add(1)-1) % len(pool)
	out := make([]string, n)
	for i := range out {
		out[i] = pool[(off+i)%len(pool)]
	}
	return out
}

// StartResolverRefresher fetch daftar resolver dari cfg.DNSResolversURL sekarang,
// lalu me-refresh setiap cfg.DNSResolversRefresh. Non-blokir. URL kosong =
// nonaktif (TEMPMAIL_DNS_RESOLVERS statis dipakai). Fetch gagal tidak mengosongkan pool.
func StartResolverRefresher(ctx context.Context, cfg *config.Config) {
	if cfg.DNSResolversURL == "" {
		return
	}
	refresh := func() {
		list, err := fetchResolvers(ctx, cfg.DNSResolversURL)
		if err != nil {
			log.Printf("dnsx: resolver refresh failed: %v", err)
			return
		}
		if len(list) == 0 {
			log.Printf("dnsx: resolver refresh returned empty list; keeping previous pool")
			return
		}
		poolStore.Store(list)
		log.Printf("dnsx: resolver pool updated (%d resolvers from %s)", len(list), cfg.DNSResolversURL)
	}
	refresh()
	go func() {
		t := time.NewTicker(cfg.DNSResolversRefresh)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				refresh()
			}
		}
	}()
}

// fetchResolvers mengunduh daftar resolver (satu IP per baris, port opsional)
// dan menormalisasi ke bentuk host:port.
func fetchResolvers(ctx context.Context, url string) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("dnsx: resolver list HTTP %s", resp.Status)
	}

	var out []string
	sc := bufio.NewScanner(io.LimitReader(resp.Body, maxResolverListBytes))
	for sc.Scan() && len(out) < maxResolverEntries {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if i := strings.IndexByte(line, '#'); i >= 0 {
			line = strings.TrimSpace(line[:i])
		}
		if ap, err := netip.ParseAddrPort(line); err == nil {
			out = append(out, ap.String())
			continue
		}
		if ip, err := netip.ParseAddr(line); err == nil {
			out = append(out, net.JoinHostPort(ip.String(), "53"))
		}
	}
	if err := sc.Err(); err != nil {
		return nil, err
	}
	return out, nil
}
