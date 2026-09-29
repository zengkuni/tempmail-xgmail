# Sender-domain icons via BIMI + faviconapi fallback

## Overview

Each email in the inbox shows the sender's brand icon. Icons are resolved in
this order and cached in Postgres:

1. **BIMI** DNS record (`default._bimi.<domain>` TXT → `l=` logo URL → logo
   bytes).
2. **Favicon fallback** — the **v1 JSON route** of faviconapi.com:
   `GET https://faviconapi.com/api/v1/favicon?url=<domain>` →
   `{"url": "https://faviconapi.com/cdn/favicons/<domain>.png", ...}` on a hit
   (icon bytes are a second fetch of that CDN URL) or `422
   {"error": "No favicon could be found for this URL."}` on a miss.
3. **UI letter fallback** — first initial of the sender name.

Every icon is downloaded at most once: each resolution (positive or negative)
is persisted to `domain_icons` and all later requests are DB reads. Flow is
lazy: nothing is fetched on SMTP intake.

### Root-domain normalization

`:domain` is normalized to the **registrable root** (`golang.org/x/net/
publicsuffix`, `EffectiveTLDPlusOne`) before any lookup or cache write, so
`account.tokopedia.com` and `tokopedia.com` share one row. The frontend does
the same with the `psl` package when building the icon URL.

### Title branding (frontend)

`use-inbox.ts` derives the displayed sender title: a generic local-part /
display name (`noreply`, `no-reply`, `info`, `notifications`, …) is replaced
by the brand parsed from the root domain — `tokopedia.com` → `Tokopedia`
(SLD, first letter capitalized). The sender **address** itself is never
rewritten; the dialog header reads `Tokopedia <noreply@account.tokopedia.com>`.

Provider notes: the v1 route resolves real public sites, so any registered
sender domain is a candidate; unknown/unreachable domains answer `422` →
negative row → 404 → UI letter.

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
   `400` via the standard `fail()` envelope. Then normalize to the
   registrable root via `publicsuffix.EffectiveTLDPlusOne` (fallback: the
   input itself) — all lookups and cache rows use the root.
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
6. Favicon fallback (`fetchFaviconIconURL`, single public host — no SSRF
   expansion beyond it): GET `faviconAPIBase + domain` (the root domain,
   TLD included), read a small JSON body (64 KiB cap), take `url`.
   - Hit → `fetchLogo` on the CDN URL → success persists a positive row
     (typically `image/png`, ~128 px source).
   - `422` / `{"error": ...}` / empty url → definitive miss → negative row
     → `404` → UI letter fallback.
   - Transient (timeout, connection error, DNS failure, 429, 5xx, or guard
     block via `errBlockedTarget`) → `404`, nothing persisted.
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
  wrapper of `client.Do`); favicon v1 miss (`422`, JSON error/empty url,
  unreadable body).
- **Transient** → nothing persisted, retried on the next request: BIMI
  resolver failure; logo/favicon timeout or connection error; favicon 429
  or 5xx.

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
- faviconapi v1 fallback (no BIMI record): `github.com` → `200 image/png`
  3415 B; `account.tokopedia.com` → `200 image/png` 14722 B, cached under
  the root key `tokopedia.com`, 2nd request from DB (19 ms).
- Negative cache: unknown domain (`nx-domain-xyz-9f8a7b.dev`) → `404`,
  negative row with `data IS NULL`; re-request inside the 24 h TTL returns
  `404` without any upstream call.
- Title branding: sender `noreply@account.tokopedia.com` → row title
  "Tokopedia" and dialog header "Tokopedia <noreply@account.tokopedia.com>"
  (address untouched); generic-local senders `noreply@github.com` / `noreply@
  tiktok.com` → "Github" / "Tiktok"; non-generic local parts (`deals@ebay.
  com`) stay as-is.
- 200 responses carry `X-Content-Type-Options: nosniff` and the sandbox CSP.
- Browser at 1280×900: hero `[16,128,505,442]`, byod `[16,602,505,473]`,
  stack `[577,128,727,947]` — byte-identical to the frozen baseline; rows
  87 px, icon images loaded, 10 px tile radius. At 390×844: Identity dialog
  and inbox dialog are both 348 px wide; no horizontal overflow.
