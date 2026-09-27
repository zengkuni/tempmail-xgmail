# Caddy with the Cloudflare DNS provider (for ACME DNS-01 challenges).
# Alpine runtime (smaller). The stock caddy image cannot talk to the
# Cloudflare DNS API.
FROM caddy:2-builder AS build
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2-alpine
COPY --from=build /usr/bin/caddy /usr/bin/caddy
