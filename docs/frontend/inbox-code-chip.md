# Inbox code chip (OTP extraction)

Every inbox row can render a monospace "copy code" chip with the detected
verification code. Extraction lives in `frontend/src/lib/otp-detector.ts` — a
zero-dependency port of the context-aware detector from
github.com/One-Day-Developers/otp-detector.

## Pipeline

`extractOTPFromEmail({ subject, text, html })`:

1. **Subject** — gated by a keyword (`otp|pin|verification|code|one-time|
   verify`); `code: 123456` short-circuits even without other keywords.
2. **Plain-text body**.
3. **HTML body** — `DOMParser` → visible text (block tags become spaces so
   `</strong>123456` cannot merge digits), tag-strip fallback off-browser.

Candidates are `\d{4,8}` or dashed/spaced `\d{3,4}[-\s]\d{3,4}` (separators
stripped: `123-456` → `123456`). Each candidate's ±80-char context decides:

- date/time patterns (`12/05`, `10:30`, `gmt`) → reject;
- strong positives (`otp`, `verification code`, `kode verifikasi`, …) beat negatives;
- otherwise a negative keyword in context (`invoice`, `tracking`, `total`, `road`, `terms`, …) rejects the candidate;
- leftovers confirmed by `code: 123456`, `kode verifikasi` adjacency, `123456 is your Instagram confirmation code`, `123456 adalah kode verifikasi`, or a positive keyword → accept.
## Wiring (use-inbox.ts)

- List rows: `code = extractOTPFromEmail({ subject })` — the list API returns
  no body, so the chip appears from the subject only.
- Row open (`openEmail`): detail fetch returns `subject/text/html`; code is
  recomputed with all three and the row state is updated, so the chip
  upgrades to a body-only code without a page reload.

## Verified behavior (dev stack, 2026-09-29)

- Subject code: `noreply@github.com` "Your verification code is 123456" →
  chip `123456` on first render (no fetch).
- Body-only code: `info@netflix.com` "New sign-in to your account" + body
  "Your verification code is 902104…" → chip `902104` after opening the row;
  dialog iframe body renders the same code.
- False positives: `noreply@shopee.co.id` "Your order has shipped" + body
  "Invoice #100250 total $42.99. Order date 12/05/2026. … 1601 Willow Rd." →
  no chip (invoice/date/address context filtered).
- Indonesian subject: "198949 adalah kode verifikasi Anda" → chip `198949` on first render (keyword gate accepts `kode`/`verifikasi`).
- Indonesian body-only: "Aktivasi akun Tokopedia kamu" + body "…masukkan kode verifikasi… 208451" → chip `208451` after opening the row.
