<div align="center">

# 📬 tempmail-xgmail

**Disposable mail service — generate an address, receive SMTP mail, read it via REST, everything auto-expires.**

<p>
  <img src="https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/PostgreSQL_16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Valkey-DC382D?style=for-the-badge&logo=valkey&logoColor=white" alt="Valkey">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/GHCR-181717?style=for-the-badge&logo=github&logoColor=white" alt="GHCR">
</p>

</div>

---

## 🧱 Stack

| Layer | Tech |
|---|---|
| 🎨 Frontend | Vite + React 19 + TanStack Router SPA (shadcn / ReUI components, brand via `frontend/.env` → `TEMPMAIL_BRAND`) |
| ⚙️ Backend | Go — Gin REST + Socket.IO + built-in SMTP receiver (`backend/cmd/server`) |
| 🗄️ Data | PostgreSQL 16 (`pgx` + `sqlx`, JSONB columns; schema auto-created on boot) |
| ⚡ Queue / cache | Redis / Valkey (asynq hourly purge, MX & RDAP cache, rate-limit counters) — one URL: `TEMPMAIL_REDIS_URL=redis://user:pass@host:port/db` |

📚 Deep docs: [`architecture`](docs/backend/architecture.md) · [`api-flow`](docs/backend/api-flow.md) · [`smtp-intake`](docs/backend/smtp-intake.md) · [`setup-dns`](docs/backend/setup-dns.md)

---

## 🚀 Quickstart (dev)

```bash
# 1. infra + backend in one shot (postgres + valkey + Go backend, source-mounted)
task dev
#    = docker compose --env-file .env.dev -f docker/dev/docker-compose.yaml up -d --wait

# 2. frontend dev server on the host (no frontend container in dev compose)
cd frontend && npm ci && npm run dev          # → http://localhost:5173

# 3. verify
curl http://localhost:5001/health             # {"status":"ok"}
open  http://localhost:5173                   # UI
```

> `task dev` reads env from `.env.dev` (all keys prefixed `TEMPMAIL_`).
> Plain `docker compose` without `--env-file .env.dev` falls back to in-stack defaults (`redis://valkey:6379/0`, `postgres:5432`). Prod uses `.env.prod`.

<details>
<summary><b>🔑 Key env</b> (see <code>backend/.env.example</code>)</summary>

```env
TEMPMAIL_POSTGRES_URL=postgres://tempmail:tempmail@postgres:5432/tempmail?sslmode=disable
TEMPMAIL_REDIS_URL=redis://user:sandi@ip:port/0     # user / pass / db all inside the URL
TEMPMAIL_PUBLIC_API_KEY=public-dev-key              # X-API-Key for /api/*
TEMPMAIL_MX_TARGET=email.xgmail.bond                # A record that MX points at
```
</details>

Backend only (no docker): `cd backend && go run ./cmd/server` (reads `backend/.env`).

---

## 🐳 Production / images

- **Prod stack** — `caddy` (TLS) → `app` image (SPA + API + SMTP) + postgres + valkey:
  ```bash
  docker compose --env-file .env.prod -f docker/prod/docker-compose.yaml up -d
  ```
  Override the image via `TEMPMAIL_APP_IMAGE` (default `docker.io/zengkuni/tempmail-xgmail:latest`).
- **Caddy + Cloudflare proxy** — TLS terminator in front of the app (ACME DNS-01, auto-provisioned), Cloudflare orange-cloud fronts `80/443`; setup + required DNS/token: [`proxy-caddy-cloudflare.md`](docs/backend/proxy-caddy-cloudflare.md).
- **CI/CD → GHCR + Docker Hub** — [`.github/workflows/build-push.yml`](.github/workflows/build-push.yml) builds & pushes on `main` push, tags `v*`, or manual dispatch. Push tag `v1.0.0` → **auto-bump `v1.0.1`** (new tag on same commit, no loop) → images `ghcr.io/<owner>/tempmail-xgmail:{v1.0.1,latest,sha-<commit>}` and `docker.io/zengkuni/tempmail-xgmail:{...}`; **multi-arch `amd64 + arm64`**. GHCR needs no secrets (`GITHUB_TOKEN`); Docker Hub push runs only when repo secrets `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` (access token) are set. Switch deployments with `TEMPMAIL_APP_IMAGE` in `.env.prod` (e.g. `docker.io/zengkuni/tempmail-xgmail:latest`).
- 🔁 Runtime-configurable: brand / MX / domain / env are `TEMPMAIL_*` env — no rebuild per brand.

---

## 📨 SMTP intake

The backend itself receives mail (port `TEMPMAIL_SMTP_PORT`, default `2525`): point your inbound MX records at the host running the app. Mail only lands for addresses previously generated through the UI/API (spam to guessed addresses is rejected at RCPT). MX verification + hourly expiry purge run as asynq jobs. Details: [`smtp-intake.md`](docs/backend/smtp-intake.md) · [`setup-dns.md`](docs/backend/setup-dns.md).

---

## 📂 Layout

```
backend/        Go service (api, queue, db, smtpserver, config)
frontend/       Vite + React SPA
docker/dev/     dev compose (backend source + postgres + valkey)
docker/prod/    prod compose + prod Dockerfile (single image)
docs/backend/   architecture, api-flow, smtp-intake, setup-dns
.github/        GHCR build-push workflow
```

> UI components come from the ReUI registry only (see `AGENTS.md`).

---

<div align="center">
<sub>PostgreSQL · Valkey · Go · React — disposable mail, no accounts, no manual cleanup.</sub>
</div>
