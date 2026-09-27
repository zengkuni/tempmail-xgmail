# API Request Flow

Base URL dev: `http://localhost:5001`. All responses use the envelope `{ "success": bool, "data": {...} }`; failures use `{ "success": false, "error": "<message>" }` with a non-2xx status.

## Middleware chain (per /api/* request)

1. CORS (`gin-contrib/cors`, allow `TEMPMAIL_FRONTEND_URL`, default `http://localhost:5173`, plus same-origin curl: no Origin header passes).
2. API rate limiter — Valkey fixed window, key `tempmail-xgmail:rl:api:<ip>`, 300 req / 15 min / IP. Exceeded → `429 {"success":false,"error":"too many requests"}`.
3. API key auth — header `X-API-Key` (or `?api_key=`); lookup `apikeys` by `key` where `is_active`; missing/unknown → `401 {"success":false,"error":"invalid or missing API key"}`.
4. Strict limiter on creation endpoints (`generate-email`, `domains/register`, `domains/verify`) — key `tempmail-xgmail:rl:strict:<ip>`, 20 req / min / IP.
5. Handler → Postgres/Redis → envelope response.

## Endpoints (contract from frontend API docs)

| Method | Path | Body / query | `data` payload |
|---|---|---|---|
| GET | `/health` | — | `{ "status": "ok" }` (no envelope fields beyond this, no API key required) |
| GET | `/api/generate-email` | — | `{ "email": "<rand6-8>@<random active domain>", "created_at": ISO }` |
| POST | `/api/generate-email` | `{ "prefix": "demo", "domain": "yopmail.com"? }` | `{ "email": "demo@<domain>", "created_at": ISO }` — `domain` omitted → random active domain; unknown/inactive domain → `400 "domain not supported"`; `prefix` sanitized to `[a-z0-9._-]` (empty after sanitize → random) |
| GET | `/api/emails?email=<addr>` | — | `{ "email", "count", "emails": [{ "id", "from", "subject", "received_at" }] }` newest first, max 50 |
| GET | `/api/email/{id}` | — | `{ "id", "from", "to", "subject", "received_at", "text", "html", "headers": { "<lower-name>": "<value>" } }`; marks `isRead`; unknown id → `404 "email not found"` |
| DELETE | `/api/email/{id}` | — | `{ "deleted": true, "id" }`; unknown id → `404` |
| DELETE | `/api/emails/clear?email=<addr>` | — | `{ "cleared": true, "email", "deleted_count": N }` |
| GET | `/api/stats` | — | `{ "total_emails": N, "total_inboxes": N, "active_domains": N, "emails_24h": N }` (live counts/aggregations) |
| GET | `/api/statistics/24h?offset=0` | `offset=0,1,2,...` | `{ "offset", "window_start", "window_end", "hours": [{ "hour": ISO, "count": N }] }` — exactly 24 hourly buckets, oldest→newest, window = `[now-(offset+1)*24h, now-offset*24h]` |
| GET | `/api/statistics/top-subjects` | — | `{ "items": [{ "value", "count" }] }` top 10 by subject |
| GET | `/api/statistics/top-domains` | — | `{ "items": [{ "value", "count" }] }` top 10 recipient domains |
| GET | `/api/statistics/top-senders` | — | `{ "items": [{ "value", "count" }] }` top 10 sender addresses |
| GET | `/api/domains` | — | `{ "domains": [{ "name", "is_default": bool }] }` active only — feeds the frontend domain dropdown |
| GET | `/api/domains/status?name=<d>` | — | `{ "domain", "registered": bool, "active": bool, "mx_verified": bool }` |
| POST | `/api/domains/register` | `{ "domain": "example.com" }` | validates format; inserts `{ isActive:false, mxVerified:false }` → `{ "domain", "registered": true, "mx_target": "<TEMPMAIL_MX_TARGET>" }`; already present → `409 "domain already registered"` |
| POST | `/api/domains/verify` | `{ "domain": "example.com" }` | MX check (see smtp-intake.md) → `{ "domain", "mx_verified": bool, "records": [...], "mx_target": "<TEMPMAIL_MX_TARGET>" }`; on success sets `mxVerified:true, isActive:true` |

## Conventions

- IDs: ULID strings (e.g. `01J8ZKX3M4WQ0B7T2N6R9H5VCD`).
- Timestamps: ISO-8601 UTC with millisecond precision, e.g. `2026-08-31T10:24:19.000Z`.
- Field names: snake_case in JSON; database columns are snake_case (`inbox_address`, `expires_at`, ...).
- Repeat `POST /api/generate-email` with an existing address returns the same inbox (upsert, refreshes `expiresAt` to now+24h, keeps original `created_at`).
