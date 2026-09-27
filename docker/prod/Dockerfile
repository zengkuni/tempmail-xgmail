# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# tempmail — single production image (frontend + backend + SMTP in one).
#
#   docker build -f docker/prod/Dockerfile -t tempmail:latest .
#   docker run -p 8080:8080 -p 2525:2525 \
#     -e TEMPMAIL_POSTGRES_URL=... -e TEMPMAIL_REDIS_URL=... \
#     -e TEMPMAIL_BRAND=mybrand -e TEMPMAIL_MX=email.example.com \
#     tempmail:latest
#
# The frontend bundle is built once, then served by the Go backend (Gin) which
# also exposes the REST API, Socket.IO realtime, and the SMTP receiver. Brand
# and MX are runtime env (rendered into /config.js), so one pushed image serves
# any brand without a rebuild.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build the Vite SPA ──
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: build the Go backend ──
FROM golang:1.26rc1-alpine AS backend
WORKDIR /app/backend
# go.mod requires go 1.26.0; the rc1 base is older, so let Go fetch the exact
# stable toolchain automatically instead of failing on the version check.
ENV GOTOOLCHAIN=auto
# Cache deps first.
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
# The binary serves the SPA from TEMPMAIL_STATIC_DIR (default ./dist) at runtime.
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/tempmail ./cmd/server

# ── Stage 3: minimal runtime ──
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

COPY --from=backend /out/tempmail /app/tempmail
COPY --from=frontend /app/frontend/dist /app/dist

# HTTP (SPA + API + Socket.IO) and SMTP.
ENV TEMPMAIL_PORT=8080 \
    TEMPMAIL_SMTP_PORT=2525 \
    TEMPMAIL_STATIC_DIR=/app/dist \
    TEMPMAIL_APP_ENV=production
# Brand/MX are intentionally left empty here; set them per-deploy:
#   TEMPMAIL_BRAND, TEMPMAIL_MX

EXPOSE 8080 2525
ENTRYPOINT ["/app/tempmail"]
