// Package queue: asynq worker + scheduler (in-process, Valkey-backed).
package queue

import (
	"context"
	"log"
	"time"

	"tempmail/internal/config"
	"tempmail/internal/db"
	"tempmail/internal/dnsx"
	"tempmail/internal/rdapx"
	"tempmail/internal/realtime"

	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
)

const (
	TaskCleanupPurge = "cleanup:purge"
	TaskMXRefresh    = "domains:mx-refresh"
	TaskMXSweep      = "domains:mx-sweep"
	TaskRDAPRefresh  = "domains:rdap-refresh"
)

// Start runs the asynq server + cron scheduler (blocking); call in a goroutine.
func Start(cfg *config.Config, m *db.PG, rdb *redis.Client, hub *realtime.Hub) error {
	redisOpt := asynq.RedisClientOpt{Addr: cfg.RedisAddr, Username: cfg.RedisUsername, Password: cfg.RedisPassword, DB: cfg.RedisDB}

	mux := asynq.NewServeMux()
	mux.HandleFunc(TaskCleanupPurge, func(ctx context.Context, t *asynq.Task) error {
		return cleanupPurge(ctx, m)
	})
	mux.HandleFunc(TaskMXRefresh, func(ctx context.Context, t *asynq.Task) error {
		return mxRefresh(ctx, cfg, m, rdb, hub)
	})
	mux.HandleFunc(TaskMXSweep, func(ctx context.Context, t *asynq.Task) error {
		return mxSweep(ctx, cfg, m, rdb, hub)
	})
	mux.HandleFunc(TaskRDAPRefresh, func(ctx context.Context, t *asynq.Task) error {
		return rdapRefresh(ctx, cfg, m, rdb, hub)
	})

	srv := asynq.NewServer(redisOpt, asynq.Config{Concurrency: 4})
	scheduler := asynq.NewScheduler(redisOpt, &asynq.SchedulerOpts{})
	if _, err := scheduler.Register("@hourly", asynq.NewTask(TaskCleanupPurge, nil)); err != nil {
		return err
	}
	if _, err := scheduler.Register("@every "+cfg.MXRefreshInterval.String(), asynq.NewTask(TaskMXRefresh, nil)); err != nil {
		return err
	}
	if _, err := scheduler.Register("@every "+cfg.MXSweepInterval.String(), asynq.NewTask(TaskMXSweep, nil)); err != nil {
		return err
	}
	if _, err := scheduler.Register("@every "+cfg.RDAPRefreshInterval.String(), asynq.NewTask(TaskRDAPRefresh, nil)); err != nil {
		return err
	}
	go func() {
		if err := scheduler.Run(); err != nil {
			log.Printf("queue: scheduler stopped: %v", err)
		}
	}()
	log.Printf("queue: worker started (%s @hourly, %s @every %s, %s @every %s, %s @every %s)", TaskCleanupPurge, TaskMXRefresh, cfg.MXRefreshInterval, TaskMXSweep, cfg.MXSweepInterval, TaskRDAPRefresh, cfg.RDAPRefreshInterval)
	return srv.Run(mux)
}

// cleanupPurge deletes expired inboxes and their emails (mirrors the reference BullMQ job).
func cleanupPurge(ctx context.Context, m *db.PG) error {
	now := time.Now().UTC()

	expired, err := m.ExpiredInboxAddresses(ctx, now)
	if err != nil {
		return err
	}
	if n, err := m.PurgeEmailsByInboxes(ctx, expired); err != nil {
		log.Printf("queue: purge emails for %d inboxes failed: %v", len(expired), err)
	} else if n > 0 {
		log.Printf("queue: purged %d emails of %d expired inboxes", n, len(expired))
	}
	if res, err := m.PurgeExpiredInboxes(ctx, now); err == nil && res > 0 {
		log.Printf("queue: purged %d expired inboxes", res)
	}
	// Orphaned/self-expired emails (inbox never generated or already gone).
	// PostgreSQL has no TTL index — this job is the sole expiry enforcer.
	if res, err := m.PurgeExpiredEmails(ctx, now); err == nil && res > 0 {
		log.Printf("queue: purged %d expired emails", res)
	}
	return nil
}

// mxRefresh re-verifies active domains against TEMPMAIL_MX_TARGET, refreshing the cache.
// Non-default domains whose MX goes invalid are deactivated and handed to mxSweep
// (grace anchor: mxInvalidSince) for eventual deletion.
func mxRefresh(ctx context.Context, cfg *config.Config, m *db.PG, rdb *redis.Client, hub *realtime.Hub) error {
	domains, err := m.ListDomainsForRefresh(ctx)
	if err != nil {
		return err
	}
	for _, d := range domains {
		valid, _, _, err := dnsx.CheckMX(ctx, rdb, cfg, d.Name, true)
		if err != nil {
			log.Printf("queue: MX refresh %s failed: %v", d.Name, err)
			continue
		}
		now := time.Now().UTC()
		var anchor *time.Time
		if !valid && !d.IsDefault && d.MxInvalidSince == nil {
			anchor = &now
		}
		m.SetDomainMXState(ctx, d.Name, valid, now, anchor)
		// Emit hanya saat status berubah: baru invalid, atau pulih dari invalid.
		changed := (!valid && !d.IsDefault) || (valid && d.MxInvalidSince != nil)
		if hub != nil && changed {
			hub.EmitDomainUpdated(realtime.DomainPayload{Name: d.Name, MxVerified: valid, Active: valid || d.IsDefault})
		}
	}
	return nil
}

// mxSweep re-checks pending (mxVerified=false) non-default domains. The first
// invalid observation sets mxInvalidSince (grace anchor); deletion only happens
// when a LATER sweep (>= cfg.DomainMXGrace after the anchor) still finds the MX
// invalid, so a domain is always re-checked before being removed.
func mxSweep(ctx context.Context, cfg *config.Config, m *db.PG, rdb *redis.Client, hub *realtime.Hub) error {
	domains, err := m.ListDomainsForSweep(ctx)
	if err != nil {
		return err
	}
	for _, d := range domains {
		valid, _, _, err := dnsx.CheckMX(ctx, rdb, cfg, d.Name, true)
		if err != nil {
			// DNS outage: skip — jangan hapus domain karena false negative.
			log.Printf("queue: MX sweep %s failed: %v", d.Name, err)
			continue
		}
		now := time.Now().UTC()
		if valid {
			anchor := &now
			m.SetDomainMXState(ctx, d.Name, true, now, anchor)
			if hub != nil {
				hub.EmitDomainUpdated(realtime.DomainPayload{Name: d.Name, MxVerified: true, Active: true})
			}
			continue
		}
		// Anchor penghapusan: mxInvalidSince (observasi invalid pertama).
		// Jika belum ada (domain baru / belum pernah diverifikasi), set SEKARANG
		// lalu continue — domain tidak dihapus pada observasi pertama. Penghapusan
		// hanya terjadi bila sweep BERIKUTNYA (>= grace kemudian) masih menemukan
		// invalid: "dicek dulu lagi, kalau benar-benar invalid baru hapus".
		if d.MxInvalidSince == nil {
			m.SetDomainMXInvalidSince(ctx, d.Name, now)
			log.Printf("queue: MX sweep %s first-invalid, grace %s starts", d.Name, cfg.DomainMXGrace)
			continue
		}
		if now.Sub(*d.MxInvalidSince) < cfg.DomainMXGrace {
			continue
		}
		if err := m.DeleteDomain(ctx, d.Name); err != nil {
			log.Printf("queue: MX sweep delete %s failed: %v", d.Name, err)
			continue
		}
		log.Printf("queue: MX sweep deleted %s (invalid since %s, grace %s exceeded)", d.Name, d.MxInvalidSince.Format(time.RFC3339), cfg.DomainMXGrace)
		if hub != nil {
			hub.EmitDomainRemoved(d.Name)
		}
	}
	return nil
}

// rdapRefresh mengecek status registry semua domain non-default via RDAP.
// Domain yang registrasinya sudah expired dihapus (dengan emit realtime);
// error registry dilewati tanpa menghapus (false-negative guard, sama seperti
// mxSweep). Status string saja tidak memicu penghapusan — hanya expiry date.
func rdapRefresh(ctx context.Context, cfg *config.Config, m *db.PG, rdb *redis.Client, hub *realtime.Hub) error {
	domains, err := m.ListDomainsForRDAP(ctx)
	if err != nil {
		return err
	}
	for _, d := range domains {
		info, err := rdapx.CheckRegistry(ctx, rdb, cfg, d.Name, false)
		if err != nil {
			// Registry outage: skip — jangan hapus domain karena false negative.
			log.Printf("queue: RDAP check %s failed: %v", d.Name, err)
			continue
		}
		now := time.Now().UTC()
		if info.ExpiresAt != nil && info.ExpiresAt.Before(now) {
			if err := m.DeleteDomain(ctx, d.Name); err != nil {
				log.Printf("queue: RDAP refresh delete %s failed: %v", d.Name, err)
				continue
			}
			log.Printf("queue: RDAP refresh deleted %s (expired %s)", d.Name, info.ExpiresAt.Format(time.RFC3339))
			if hub != nil {
				hub.EmitDomainRemoved(d.Name)
			}
			continue
		}
		m.SetDomainRegistry(ctx, d.Name, info.Status, info.ExpiresAt)
	}
	return nil
}
