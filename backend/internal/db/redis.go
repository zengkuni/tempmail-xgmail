package db

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// ConnectRedis creates a go-redis client and pings it (no password in dev).
func ConnectRedis(addr, username, password string, dbIndex int) (*redis.Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Username: username,
		Password: password,
		DB:       dbIndex,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}
	return rdb, nil
}
