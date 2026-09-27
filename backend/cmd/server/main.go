// tempmail server: HTTP API (Gin) + SMTP receiver (go-smtp) + worker (asynq).
package main

import (
	"context"
	"log"
	"time"

	"tempmail/internal/api"
	"tempmail/internal/config"
	"tempmail/internal/db"
	"tempmail/internal/dnsx"
	"tempmail/internal/queue"
	"tempmail/internal/realtime"
	"tempmail/internal/smtpserver"
)

func main() {
	cfg := config.Load()

	// Pool resolver dinamis (round-robin + fallback); refresh berkala dari URL.
	// Gagal fetch tidak fatal — fallback ke TEMPMAIL_DNS_RESOLVERS statis.
	dnsx.StartResolverRefresher(context.Background(), cfg)

	// PostgreSQL: connect, ensure schema, seed.
	m, err := db.ConnectPostgres(cfg.PostgresURL)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	log.Println("postgres connected")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	if err := m.EnsureSchema(ctx); err != nil {
		log.Fatalf("postgres schema: %v", err)
	}
	if err := m.Seed(ctx, cfg); err != nil {
		log.Fatalf("postgres seed: %v", err)
	}
	cancel()

	// Valkey: required for rate limits + MX cache; worker is optional on top.
	rdb, err := db.ConnectRedis(cfg.RedisAddr, cfg.RedisUsername, cfg.RedisPassword, cfg.RedisDB)
	if err != nil {
		log.Printf("valkey unavailable (%v) — continuing without cache/rate-limit backend", err)
	} else {
		log.Println("redis connected")
	}

	// Realtime hub (Socket.IO) shared by SMTP intake and HTTP.
	hub := realtime.New(cfg.FrontendURLs)

	// SMTP receiver.
	go func() {
		if err := smtpserver.Start(cfg, m, hub); err != nil {
			log.Fatalf("smtp: %v", err)
		}
	}()

	// Background worker (cleanup + MX refresh); only when Valkey is up.
	if rdb != nil {
		go func() {
			if err := queue.Start(cfg, m, rdb, hub); err != nil {
				log.Printf("queue: %v", err)
			}
		}()
	}

	// HTTP API.
	router := api.New(cfg, m, rdb, hub)
	log.Printf("HTTP listening :%s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("http: %v", err)
	}
}
