package api

import (
	"context"
	"time"

	"tempmail/internal/config"
	"tempmail/internal/db"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// APIKeyAuth validates X-API-Key (or ?api_key=) against the apikeys collection.
// Our SPA in a browser carries no key (it must never ship in the bundle); for
// those same-origin page requests we fall back to the configured public key —
// the role Caddy's server-side injection played in the old two-image setup.
// Non-browser clients (curl, scripts) send no Origin/Referer from an allowed
// host, so they are NOT granted the fallback and must pass a key explicitly.
func APIKeyAuth(m *db.PG, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader("X-API-Key")
		if key == "" {
			key = c.Query("api_key")
		}
		if key == "" {
			// No credentials: only browsers on our own site get the public key.
			if !isAllowedBrowserRequest(c, cfg.FrontendURLs) {
				fail(c, 401, "invalid or missing API key")
				return
			}
			key = cfg.PublicAPIKey
		}
		k, err := m.FindAPIKeyByKey(c.Request.Context(), key)
		if err != nil {
			fail(c, 401, "invalid or missing API key")
			return
		}
		// Async usage accounting; never block the request on it.
		go func(id string) {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			m.BumpAPIKeyUsage(ctx, id)
		}(k.ID)
		c.Next()
	}
}

// RateLimitAPI — blanket per-IP limit on all /api routes (env-tunable).
func RateLimitAPI(rdb *redis.Client, cfg *config.Config) gin.HandlerFunc {
	return rateLimit(rdb, cfg, "api", int64(cfg.RateLimitAPIMax), time.Duration(cfg.RateLimitAPIWindowMinutes)*time.Minute)
}

// RateLimitStrict — tighter per-IP limit on creation endpoints (env-tunable).
func RateLimitStrict(rdb *redis.Client, cfg *config.Config) gin.HandlerFunc {
	return rateLimit(rdb, cfg, "strict", int64(cfg.RateLimitStrictMax), time.Duration(cfg.RateLimitStrictWindowMins)*time.Minute)
}

// rateLimit is a Valkey fixed-window counter: INCR {prefix}rl:{scope}:{ip}, EXPIRE on first hit.
func rateLimit(rdb *redis.Client, cfg *config.Config, scope string, limit int64, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := cfg.RedisPrefix + "rl:" + scope + ":" + c.ClientIP()
		ctx := c.Request.Context()

		if rdb == nil {
			c.Next() // Valkey down: fail open, no rate limiting
			return
		}
		n, err := rdb.Incr(ctx, key).Result()
		if err == nil && n == 1 {
			_ = rdb.Expire(ctx, key, window).Err()
		}
		if err == nil && n > limit {
			fail(c, 429, "too many requests")
			return
		}
		c.Next()
	}
}
