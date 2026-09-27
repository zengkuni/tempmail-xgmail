# SMTP Intake & MX Verification Flow

## Inbound mail path

`Internet sender → <docker-host>:25 → app:2525 (go-smtp)`

The SMTP receiver is published directly: `docker/prod/docker-compose.yaml` maps host port 25 to the `app` service (`2525:2525` internally). No tunnel (frps/cloudflared removed). The Go service MUST be named `app` on the `tempmail-server` network.

## SMTP session (emersion/go-smtp)

- Banner/greeting: `TEMPMAIL_SMTP_GREETING` env (neutral hostname, e.g. `mail.xgmail.bond`) — big providers distrust "tempmail" banners.
- No AUTH (backend session never advertises it — MX receiver pattern, anonymous inbound).
- No STARTTLS until certs exist (same posture as the reference server).
- `MAIL FROM`: accepted, stored on session.
- `RCPT TO`: split domain; `TEMPMAIL_APP_ENV=production` → must match a `domains {name, isActive:true}` doc else reject `550 Domain not served by this MX cluster`; non-production accepts all (dev convenience).
- `DATA`: read whole message (cap 10 MB, max 5 recipients), parse, save → `250 OK`; parse/store failure → `451 Local error in processing mail`.

## Parse → store (jhillyerd/enmime)

1. Recipients: parse `To` header, first address lowercased = `inbox_address`.
2. Sender: `From` → `{address, name}` (fallback `unknown@sender.com`).
3. `subject` default `(No Subject)`; `text` = plain body; `html` = HTML body; if no HTML, `html = "<pre>"+escaped text+"</pre>"`; HTML sanitized with bluemonday UGC policy.
4. All headers into a `map[string]string` (lowercase keys, first value wins) for the API `headers` field; `messageId` extracted.
5. Attachments: metadata only (`filename, contentType, size, contentId`) — binary discarded (frontend has no attachment surface).
6. Expiry: if an `inboxes` row exists for `inbox_address` → copy its `expires_at`; else now+24h. Mail to unknown addresses is still stored (any mailbox is queryable without prior generation).
7. Insert `emails` row (ULID `id`, transactional with counter bumps); bump `inboxes.totalReceived/unreadCount` when the inbox exists.
8. Expiry enforcement: hourly asynq `cleanup:purge` deletes expired inboxes and their emails, plus orphaned/self-expired messages (sole enforcer — PostgreSQL has no TTL index).
## MX verification without rate limits

Problem: naive per-request `net.LookupMX` through the OS resolver gets throttled/fails under repeated checks.

Solution (three layers):

1. **Direct public resolvers** — `miekg/dns` UDP client querying `TEMPMAIL_DNS_RESOLVERS` (default `1.1.1.1:53,8.8.8.8:53,9.9.9.9:53`), 3 s timeout each, rotate to next on failure. Bypasses the OS resolver entirely.
2. **Valkey cache** — key `tempmail-xgmail:mx:check:<domain>` → JSON `{ "valid": bool, "records": [...] }`; TTL 1 h on success, 5 min on failure (negative caching). `POST /api/domains/verify` answers from cache first; response header `X-MX-Cache: hit|miss` for observability.
3. **Traffic shaping** — strict limiter 20 req/min/IP on the endpoint, plus an asynq `domains:mx-refresh` job every 30 min that re-verifies active domains in the background, keeping the cache warm and spreading queries over time.

A domain passes verification when any returned MX host equals `TEMPMAIL_MX_TARGET` (default `email.xgmail.bond`) after trimming the trailing dot.
