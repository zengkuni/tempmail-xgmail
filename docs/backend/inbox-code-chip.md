# Inbox code chip — server side

The inbox "copy code" chip needs the detected verification code **before the
email is opened**, so extraction runs server-side.

## Detector: `backend/internal/otp/otp.go`

`otp.Code(subject, text, html) string` — Go port of the context-aware
detector from github.com/One-Day-Developers/otp-detector, mirroring
`frontend/src/lib/otp-detector.ts` line-for-line in behavior:

1. Subject (keyword gate, `code: 123456` short-circuit).
2. Plain-text body.
3. HTML body (tags stripped to spaces).

Candidates: `\d{4,8}` or `\d{3,4}[-\s]\d{3,4}`. Per-candidate ±80-char
context filtering: reject dates/times, let strong positives
(`otp`, `verification code`, `kode verifikasi`, …) beat negatives, reject
negative keywords (`invoice`, `tracking`, `total`, `road`, `terms`, …),
confirm on `code:`/`kode verifikasi` adjacency, `<digits> is your … code`,
`<digits> adalah kode verifikasi`, or a positive keyword.

Keyword lists are English **and Indonesian** (`kode`, `verifikasi`,
`aktivasi`, `masukkan kode`, …).

## Wiring

- `db.ListEmailsByInbox` selects `body_text`/`body_html` alongside
  `id/sender/subject` (still `LIMIT 50`); `EmailListItem` gained the two
  body fields. GetEmail already returned full bodies.
- `api.ListEmails` emits `"code": otp.Code(subject, body_text, body_html)`
  per row; `api.GetEmail` emits the same for the detail response.
- `realtime.EmailPayload` gained `Code`; `smtpserver.Save` computes it from
  the parsed enmime envelope (subject + text + html) before `EmitNew`, so
  live `email:new` pushes also carry the code.

## Cost notes

`/api/emails` now moves up to 50 body pairs per call (bounded by the same
row limit as before). Bodies are single-digit KB in practice; no caching
layer added — emails are immutable once stored, so extraction is pure.

## Verified (dev stack, 2026-09-29)

`GET /api/emails?email=bimi-check@mail.tempmail.dev` returns codes with no
email opened: subject `198949`/`123456`; body-only `208451` (Tokopedia) and
`902104` (Netflix); false-positive bodies (Shopee invoice/date/address,
"New login to your account") return `""`. `go build ./...` + `go vet ./...`
clean.
