# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# tempmail — single-image dev. Builds the frontend once, then runs the Go
# backend with go-run so code edits to backend restart fast; for hot-reload
# frontend work prefer the separate Vite dev server instead (see compose).
#
#   docker build -f docker/dev/Dockerfile -t tempmail:dev .
#   docker run -p 8080:8080 -p 2525:2525 \
#     -e TEMPMAIL_POSTGRES_URL=postgres://user:pass@host.docker.internal:5432/tempmail?sslmode=disable \
#     tempmail:dev
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.26rc1-alpine
WORKDIR /app/backend
ENV GOTOOLCHAIN=auto
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/backend/dist

ENV TEMPMAIL_PORT=8080 \
    TEMPMAIL_SMTP_PORT=2525 \
    TEMPMAIL_STATIC_DIR=/app/backend/dist \
    TEMPMAIL_APP_ENV=development

EXPOSE 8080 2525
# go run keeps it simple for dev; rebuild on backend change via container restart.
CMD ["go", "run", "./cmd/server"]
