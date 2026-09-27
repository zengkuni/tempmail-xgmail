package api

import (
	"context"
	"log"
	"regexp"
	"strings"
	"time"

	"tempmail/internal/dnsx"
	"tempmail/internal/rdapx"
	"tempmail/internal/realtime"

	"github.com/gin-gonic/gin"
)

// --- domains --------------------------------------------------------------

var domainFormat = regexp.MustCompile(`^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$`)

func (h *handlers) ListDomains(c *gin.Context) {
	rows, err := h.m.ListDomainRows(c.Request.Context(), c.Query("all") != "1")
	if err != nil {
		fail(c, 500, "failed to list domains")
		return
	}

	domains := []gin.H{}
	for _, d := range rows {
		domains = append(domains, gin.H{
			"name":                d.Name,
			"is_default":          d.IsDefault,
			"is_active":           d.IsActive,
			"mx_verified":         d.MxVerified,
			"usage_count":         d.UsageCount,
			"created_at":          iso(d.CreatedAt),
			"registry_status":     d.RegistryStatus,
			"registry_expires_at": isoPtr(d.RegistryExpiresAt),
		})
	}
	ok(c, gin.H{"domains": domains})
}

func (h *handlers) DomainStatus(c *gin.Context) {
	name := strings.ToLower(strings.TrimSpace(c.Query("name")))
	if name == "" {
		fail(c, 400, "name query parameter required")
		return
	}
	d, err := h.m.FindDomainByName(c.Request.Context(), name)
	if err != nil {
		ok(c, gin.H{"domain": name, "registered": false, "active": false, "mx_verified": false})
		return
	}
	ok(c, gin.H{"domain": name, "registered": true, "active": d.IsActive, "mx_verified": d.MxVerified})
}

type domainBody struct {
	Domain string `json:"domain"`
}

func (h *handlers) RegisterDomain(c *gin.Context) {
	var body domainBody
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, 400, "domain required")
		return
	}
	domain := strings.ToLower(strings.TrimSpace(body.Domain))
	if !domainFormat.MatchString(domain) {
		fail(c, 400, "invalid domain format")
		return
	}
	if h.m.DomainExists(c.Request.Context(), domain) {
		fail(c, 409, "domain already registered")
		return
	}
	if err := h.m.InsertDomain(c.Request.Context(), domain); err != nil {
		fail(c, 500, "failed to register domain")
		return
	}
	if h.hub != nil {
		h.hub.EmitDomainUpdated(realtime.DomainPayload{Name: domain, MxVerified: false, Active: false})
	}
	// Fetch registry expiry langsung agar kolom Expires terisi tanpa menunggu
	// siklus rdap-refresh (24 jam). Async + best-effort: kegagalan hanya log,
	// response tidak diblokir. Context lepas dari request (c.Request.Context()
	// mati saat handler return).
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), h.cfg.DNSLookupTimeout+5*time.Second)
		defer cancel()
		info, err := rdapx.CheckRegistry(ctx, h.rdb, h.cfg, domain, false)
		if err != nil {
			log.Printf("api: RDAP check %s failed: %v", domain, err)
			return
		}
		h.m.SetDomainRegistry(context.Background(), domain, info.Status, info.ExpiresAt)
	}()
	ok(c, gin.H{"domain": domain, "registered": true, "mx_target": h.cfg.MXTarget})
}

func (h *handlers) VerifyDomain(c *gin.Context) {
	var body domainBody
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, 400, "domain required")
		return
	}
	domain := strings.ToLower(strings.TrimSpace(body.Domain))
	if !domainFormat.MatchString(domain) {
		fail(c, 400, "invalid domain format")
		return
	}

	valid, records, cacheHit, err := dnsx.CheckMX(c.Request.Context(), h.rdb, h.cfg, domain, false)
	if cacheHit {
		c.Header("X-MX-Cache", "hit")
	} else {
		c.Header("X-MX-Cache", "miss")
	}
	if err != nil {
		fail(c, 502, "MX lookup failed")
		return
	}

	if valid {
		now := time.Now().UTC()
		h.m.UpsertDomainVerified(c.Request.Context(), domain, now)
		if h.hub != nil {
			h.hub.EmitDomainUpdated(realtime.DomainPayload{Name: domain, MxVerified: true, Active: true})
		}
	}
	ok(c, gin.H{
		"domain":      domain,
		"mx_verified": valid,
		"records":     records,
		"mx_target":   h.cfg.MXTarget,
	})
}
