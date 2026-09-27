package api

import (
	"os"
	"time"

	"tempmail/internal/config"
	"tempmail/internal/db"
	"tempmail/internal/realtime"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// New builds the Gin engine with all routes wired.
// hub may be nil to disable the realtime endpoint.
func New(cfg *config.Config, m *db.PG, rdb *redis.Client, hub *realtime.Hub) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())

	r.Use(cors.New(cors.Config{
		AllowOrigins: cfg.FrontendURLs,
		AllowMethods: []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "X-API-Key"},
		MaxAge:       12 * time.Hour,
	}))

	h := &handlers{cfg: cfg, m: m, rdb: rdb, hub: hub}

	r.GET("/health", h.Health)

	api := r.Group("/api", RateLimitAPI(rdb, cfg), APIKeyAuth(m, cfg))
	{
		api.GET("/generate-email", h.GenerateEmail)
		api.POST("/generate-email", RateLimitStrict(rdb, cfg), h.GenerateEmail)

		api.GET("/emails", h.ListEmails)
		api.GET("/email/:id", h.GetEmail)
		api.DELETE("/email/:id", h.DeleteEmail)
		api.DELETE("/emails/clear", h.ClearEmails)

		api.GET("/stats", h.Stats)
		api.GET("/statistics/24h", h.Statistics24h)
		api.GET("/statistics/top-subjects", h.TopSubjects)
		api.GET("/statistics/top-domains", h.TopDomains)
		api.GET("/statistics/top-senders", h.TopSenders)

		api.GET("/domains", h.ListDomains)
		api.GET("/domains/status", h.DomainStatus)
		api.POST("/domains/register", RateLimitStrict(rdb, cfg), h.RegisterDomain)
		api.POST("/domains/verify", RateLimitStrict(rdb, cfg), h.VerifyDomain)
	}
	if hub != nil {
		r.Any("/socket.io/*path", gin.WrapH(hub.Handler()))
	}

	// Single-image mode: serve the built SPA + runtime /config.js when present.
	RegisterStatic(r, getenv("TEMPMAIL_STATIC_DIR", "./dist"))

	return r
}

// Envelope helpers.
func ok(c *gin.Context, data gin.H) {
	c.JSON(200, gin.H{"success": true, "data": data})
}

func fail(c *gin.Context, status int, msg string) {
	c.AbortWithStatusJSON(status, gin.H{"success": false, "error": msg})
}

// iso formats timestamps per the frontend contract: 2026-08-31T10:24:19.000Z
func iso(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

// isoPtr formats an optional timestamp; nil becomes JSON null.
func isoPtr(t *time.Time) any {
	if t == nil {
		return nil
	}
	return iso(*t)
}
