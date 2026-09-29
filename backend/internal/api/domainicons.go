package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"

	"golang.org/x/net/publicsuffix"
	"tempmail/internal/config"
	"tempmail/internal/dnsx"
	"tempmail/internal/models"

	"github.com/gin-gonic/gin"
)

// negativeIconCacheTTL — domain tanpa ikon (BIMI maupun favicon absen) tidak
// di-lookup ulang selama ini; resolver dan CDN upstream tidak dihantam
// repeat-render inbox.
const negativeIconCacheTTL = 24 * time.Hour

// iconResolutionTimeout membatasi seluruh resolusi ikon (DNS BIMI + download
// logo): jalur ini dieksekusi per baris email di browser, dan loop resolver
// bisa menelan timeout × rounds × resolvers saat resolver tak terjangkau.
const iconResolutionTimeout = 5 * time.Second

const iconMaxRedirects = 3

var domainRe = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$`)

var allowedLogoTypes = map[string]bool{
	"image/svg+xml": true,
	"image/png":     true,
	"image/jpeg":    true,
	"image/jpg":     true,
}

// faviconAPIBase — sumber ikon fallback: route JSON v1 faviconapi.com
// (GET ?url=<domain> → {"url": ".../cdn/favicons/<domain>.png"} atau
// 422 {"error": "..."} untuk domain tak dikenal). Host tunggal & publik;
// seluruh SSRF guard fetchLogo berlaku untuk ikon CDN-nya.
const faviconAPIBase = "https://faviconapi.com/api/v1/favicon?url="

// DomainIcon serves the brand icon of an email sender's domain.
// Resolution order:
//
//	domain_icons hit → BIMI logo (DNS TXT) → faviconapi.com favicon → 404
//
// A 404 makes the frontend fall back to the sender's first letter.
// Definitive misses (no BIMI, unusable logo, no favicon) store a negative
// entry (data NULL) and are retried only after negativeIconCacheTTL;
// transient failures (resolvers unreachable, upstream timeout) are NOT
// cached so a real icon is picked up on the next render. Setiap ikon diunduh
// paling banyak sekali: semua hasil (positif maupun negatif) lewat DB.
func (h *handlers) DomainIcon(c *gin.Context) {
	domain := strings.ToLower(strings.TrimSpace(c.Param("domain")))
	if !domainRe.MatchString(domain) {
		fail(c, 400, "invalid domain")
		return
	}
	// Subdomain (noreply@account.tokopedia.com → account.tokopedia.com)
	// dinormalkan ke registrable root (tokopedia.com): satu cache row, BIMI
	// dan favicon lookup selalu memakai domain dasar brand.
	if root, err := publicsuffix.EffectiveTLDPlusOne(domain); err == nil {
		domain = root
	}
	reqCtx := c.Request.Context()

	if icon, err := h.m.GetDomainIcon(reqCtx, domain); err == nil {
		if len(icon.Data) > 0 {
			serveIcon(c, icon)
			return
		}
		if time.Since(icon.FetchedAt) < negativeIconCacheTTL {
			c.Status(http.StatusNotFound)
			return
		}
	}

	// Seluruh resolusi ikon dibatasi satu budget waktu.
	ctx, cancel := context.WithTimeout(reqCtx, iconResolutionTimeout)
	defer cancel()

	icon := h.resolveDomainIcon(ctx, domain)
	if icon == nil {
		// Kegagalan transient: jangan cache apa pun, coba lagi nanti.
		c.Status(http.StatusNotFound)
		return
	}
	if len(icon.Data) == 0 {
		// Miss definitif: negative-cache, lalu 404 → UI pakai huruf awal.
		saveIcon(h, reqCtx, icon)
		c.Status(http.StatusNotFound)
		return
	}
	saveIcon(h, reqCtx, icon)
	serveIcon(c, icon)
}

// resolveDomainIcon — BIMI dulu, kalau definitif gagal jatuh ke favicon API.
// Mengembalikan nil HANYA untuk kegagalan transient (caller tidak menyimpan
// apa pun). Mengembalikan icon (Data terisi atau nil) untuk kasus lain.
func (h *handlers) resolveDomainIcon(ctx context.Context, domain string) *models.DomainIcon {
	logoURL, ok, err := dnsx.LookupBIMI(ctx, h.cfg, domain)
	if err != nil {
		// Resolver gagal = jawaban belum definitif; jangan negative-cache.
		log.Printf("domain-icons: BIMI lookup %s: %v", domain, err)
		return nil
	}
	if !ok {
		// Domain tidak publik BIMI sama sekali → coba favicon.
		return h.faviconOrNegative(ctx, domain)
	}
	data, ct, definitive, ferr := fetchLogo(ctx, h.cfg, logoURL)
	if ferr == nil {
		return &models.DomainIcon{Domain: domain, ContentType: ct, Data: data, FetchedAt: time.Now().UTC()}
	}
	if !definitive {
		// Timeout/koneksi gagal: logo mungkin ada, jangan cache + jangan
		// timpa dengan favicon (BIMI tetap pilihan utama saat dicoba lagi).
		log.Printf("domain-icons: fetch %s: %v", logoURL, ferr)
		return nil
	}
	// Logo BIMI ada tapi tak terpakai (host nolak, oversize, tipe salah,
	// URL diblokir guard) → favicon jadi pengganti.
	log.Printf("domain-icons: fetch %s: %v", logoURL, ferr)
	return h.faviconOrNegative(ctx, domain)
}

// faviconOrNegative — fallback ikon via route JSON v1 faviconapi.com.
// Lookup JSON mengembalikan URL CDN PNG; ikon diunduh dari URL itu dengan
// guard yang sama. Sukses → ikon positif; definitif gagal (422 = di luar
// katalog, URL CDN diblokir guard, logo oversize/disallowed type) → entri
// negatif; transient (timeout/koneksi/429/5xx) → nil (tidak dicache).
func (h *handlers) faviconOrNegative(ctx context.Context, domain string) *models.DomainIcon {
	iconURL, err := fetchFaviconIconURL(ctx, h.cfg, domain)
	if iconURL == "" {
		if !errors.Is(err, errDefinitive) {
			log.Printf("domain-icons: favicon %s: %v", domain, err)
			return nil
		}
		log.Printf("domain-icons: no icon for %s (favicon: not found)", domain)
		return &models.DomainIcon{Domain: domain, FetchedAt: time.Now().UTC()}
	}
	data, ct, definitive, ferr := fetchLogo(ctx, h.cfg, iconURL)
	if ferr == nil {
		return &models.DomainIcon{Domain: domain, ContentType: ct, Data: data, FetchedAt: time.Now().UTC()}
	}
	if !definitive {
		log.Printf("domain-icons: favicon %s: %v", domain, ferr)
		return nil
	}
	log.Printf("domain-icons: no icon for %s (favicon: %v)", domain, ferr)
	return &models.DomainIcon{Domain: domain, FetchedAt: time.Now().UTC()}
}

// faviconV1Resp — envelope JSON route v1 faviconapi.com: sukses berisi url
// CDN PNG (mis. https://faviconapi.com/cdn/favicons/gitea.com.png); domain
// tak dikenal membalas 422 dengan {"error": "..."} dan url kosong.
type faviconV1Resp struct {
	URL   string `json:"url"`
	Error string `json:"error"`
}

// errDefinitive — kegagalan lookup favicon yang BUKAN kondisi sementara
// (domain tak dikenal / badan tak terbaca): aman negative-cache.
var errDefinitive = errors.New("definitive")

// fetchFaviconIconURL memanggil route JSON faviconapi.com v1 dan
// mengembalikan URL ikon CDN. URL kosong + err is errDefinitive = domain
// tidak punya favicon (422, negative-cache); URL kosong + err lain =
// transient (timeout/koneksi/429/5xx/badan tak terbaca) — coba lagi render
// berikutnya, TIDAK di-negative-cache.
func fetchFaviconIconURL(ctx context.Context, cfg *config.Config, domain string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, cfg.DomainIconTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, faviconAPIBase+domain, nil)
	if err != nil {
		return "", fmt.Errorf("favicon api request %s: %w", domain, err)
	}
	req.Header.Set("User-Agent", "tempmail-xgmail/1.0")
	client := *logoClient // salinan agar Timeout per-konfigurasi aman
	client.Timeout = cfg.DomainIconTimeout
	resp, err := client.Do(req)
	if err != nil {
		// Penolakan guard (host faviconapi.com resolve ke IP internal)
		// = definitif; timeout/koneksi/DNS gagal = transien.
		if errors.Is(err, errBlockedTarget) {
			return "", fmt.Errorf("favicon api %s: %w", domain, errDefinitive)
		}
		return "", fmt.Errorf("favicon api %s: %w", domain, err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if err != nil {
		// Upstream putus di tengah respons: gangguan sesaat, bukan
		// jawaban "tidak ada" → transien.
		return "", fmt.Errorf("favicon api %s: %w", domain, err)
	}
	if resp.StatusCode == http.StatusUnprocessableEntity {
		// 422 = jawaban resmi "favicon tidak ada" untuk domain ini.
		return "", fmt.Errorf("favicon api %s: not found: %w", domain, errDefinitive)
	}
	if resp.StatusCode != http.StatusOK {
		// Termasuk 429/5xx (dan 4xx lain): gangguan/rate-limit upstream —
		// transien, jangan negative-cache.
		return "", fmt.Errorf("favicon api %s: status %d", domain, resp.StatusCode)
	}
	var r faviconV1Resp
	if err := json.Unmarshal(body, &r); err != nil {
		// 200 dengan badan non-JSON = upstream rusak/ganti format: transien.
		return "", fmt.Errorf("favicon api %s: unreadable body: %w", domain, err)
	}
	if r.URL == "" {
		// 200 dengan payload error (bukan 422) tetap transien: hanya
		// favicon_not_found yang layak di-negative-cache.
		return "", fmt.Errorf("favicon api %s: no url (%s)", domain, r.Error)
	}
	return r.URL, nil
}

// errBlockedTarget — penolakan guard SSRF (dialer atau redirect ke IP
// internal). Bukan kondisi sementara: aman negative-cache 24h.
var errBlockedTarget = errors.New("blocked target")

// saveIcon — kegagalan hanya di-log: ikon tetap bisa dilayani walau DB mati.
func saveIcon(h *handlers, ctx context.Context, icon *models.DomainIcon) {
	if err := h.m.SaveDomainIcon(ctx, icon); err != nil {
		log.Printf("domain-icons: save %s: %v", icon.Domain, err)
	}
}

// serveIcon — ikon disajikan dari origin kita — tanpa nosniff + CSP, SVG
// berskrip bisa jalan di origin ini kalau URL-nya dibuka langsung.
func serveIcon(c *gin.Context, icon *models.DomainIcon) {
	c.Header("Cache-Control", "public, max-age=86400")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
	c.Data(http.StatusOK, icon.ContentType, icon.Data)
}

// logoTransport — transport bersama (connection reuse) dengan dialer yang
// memvalidasi IP tujuan: private/loopback/link-local/CGNAT diblokir SEBELUM
// koneksi dibuka, jadi DNS-rebinding tak bisa mengarahkan fetch ke host
// internal.
var logoTransport = &http.Transport{
	DialContext: guardedDialContext,
	// Batas koneksi agar satu domain logo lambat tak menyandera pool.
	MaxIdleConns:        16,
	IdleConnTimeout:     30 * time.Second,
	TLSHandshakeTimeout: 5 * time.Second,
}

var logoClient = &http.Client{
	Transport: logoTransport,
	// Timeout di-set per-request dari cfg.DomainIconTimeout oleh fetchLogo
	// lewat request context; nilai ini hanya fallback.
	Timeout: iconResolutionTimeout,
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= iconMaxRedirects {
			return fmt.Errorf("too many redirects: %w", errBlockedTarget)
		}
		// Downgrade skema dan hop ke host non-https diblokir.
		if req.URL.Scheme != "https" {
			return fmt.Errorf("non-https redirect to %s: %w", req.URL.Redacted(), errBlockedTarget)
		}
		host := req.URL.Hostname()
		ips, err := net.DefaultResolver.LookupIPAddr(req.Context(), host)
		if err != nil {
			return fmt.Errorf("redirect host %s: %w", host, err)
		}
		for _, ip := range ips {
			if isBlockedIP(ip.IP) {
				return fmt.Errorf("redirect host %s: %w (%s)", host, errBlockedTarget, ip.IP)
			}
		}
		return nil
	},
}

// guardedDialContext — resolve host lalu tolak jika ADA IP yang masuk jaringan
// lokal (private/loopback/link-local/CGNAT/multicast/reserved), lalu dial IP
// yang sudah divalidasi. Validasi ulang redirect tanggung jawab CheckRedirect;
// validasi ulang DNS rebinding tanggung jawab dialer ini.
func guardedDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}
	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, err
	}
	for _, ip := range ips {
		if isBlockedIP(ip.IP) {
			return nil, fmt.Errorf("logo host %s: %w (%s)", host, errBlockedTarget, ip.IP)
		}
	}
	d := net.Dialer{Timeout: 5 * time.Second}
	return d.DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
}

// isBlockedIP — true untuk address yang tak boleh dihubungi server kita:
// loopback, private/ULA, link-local, CGNAT, multicast, unspecified, reserved
// besar, broadcast, dan rentang dokumentasi. IP literal di URL juga lolos
// lewat sini karena http.Transport memakainya apa adanya saat dial.
func isBlockedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() ||
		ip.IsMulticast() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return true
	}
	if v4 := ip.To4(); v4 != nil {
		switch {
		case v4[0] == 0: // 0.0.0.0/8 "this network"
			return true
		case v4[0] >= 240: // 240.0.0.0/4 reserved + 255.255.255.255 broadcast
			return true
		case v4[0] == 100 && v4[1] >= 64 && v4[1] <= 127: // 100.64.0.0/10 CGNAT
			return true
		case v4[0] == 192 && v4[1] == 0 && v4[2] == 0: // 192.0.0.0/24 IETF protocol
			return true
		case v4[0] == 198 && (v4[1] == 18 || v4[1] == 19): // 198.18.0.0/15 benchmark
			return true
		case v4[0] == 192 && v4[1] == 0 && v4[2] == 2: // 192.0.2.0/24 TEST-NET-1
			return true
		case v4[0] == 198 && (v4[1] == 51 || v4[1] == 52): // 198.51.100.0/24, 198.52.100.0/24
			return true
		case v4[0] == 203 && v4[1] == 0 && v4[2] == 113: // 203.0.113.0/24 TEST-NET-3
			return true
		}
		return false
	}
	// IPv6 ULA fc00::/7 (IsPrivate sudah menanggung, dicek ulang untuk kejelasan).
	if len(ip) == net.IPv6len && ip[0]&0xfe == 0xfc {
		return true
	}
	return false
}

// fetchLogo mengunduh URL logo BIMI atau favicon API dengan guard:
//   - dialer memvalidasi setiap IP tujuan (lihat guardedDialContext);
//   - maksimal iconMaxRedirects hop, semua https, tiap hop divalidasi ulang;
//   - hanya status 200, content-type image/* yang di-allowlist;
//   - body dibatasi cfg.DomainIconMaxBytes.
//
// Nilai balik definitive=true menandai kegagalan yang BUKAN kondisi sementara
// (host menolak, logo rusak/oversize, URL diblokir guard) sehingga aman
// negative-cache; definitive=false = timeout/koneksi gagal (jangan cache).
func fetchLogo(ctx context.Context, cfg *config.Config, url string) (data []byte, contentType string, definitive bool, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", true, err
	}
	req.Header.Set("User-Agent", "tempmail-xgmail/1.0")

	client := *logoClient // salinan agar Timeout per-konfigurasi aman
	client.Timeout = cfg.DomainIconTimeout
	resp, err := client.Do(req)
	if err != nil {
		// Penolakan guard SSRF = definitif (negative-cache 24j); timeout /
		// koneksi gagal / DNS gagal = transien (jangan cache, coba lagi).
		// client.Do membungkus error dalam *url.Error yang mendukung Unwrap,
		// jadi errors.Is tetap tembus sampai sentinel dialer/redirect.
		return nil, "", errors.Is(err, errBlockedTarget), err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		// 429 = rate-limit (transien). 404 dan lainnya (termasuk 502 route
		// brandfetch = "brand tidak ada") = definitif → negative-cache.
		return nil, "", resp.StatusCode != http.StatusTooManyRequests,
			fmt.Errorf("logo fetch %s: status %d", url, resp.StatusCode)
	}
	data, err = io.ReadAll(io.LimitReader(resp.Body, cfg.DomainIconMaxBytes+1))
	if err != nil {
		return nil, "", false, err
	}
	if int64(len(data)) > cfg.DomainIconMaxBytes {
		return nil, "", true, fmt.Errorf("logo fetch %s: exceeds %d bytes", url, cfg.DomainIconMaxBytes)
	}
	ct := strings.TrimSpace(strings.SplitN(resp.Header.Get("Content-Type"), ";", 2)[0])
	if ct == "" {
		ct = "image/svg+xml" // mayoritas logo BIMI berbentuk SVG
	}
	if !allowedLogoTypes[strings.ToLower(ct)] {
		return nil, "", true, fmt.Errorf("logo fetch %s: disallowed content-type %q", url, ct)
	}
	return data, ct, true, nil
}
