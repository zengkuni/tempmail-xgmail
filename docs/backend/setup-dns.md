# Setup DNS — xgmail.bond

Konfigurasi DNS untuk menerima email inbound di domain `xgmail.bond`. Panel: Cloudflare (semua record **DNS only**, proxy off).

## Record saat ini (2026-09-03)

| Type | Name | Value | Proxy | Prioritas |
|------|------|-------|-------|-----------|
| A | `email.xgmail.bond` | `47.84.203.164` | DNS only | — |
| MX | `xgmail.bond` | `email.xgmail.bond` | DNS only | 10 |
| TXT | `xgmail.bond` | `"v=DMARC1; p=none; rua=mailto:admin@xgmail.bond"` | DNS only | — |
| TXT | `xgmail.bond` | `"v=spf1 mx ip4:47.84.203.164 ~all"` | DNS only | — |

Kuota: 4 dari 200 record terpakai.

Hostname MX (`email.xgmail.bond`) punya A record langsung ke VPS — sender SMTP bisa resolve tanpa indirection. Konsisten dengan `TEMPMAIL_MX_TARGET=email.xgmail.bond` di backend.

## Alur email masuk

```
sender → DNS MX lookup xgmail.bond → email.xgmail.bond → A 47.84.203.164
       → 47.84.203.164:25 → host Docker → app:2525 (go-smtp receiver)
       → parse (enmime) → sanitize (bluemonday) → PostgreSQL
```

- `TEMPMAIL_MX_TARGET` backend = `email.xgmail.bond` (dipakai `POST /api/domains/verify` untuk mencocokkan MX record domain yang didaftarkan user).
- `TEMPMAIL_SMTP_GREETING` = `mail.xgmail.bond` (banner HELO). Idealnya disamakan dengan hostname MX: set `TEMPMAIL_SMTP_GREETING=email.xgmail.bond`, atau tambahkan A record `mail.xgmail.bond → 47.84.203.164` bila ingin memakai hostname itu.

## Penjelasan per record

### SPF — `v=spf1 mx ip4:47.84.203.164 ~all`

Mengizinkan host MX dan IP `47.84.203.164` mengirim atas nama domain. `~all` (softfail) aman selama masa setup; bisa diketatkan ke `-all` setelah stabil. SPF penting bila nanti backend juga **mengirim** email; untuk penerimaan murni tidak wajib, tetapi membantu deliverability balasan.

### DMARC — `v=DMARC1; p=none; rua=mailto:admin@xgmail.bond`

Policy `none` = monitoring saja, laporan agregat dikirim ke `admin@xgmail.bond`. Karena email diterima oleh tempmail ini sendiri, laporan DMARC bisa dibaca lewat inbox backend (generate inbox `admin@xgmail.bond`). Naikkan ke `p=quarantine`/`p=reject` hanya jika domain ini juga dipakai mengirim dan SPF/DKIM sudah benar.

### MX prioritas 10

Hanya satu MX — nilai prioritas bebas. Tanpa MX sekunder, saat host Docker/app down email masuk akan di-defer pengirim (umumnya retry hingga 24–72 jam) lalu bounce. Untuk layanan tempmail ini risiko itu diterima.

## Verifikasi

```powershell
# MX record
nslookup -type=MX xgmail.bond 1.1.1.1

# A record hostname MX
nslookup email.xgmail.bond 1.1.1.1

# SPF + DMARC
nslookup -type=TXT xgmail.bond 1.1.1.1
nslookup -type=TXT _dmarc.xgmail.bond 1.1.1.1
```

Uji end-to-end setelah stack docker jalan:

```powershell
# dari mesin mana pun — host harus publish 25 → app:2525
Test-NetConnection email.xgmail.bond -Port 25

# kirim email uji ke alamat yang digenerate via API, lalu
curl.exe -s "http://localhost:5001/api/emails?email=<alamat>@xgmail.bond" -H "X-API-Key: public-dev-key"
```

## Catatan

- Default domain dev (`TEMPMAIL_DEFAULT_DOMAIN=mail.tempmail.dev`) berbeda dengan domain produksi ini. Untuk menerima `@xgmail.bond`, daftarkan lewat `POST /api/domains/register` + `POST /api/domains/verify`, atau jadikan default via env `TEMPMAIL_DEFAULT_DOMAIN=xgmail.bond`.
- Di `TEMPMAIL_APP_ENV=production`, SMTP receiver menolak RCPT untuk domain yang tidak aktif di koleksi `domains` (`550 Domain not served by this MX cluster`) — pastikan `xgmail.bond` terdaftar & terverifikasi MX sebelum production.
- Cloudflare proxy **harus off** (DNS only) untuk A record yang dipakai SMTP — Cloudflare tidak mem-proxy port 25.
- Karena MX menunjuk `email.xgmail.bond`, verifikasi `POST /api/domains/verify {"domain":"xgmail.bond"}` harus mengembalikan `mx_verified: true`.
