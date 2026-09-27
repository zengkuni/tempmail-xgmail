# AGENTS.md — tempmail-xgmail

Repository: `tempmail-xgmail`. Frontend lives in `frontend/` (Vite + React 19 + TanStack Router SPA, shadcn base-nova + free-tier ReUI, brand via `frontend/.env` `TEMPMAIL_BRAND`). Backend lives in `backend/` (Go 1.26: Gin HTTP API + SMTP receiver + asynq worker; Taskfile.yaml + docker-compose build a single image).

## UI components (MANDATORY)

ALL UI components come from [https://reui.io/components](https://reui.io/components). Before building or modifying any component, look it up in the ReUI catalog and reuse it — never hand-roll what ReUI provides. Use the ReUI MCP tools (`mcp__reui_*`: search → get_component → get_examples → get_install_command) as the primary path; if the MCP server is unavailable or returns nothing, fall back to reading [https://reui.io/components](https://reui.io/components) directly in the browser.

## Documentation placement (MANDATORY)

Any plan, design doc, audit, or other `.md` documentation MUST be placed by topic, never at the repository root and never loose inside source folders:

- Anything related to the frontend (UI redesigns, component plans, design audits, migration notes) → `docs/frontend/<topic>.md`
- Anything related to the backend (API design, mail server, infrastructure, Docker) → `docs/backend/<topic>.md`
- Topics spanning both → split into one file per side, each in its own directory.

Rules:

1. Every doc is a plain Markdown file with a descriptive kebab-case name (e.g. `docs/frontend/help-colorful-modern.md`).
2. Do not create documentation files outside `docs/frontend/` or `docs/backend/`. The only root-level Markdown allowed is this `AGENTS.md` and `README.md`.
3. When a doc becomes stale or superseded, update it in place or delete it; do not leave contradictory versions.
4. Source code, tests, and config never live under `docs/`.

