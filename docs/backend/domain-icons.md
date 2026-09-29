# Sender-domain icons via BIMI + selfh.st SVG fallback

## Overview

Each email in the inbox shows the sender's brand icon. Icons are resolved in
this order and cached in Postgres:

1. **BIMI** DNS record (`default._bimi.<domain>` TXT → `l=` logo URL → logo
   bytes).
2. **Favicon fallback** — SVG from the **selfh.st** catalog via faviconapi.com:
   `https://faviconapi.com/selfhst/0/svg/<name>` (returns `image/svg+xml`).
   The catalog is keyed by slug without TLD (`jellyfin`, not `jellyfin.org`),
   so the sender domain is queried with its last label stripped.
3. **UI letter fallback** — first initial of the sender name.

Every icon is downloaded at most once: each resolution (positive or negative)
is persisted to `domain_icons` and all later requests are DB reads. Flow is
lazy: nothing is fetched on SMTP intake.

Provider notes: selfh.st is a self-hosted-software icon catalog, so the
fallback only hits for sender domains whose service name exists in it (e.g.
`jellyfin.org` → `jellyfin`); everything else gets a 404/502 and falls back
to the letter. Other faviconapi routes exist (PNG root route `/<domain>`,
Brandfetch `/brandfetch/0/svg/<domain>`) but the icon source is selfh.st SVG
per the product decision.

## Table

`domain_icons` (created by `EnsureSchema`, `internal/db/postgres.go`):

| column       | type        | notes                                              |
|--------------|-------------|----------------------------------------------------|
| domain       | TEXT PK     | lowercased sender domain, e.g. `ebay.com`          |
| content_type | TEXT        | served `Content-Type` (default `image/svg+xml`)    |
| data         | BYTEA NULL  | icon bytes; `NULL` = negative cache (no icon)      |
| fetched_at   | TIMESTAMPTZ | insert/refresh time; drives the negative TTL       |

## Endpoint

`GET /api/domain-icons/:domain` (inside the authenticated `api` group:
`RateLimitAPI` + `APIKeyAuth`, same browser-fallback contract as the rest of
the SPA — no key in the bundle).

1. Validate/normalize `:domain` (lowercase, strict hostname regex). Invalid →
   `400` via the standard `fail()` envelope.
2. DB read.
   - Positive row → serve bytes with the stored `content_type`.
   - Negative row (`data IS NULL`) younger than 24 h → `404` (empty body).
   - Otherwise continue (miss, or stale negative entry).
3. Whole resolution is bounded by `iconResolutionTimeout` (5 s).
4. `dnsx.LookupBIMI(ctx, cfg, domain)`:
   - TXT query `default._bimi.<domain>` over the configured resolver pool
     (`pickResolvers` + `cfg.DNSLookupTimeout`).
   - Record parsing (`parseBIMILogoURL`): `;`-separated key/value, keys
     case-insensitive, **`v=BIMI1` required**, `l=` must be non-empty and
     **`https://` only** (BIMI spec requirement; also an SSRF guard — plain
     HTTP, private hosts, and other schemes never reach the HTTP client).
   - NXDOMAIN / no usable record → not ok, no error → favicon fallback.
5. BIMI record present → `fetchLogo` on the `l=` URL:
   - Success → persist positive row → serve.
   - **Definitive** failure (host refused, oversize, disallowed type, SSRF
     block) → favicon fallback (BIMI logo exists but is unusable).
   - **Transient** failure (timeout, connection error) → `404`, nothing
     persisted, BIMI remains the preferred source for the next attempt.
6. Favicon fallback → `fetchLogo` on the fixed `faviconAPIBase + name` URL
   (single public host; name = domain with the last label stripped). No SSRF
   expansion beyond that host, all `fetchLogo` guards still apply.
   - Success → persist positive row → serve (`image/svg+xml`).
   - Definitive failure (404, 502 = not in the selfh.st catalog, disallowed
     type) → persist negative row → `404` → UI letter fallback.
   - Transient failure (timeout, connection error, 429 rate-limit) → `404`,
     nothing persisted.
7. `fetchLogo` details: GET with `User-Agent: tempmail-xgmail/1.0`,
   `cfg.DomainIconTimeout`; requires 200; body capped at
   `cfg.DomainIconMaxBytes` via `io.LimitReader` (oversize = error, no
   persistence). `Content-Type` from the response header (first `;` segment),
   fallback `image/svg+xml`.
8. Persistence failures (`SaveDomainIcon`, `ON CONFLICT (domain) DO UPDATE`)
   are logged only — icons still serve even if the DB write fails. Success →
   `200` with `Cache-Control: public, max-age=86400`, `X-Content-Type-Options:
   nosniff` and `Content-Security-Policy: default-src 'none'; style-src
   'unsafe-inline'; sandbox` (attacker-controlled bytes are served from our
   origin) and raw bytes via `c.Data` (not the JSON envelope).

### Definitive vs transient

- **Definitive** → negative row (24 h TTL): no BIMI record; logo fetch
  host-refused / oversize / disallowed type; guard rejection — blocked IP at
  dial or redirect, non-https redirect hop, or >3-hop chain
  (`errBlockedTarget`, matched via `errors.Is` through the `*url.Error`
  wrapper of `client.Do`); favicon 404/502 (not in catalog).
- **Transient** → nothing persisted, retried on the next request: BIMI
  resolver failure; logo/favicon timeout or connection error; favicon 429.

### SSRF guards (both fetch paths)

- `guardedDialContext`: resolves the host, blocks the dial if **any** resolved
  IP is `isBlockedIP` (loopback/private/ULA/link-local/CGNAT/multicast/
  unspecified/0.0.0.0-8/240.0.0.0-255.255.255.255/192.0.0.0/24/198.18.0.0/15/
  198.51.100.0/24/192.0.2.0/24/203.0.113.0/24 + IPv6 `fc00::/7`), then dials
  the **validated** IP — DNS rebinding cannot redirect the fetch to an
  internal host. A blocked dial returns `errBlockedTarget`.
- `CheckRedirect`: max 3 hops, https-only, every redirect host re-resolved and
  re-validated against `isBlockedIP` (also returns `errBlockedTarget`).
- Content-type allowlist (`image/svg+xml|image/png|image/jpeg|image/jpg`) and
  size cap from config.

## Env

| key                          | default   | meaning                             |
|------------------------------|-----------|-------------------------------------|
| `TEMPMAIL_DOMAIN_ICON_TIMEOUT`   | `5s`      | HTTP timeout for one logo download |
| `TEMPMAIL_DOMAIN_ICON_MAX_BYTES` | `131072`  | max logo size (128 KiB)            |

Both live in `backend/.env.example`; no entry needed in `.env.dev`/`.env.prod`
unless overriding the defaults.

## Frontend

- `use-inbox.ts`: `senderDomain(from)` parses the sender address; `toMock`
  maps it onto `MockEmail.senderDomain`.
- `InboxPanel.tsx` `SenderIcon`: `Avatar` (rounded-square tile, 10 px radius,
  modern violet gradient wash `from-violet-500/20 to-violet-500/5` — the app's
  accent hue, alpha-tinted so it works in light and dark) + `AvatarImage
  src={BASE_URL}/api/domain-icons/<domain>}` (`rounded-lg object-contain p-1`,
  so the brand mark keeps its whole artwork inside the tile); `AvatarFallback`
  = first initial of the sender name (`rounded-lg`, violet text). Missing
  domain → the same rounded-square gradient tile with the initial.
- The email detail dialog uses the same `SenderIcon` (brand icon) in its
  header instead of a generic mail glyph.

ReUI's catalog has **no avatar component** — only 35 free `c-avatar-*`
examples under the "Avatar" category. The repo already contains the
`avatar` registry dependency that `c-avatar-2` ("Avatar with fallback")
declares: `frontend/src/components/ui/avatar.tsx` (Base-UI `Avatar` /
`AvatarImage` / `AvatarFallback`). That existing component is reused; nothing
was installed or hand-rolled.

Both mobile dialogs (Identity, Inbox detail) share the same mobile width: the
Identity dialog caps at `sm:max-w-[420px]` so below `sm` it falls back to the
shared `DialogContent` gutter width, matching the inbox dialog exactly (348 px
at a 390 px viewport).

## Verified behavior (dev stack, 2026-09-29)

- BIMI positives: `tiktok.com` → `200 image/svg+xml` 1643 B; 2nd request
  served from DB (3 ms).
- selfh.st SVG fallback (no BIMI record): `jellyfin.org` → `200
  image/svg+xml` 944 B (name stripped to `jellyfin`); 2nd request from DB
  (3.1 ms). `github.com` → 200 via the same route (822 B).
- Out-of-catalog domain → `404`, negative row with `data IS NULL`; re-request
  inside the 24 h TTL returns `404` without any upstream call.
- 200 responses carry `X-Content-Type-Options: nosniff` and the sandbox CSP.
- Browser at 1280×900: hero `[16,128,505,442]`, byod `[16,602,505,473]`,
  stack `[577,128,727,947]` — byte-identical to the frozen baseline; rows
  87 px, icon images loaded, 10 px tile radius, violet gradient computed
  background. At 390×844: Identity dialog and inbox dialog are both 348 px
  wide; no horizontal overflow.
