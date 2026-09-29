# Inbox code chip (OTP extraction)

Every inbox row renders a monospace "copy code" chip with the detected
verification code — **without opening the email**.

The code is computed **server-side** (see
`docs/backend/inbox-code-chip.md` for the Go port `backend/internal/otp`,
list/detail/socket wiring) and arrives with the row payload, so chips show
on first render and on live `email:new` pushes.

`frontend/src/lib/otp-detector.ts` keeps the same context-aware detector
(zero-dependency port of github.com/One-Day-Developers/otp-detector,
including Indonesian keywords) as a **client fallback** for payloads that
predate the `code` field. Subject → plain text → HTML (DOMParser, block tags
become spaces so `</strong>123456` cannot merge digits); candidates are
`\d{4,8}` or dashed/spaced `\d{3,4}[-\s]\d{3,4}` with ±80-char context
filtering (dates/times, invoice/tracking/address negatives, `kode
verifikasi` positives).

## Wiring (`src/hooks/use-inbox.ts`)

- `toMock`: `code = e.code?.trim() || extractOTPFromEmail({ subject })`.
- `openEmail`: `code = d.code?.trim() || extractOTPFromEmail({ subject,
  text, html })` — the row state update keeps the chip after close.
- `EmailSummary`/`EmailDetail` in `src/lib/api.ts` declare optional `code`.

## Verified behavior (dev stack, 2026-09-29)

Browser check with the inbox unopened (no row click):

| Sender | Source | Chip |
|---|---|---|
| Tokopedia ID (subject "198949 adalah kode verifikasi Anda") | subject | `198949` |
| Tokopedia ID (body "…kode verifikasi… 208451") | body | `208451` |
| Netflix ("New sign-in to your account") | body | `902104` |
| Github ("Your verification code is 123456") | subject | `123456` |
| Shopee ("Your order has shipped", invoice/date/address body) | — | none |

`tsc --noEmit` clean.
