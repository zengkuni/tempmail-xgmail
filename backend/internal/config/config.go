package config

import (
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration, sourced from env vars with dev-safe defaults.
type Config struct {
	Port          string
	SMTPPort      string
	PostgresURL   string
	RedisAddr     string
	RedisUsername string
	RedisPassword string
	// Redis DB index (0 default); parsed from TEMPMAIL_REDIS_URL path.
	RedisDB       int
	AppEnv        string
	RedisPrefix   string
	PublicAPIKey  string
	DefaultDomain string
	MXTarget      string
	// Go duration string: "30m", "24h", "1h30m". Drives inbox + email expiresAt.
	MaxInboxExpiration time.Duration
	SMTPGreeting       string
	// Per-IP fixed-window limits: API = blanket /api, Strict = creation endpoints.
	RateLimitAPIMax           int
	RateLimitAPIWindowMinutes int
	RateLimitStrictMax        int
	RateLimitStrictWindowMins int
	FrontendURLs              []string
	DNSResolvers              []string
	// Grace sebelum domain non-default yang MX-nya tidak valid dihapus otomatis.
	DomainMXGrace time.Duration
	// Interval sweep domain pending (mxVerified=false) dan re-verify domain aktif.
	MXSweepInterval   time.Duration
	MXRefreshInterval time.Duration
	// Interval pengecekan registry (RDAP) dan TTL cache hasilnya.
	RDAPRefreshInterval time.Duration
	RDAPCacheTTL        time.Duration
	// Per-attempt timeout dan jumlah putaran retry lintas TEMPMAIL_DNS_RESOLVERS.
	DNSLookupTimeout time.Duration
	DNSLookupRounds  int
	// Maksimal resolver yang dicoba per lookup saat pool dinamis besar.
	DNSLookupSample int
	// URL daftar resolver publik (satu IP per baris) untuk pool round-robin;
	// kosong = nonaktif, pakai TEMPMAIL_DNS_RESOLVERS statis saja.
	DNSResolversURL string
	// Interval refresh otomatis pool resolver dari TEMPMAIL_DNS_RESOLVERS_URL.
	DNSResolversRefresh time.Duration
}

// Load reads backend/.env (if present) then the process env, applying defaults.
func Load() *Config {
	_ = godotenv.Load()

	return &Config{
		Port:                      get("TEMPMAIL_PORT", "5001"),
		SMTPPort:                  get("TEMPMAIL_SMTP_PORT", "2525"),
		PostgresURL:               get("TEMPMAIL_POSTGRES_URL", "postgres://postgres:postgres@localhost:5432/tempmail?sslmode=disable"),
		RedisAddr:                 redisAddr(),
		RedisUsername:             redisUsername(),
		RedisPassword:             redisPasswordFromURL(),
		RedisDB:                   redisDB(),
		AppEnv:                    get("TEMPMAIL_APP_ENV", "development"),
		RedisPrefix:               get("TEMPMAIL_REDIS_PREFIX", "tempmail-xgmail:"),
		PublicAPIKey:              get("TEMPMAIL_PUBLIC_API_KEY", "public-dev-key"),
		DefaultDomain:             get("TEMPMAIL_DEFAULT_DOMAIN", "mail.tempmail.dev"),
		MXTarget:                  get("TEMPMAIL_MX_TARGET", "mail.tempmail.dev"),
		MaxInboxExpiration:        getDuration("TEMPMAIL_MAX_INBOX_EXPIRATION", 24*time.Hour),
		SMTPGreeting:              get("TEMPMAIL_SMTP_GREETING", "mail.xgmail.bond"),
		RateLimitAPIMax:           getInt("TEMPMAIL_RATE_LIMIT_API_MAX", 300),
		RateLimitAPIWindowMinutes: getInt("TEMPMAIL_RATE_LIMIT_API_WINDOW_MINUTES", 15),
		RateLimitStrictMax:        getInt("TEMPMAIL_RATE_LIMIT_STRICT_MAX", 20),
		RateLimitStrictWindowMins: getInt("TEMPMAIL_RATE_LIMIT_STRICT_WINDOW_MINUTES", 1),
		// Comma-separated: e.g. the vite dev origin and the production origin.
		FrontendURLs:        getList("TEMPMAIL_FRONTEND_URL", "http://localhost:5173"),
		DNSResolvers:        getList("TEMPMAIL_DNS_RESOLVERS", "1.1.1.1:53,8.8.8.8:53,9.9.9.9:53"),
		DomainMXGrace:       getDuration("TEMPMAIL_DOMAIN_MX_GRACE", 10*time.Minute),
		MXSweepInterval:     getDuration("TEMPMAIL_MX_SWEEP_INTERVAL", time.Minute),
		MXRefreshInterval:   getDuration("TEMPMAIL_MX_REFRESH_INTERVAL", 30*time.Minute),
		RDAPRefreshInterval: getDuration("TEMPMAIL_RDAP_REFRESH_INTERVAL", 24*time.Hour),
		RDAPCacheTTL:        getDuration("TEMPMAIL_RDAP_CACHE_TTL", 24*time.Hour),
		DNSLookupTimeout:    getDuration("TEMPMAIL_DNS_LOOKUP_TIMEOUT", 3*time.Second),
		DNSLookupRounds:     getInt("TEMPMAIL_DNS_LOOKUP_ROUNDS", 2),
		DNSLookupSample:     getInt("TEMPMAIL_DNS_LOOKUP_SAMPLE", 8),
		DNSResolversURL:     get("TEMPMAIL_DNS_RESOLVERS_URL", "https://raw.githubusercontent.com/proabiral/Fresh-Resolvers/refs/heads/master/resolvers.txt"),
		DNSResolversRefresh: getDuration("TEMPMAIL_DNS_RESOLVERS_REFRESH", 24*time.Hour),
	}
}

func get(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

// getDuration parses Go duration strings ("30m", "24h", "1h30m"); invalid/empty falls back to def.
func getDuration(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil && d > 0 {
			return d
		}
	}
	return def
}

func getList(key, def string) []string {
	v := get(key, def)
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// redisURL parses TEMPMAIL_REDIS_URL (redis://user:pass@host:port/db) — the
// single connection source (addr, ACL user, password, DB index). Nil when
// unset; callers fall back to localhost:6379 / no auth / DB 0.
func redisURL() *url.URL {
	v := strings.TrimSpace(os.Getenv("TEMPMAIL_REDIS_URL"))
	if v == "" {
		return nil
	}
	u, err := url.Parse(v)
	if err != nil || u.Host == "" {
		return nil
	}
	return u
}

func redisAddr() string {
	if u := redisURL(); u != nil {
		return u.Host
	}
	return "localhost:6379"
}
func redisUsername() string {
	if u := redisURL(); u != nil && u.User != nil {
		return u.User.Username()
	}
	return ""
}

func redisPasswordFromURL() string {
	if u := redisURL(); u != nil && u.User != nil {
		if pw, ok := u.User.Password(); ok {
			return pw
		}
	}
	return ""
}

func redisDB() int {
	if u := redisURL(); u != nil {
		if db, err := strconv.Atoi(strings.TrimPrefix(u.Path, "/")); err == nil {
			return db
		}
	}
	return 0
}
