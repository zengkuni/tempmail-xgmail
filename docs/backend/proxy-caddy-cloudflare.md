# Production: Caddy reverse proxy + Cloudflare DNS proxy

Prod stack (`docker/prod/docker-compose.yaml`) has four services:

| Service | Role |
|---|---|
| `app` | single image: SPA + Go API (`:8080`) + SMTP receiver (`:2525`) |
| `caddy` | TLS termination + reverse proxy → `app:8080` |
| `postgres` | database (schema auto-created at boot) |
| `valkey` | Redis-compatible queue/cache |

## Why a custom Caddy image

`caddy:2` does not ship the Cloudflare DNS provider, needed for ACME DNS-01
challenge (works with Cloudflare proxying on, where HTTP-01 :80 is blocked).
`docker/prod/caddy.Dockerfile` builds it with `xcaddy`:

```dockerfile
FROM caddy:2-builder AS build
RUN xcaddy build --with github.com/caddy-dns/cloudflare
FROM caddy:2
COPY --from=build /usr/bin/caddy /usr/bin/caddy
```

Built locally by compose (`docker compose ... up -d --build`); no registry push
needed. Rebuild after Caddyfile edits: not needed (mounted), but after
`caddy.Dockerfile` changes run `up -d --build caddy`.

## Caddyfile (`docker/prod/Caddyfile`)

```
{
  # ACME contact (has a safe default → parses fine when unset).
  email {$CADDY_ACME_EMAIL:admin@example.com}
}
{$CADDY_SITE_DOMAIN:http://localhost} {
  tls {
    dns cloudflare {$CADDY_CLOUDFLARE_API_TOKEN:unset}
  }
  encode zstd gzip
  reverse_proxy app:8080
}
```

Caddy reads its three keys from the container environment with a `CADDY_`
prefix (not `TEMPMAIL_`) — they are Caddy's own site/ACME settings, not app
settings. Compose fills them from `.env.prod` (`--env-file .env.prod`).
Verified with `caddy adapt`:

- **env unset** → site `http://localhost`, `listen [":80"]`, **no TLS app**:
  a fresh `up` without DNS/Cloudflare serves plain HTTP — no ACME attempt,
  no token needed, Caddy still boots.
- **env set** (`CADDY_SITE_DOMAIN` + token) → site `<domain>` on `:443` with
  `tls` automation: ACME DNS-01 via the Cloudflare provider, contact email set.


The `:unset` placeholder default only exists so the token line parses when
the variable is empty; on an `http://` site the whole `tls` block is inert,
so the dummy value is never used. Certificates persist in the `caddy-data`
volume — DNS-01 renews automatically, no downtime.

**Hardening:** the app does not publish `8080` to the host — Caddy
(`app:8080` in-stack) is the only public HTTP entry, so Cloudflare/TLS
cannot be bypassed. Only `25`/`2525` (SMTP) stay host-published.

## Cloudflare setup

1. **DNS records** for the site domain (`CADDY_SITE_DOMAIN`):
   - `A`/`AAAA` `<domain>` → origin server IP, **proxy ON** (orange cloud).
   - `A` `email.<domain>` → same IP, **DNS only** (grey) — this is the SMTP
     target (`TEMPMAIL_MX_TARGET`). MX record → `email.<domain>`.
     Cloudflare does not proxy SMTP; a proxied mail record breaks intake.
2. **SSL/TLS mode**: *Full (strict)* (edge→origin TLS, Caddy cert at origin).
3. **API token** (dash → My Profile → API Tokens → Create Token → custom):
   permissions `Zone → DNS → Edit`, zone resources = the site's zone only.
   Put it in `.env.prod` as `CADDY_CLOUDFLARE_API_TOKEN`.
4. **Firewall on the origin**: inbound `80/tcp`, `443/tcp` (Caddy) and
   `25/tcp` (SMTP to `app`). `2525` stays optional.

## `.env.prod` keys

| Key | Purpose | Consumer |
|---|---|---|
| `CADDY_SITE_DOMAIN` | public origin (Caddy site address) | Caddy |
| `CADDY_ACME_EMAIL` | Let's Encrypt contact | Caddy |
| `CADDY_CLOUDFLARE_API_TOKEN` | DNS-01 challenge credentials | Caddy |
| `TEMPMAIL_SITE_DOMAIN` | public origin (links, CORS) | app |
| `TEMPMAIL_MX_TARGET` | must be the DNS-only `email.<domain>` host | app |

The `CADDY_*` keys are Caddy's own settings (site address + ACME) — kept
separate from the app's `TEMPMAIL_*` keys so each layer's env stays clear.

## Deploy

```bash
docker compose --env-file .env.prod -f docker/prod/docker-compose.yaml up -d --build
# logs: docker compose -f docker/prod/docker-compose.yaml logs -f caddy
```

## Troubleshooting

- `no credentials ... acme_dns` → token empty or lacks Zone:DNS:Edit.
- Certificate issued for the wrong zone → `CADDY_SITE_DOMAIN` mismatch.
- SMTP not receiving mail → MX must target a **DNS-only** record; CF proxy
  (orange) on the mail host silently drops port 25.
- HTTP 502 → `app` not healthy; check `logs -f app` (Postgres/Redis env).
