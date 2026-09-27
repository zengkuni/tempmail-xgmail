package api

import (
	"encoding/json"
	"net/http"
	neturl "net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// staticSPA serves a built Vite SPA from disk with history-API fallback, plus a
// runtime /config.js so the same image can be rebranded via env without rebuild.
// Mounted last; /api and /socket.io routes are registered before it and win.
type staticSPA struct {
	root string
	cfg  *runtimeBrandConfig
}

type runtimeBrandConfig struct {
	Brand  string
	MX     string
	Domain string
}

func newStaticSPA(root string) *staticSPA {
	return &staticSPA{
		root: root,
		cfg: &runtimeBrandConfig{
			Brand:  os.Getenv("TEMPMAIL_BRAND"),
			MX:     os.Getenv("TEMPMAIL_MX"),
			Domain: os.Getenv("TEMPMAIL_DEFAULT_DOMAIN"),
		},
	}
}

// configJS renders window.__TEMPMAIL_CONFIG__ from env. Only public keys.
func (s *staticSPA) configJS(c *gin.Context) {
	out := map[string]string{}
	if s.cfg.Brand != "" {
		out["TEMPMAIL_BRAND"] = s.cfg.Brand
	}
	if s.cfg.MX != "" {
		out["TEMPMAIL_MX"] = s.cfg.MX
	}
	if s.cfg.Domain != "" {
		out["BRAND_DOMAIN"] = s.cfg.Domain
	}
	b, _ := json.Marshal(out)
	c.Header("Cache-Control", "no-store")
	c.Data(200, "application/javascript", []byte("window.__TEMPMAIL_CONFIG__="+string(b)+";"))
}

func (s *staticSPA) handler(c *gin.Context) {
	// /config.js is generated from env, not from disk.
	if c.Request.URL.Path == "/config.js" {
		s.configJS(c)
		return
	}

	// Clean the path and try to serve a real file first (assets, favicon, ...).
	p := filepath.Clean(strings.TrimPrefix(c.Request.URL.Path, "/"))
	full := filepath.Join(s.root, p)
	if st, err := os.Stat(full); err == nil && !st.IsDir() {
		// Long cache for Vite-hashed assets only.
		if strings.HasPrefix(c.Request.URL.Path, "/assets/") {
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		}
		c.File(full)
		return
	}

	// SPA fallback: any non-file GET serves index.html so client routing works.
	if c.Request.Method == http.MethodGet {
		c.File(filepath.Join(s.root, "index.html"))
		return
	}
	c.Status(http.StatusNotFound)
}

// RegisterStatic wires the SPA into the engine. No-op when the dist dir is
// absent (e.g. `go run` during backend-only dev), so API behavior is unchanged.
func RegisterStatic(r *gin.Engine, distDir string) {
	if st, err := os.Stat(distDir); err != nil || !st.IsDir() {
		return
	}
	s := newStaticSPA(distDir)
	r.NoRoute(s.handler)
}

// isAllowedBrowserRequest reports whether the request looks like it came from
// our own SPA in a browser: it carries an Origin or Referer whose host matches
// the configured FrontendURLs (TEMPMAIL_FRONTEND_URL) (or the request's own host, for same-origin).
// Used to grant the no-key public fallback only to genuine site traffic — a
// bare curl/script without those headers must pass an explicit API key.
func isAllowedBrowserRequest(c *gin.Context, allowed []string) bool {
	for _, h := range []string{c.GetHeader("Origin"), c.GetHeader("Referer")} {
		if h == "" {
			continue
		}
		u, err := neturl.Parse(h)
		if err != nil {
			continue
		}
		host := u.Host
		// Same-origin: referer host == request host (covers single-image prod
		// even when TEMPMAIL_FRONTEND_URL isn't listed).
		if strings.EqualFold(host, c.Request.Host) {
			return true
		}
		for _, a := range allowed {
			au, err := neturl.Parse(strings.TrimSpace(a))
			if err == nil && au.Host != "" && strings.EqualFold(au.Host, host) {
				return true
			}
		}
	}
	return false
}
