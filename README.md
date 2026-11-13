# WeddingOS

Platform undangan pernikahan digital untuk pengantin: 8 template, RSVP, ucapan dengan moderasi, blast WhatsApp, denah meja, check-in QR (PWA offline), TV mode, ekspor katering, billing, dan super admin.

> Stack di repo ini: **Next.js 16 + React 19 + Drizzle ORM + PostgreSQL + Tailwind 4 + npm** (bukan Prisma/pnpm seperti di prompt awal; lihat `docs/DECISIONS.md`). Status fitur yang jujur ada di `docs/PROGRESS.md`.

## Prasyarat
Node 22, PostgreSQL 16 (atau `docker compose up -d postgres`). Redis/MinIO/Mailpit ada di `docker-compose.yml` tetapi belum dipakai aplikasi.

## Setup
```bash
cp .env.example .env        # sesuaikan DATABASE_URL dan APP_SECRET
npm install
npm run db:push             # drizzle-kit push: membuat tabel
npm run db:seed             # data demo (tambahkan -- --force untuk reset total)
npm run dev                 # http://localhost:3000
npm run worker              # (opsional) pemroses antrian blast + retensi data
```
`next build` tidak membutuhkan database. Halaman demo `/i/raka-anindya` juga membuat data demo otomatis bila belum ada.

## Akun demo (DEMO_MODE=true)
| Peran | Email | Kata sandi |
|---|---|---|
| Pengantin | `demo@weddingos.test` | `Demo1234!` |
| Super Admin | `admin@weddingos.test` | `Admin1234!` |
| Tenant lain | `tenant1..7@weddingos.test` | `Tenant1234!` |

Tombol "Masuk sebagai demo" tersedia di `/login`. PIN staf check-in demo: `123456` (scanner di `/checkin/<eventId>`; URL ada di Dashboard → Check-in & TV).
Set `DEMO_MODE=false` di produksi untuk menyembunyikan tombol demo.

## Skrip
`dev`, `build`, `start`, `lint`, `typecheck`, `test` (Vitest, 95 tes), `db:push`, `db:seed`, `db:studio`, `worker`.
Belum ada: Playwright e2e, `db:migrate` (memakai `drizzle-kit push`), prettier.

## Mengganti mock ke provider nyata
- **WhatsApp:** `WA_PROVIDER=fonnte` + `FONNTE_TOKEN`, atau `WA_PROVIDER=cloud` + `WA_CLOUD_TOKEN` + `WA_CLOUD_PHONE_ID`. Webhook status/STOP: `POST /api/webhooks/whatsapp` dengan header `x-webhook-secret: $WEBHOOK_SECRET` dan body `{"type":"status","providerMessageId":"…","status":"delivered"}` atau `{"type":"incoming","from":"+62…","text":"STOP"}`. **Adapter nyata belum diuji dengan akun sungguhan.**
  - *Cloud API resmi (Meta)* aman tetapi pesan awal di luar jendela 24 jam wajib memakai template yang disetujui (adapter ini mengirim tipe `text`; untuk pesan undangan pertama perlu diperluas ke template). *Gateway tidak resmi (Fonnte dll.)* berisiko nomor diblokir. UI memberi peringatan dan throttle (jeda acak, batas harian, jendela 08.00-21.00).
- **Midtrans:** isi `MIDTRANS_SERVER_KEY`; arahkan notifikasi Midtrans ke `/api/webhooks/midtrans`. Belum diuji tanpa kredensial.
- **Google OAuth, Magic Link/SMTP, S3 storage, LLM moderasi:** tidak diimplementasikan (lihat DECISIONS).

## Deployment
Aplikasi web berjalan di Node (`npm run build && npm run start`). Worker blast (`npm run worker`, `Dockerfile.worker`) adalah proses long-running, tidak cocok untuk serverless murni; alternatifnya biarkan dashboard memanggil `/api/events/:id/tick` saat kampanye dibuka. Rate limit saat ini in-memory (satu instance); ganti ke Redis untuk multi-instance. Build mengunduh Google Fonts, jadi perlu internet saat `next build`.

## Troubleshooting
- *Build gagal pada font:* butuh akses `fonts.googleapis.com` saat build.
- *Cookie sesi tidak tersimpan di http lokal:* set `INSECURE_COOKIES=true` bila memakai `next start` tanpa HTTPS.
- *Tabel tidak ditemukan:* jalankan `npm run db:push`.
- *Kamera scanner tidak muncul:* butuh HTTPS atau `localhost`, dan izin kamera.
