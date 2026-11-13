# API

Semua mutasi UI memakai Server Actions (`src/app/actions/*`, `src/app/i/[slug]/actions.ts`) dengan hasil `{ ok: true, data } | { ok: false, error, fieldErrors? }`.

| Route | Metode | Auth | Keterangan |
|---|---|---|---|
| `/api/health` | GET | - | cek DB |
| `/api/public/:slug/wishes` | GET | - | ucapan APPROVED |
| `/api/public/:slug/seat?q=` | GET | - | cari meja, min 3 huruf, maks 5 hasil, nama dimasking, rate limit 30/menit/IP |
| `/api/public/:slug/calendar` | GET | - | file `.ics` semua acara |
| `/api/events/:id/stream` | GET (SSE) | sesi VIEWER+ | statistik dashboard tiap 3 dtk |
| `/api/events/:id/blast` | GET | sesi VIEWER+ | status kampanye |
| `/api/events/:id/tick` | POST | sesi EDITOR+ | proses pesan jatuh tempo (tanpa worker) |
| `/api/checkin/:id/login` | POST `{pin}` | PIN | set cookie staf 16 jam, rate limit 8/10 mnt |
| `/api/checkin/:id/manifest` | GET | staf/EDITOR | daftar tamu + QR + check-in |
| `/api/checkin/:id/sync` | POST `{scans:[…]}` | staf/EDITOR | idempoten via `clientEventId`; hasil `OK|DUPLICATE|INVALID` |
| `/api/tv/:id/stream?key=` | GET (SSE) | `tvKey` + paket | ucapan APPROVED + kedatangan |
| `/api/export/:kind?eventId=&sub=` | GET | sesi VIEWER+ | `guests.csv/xlsx`, `rsvp.csv`, `wishes.csv`, `catering.xlsx`, `all.json` |
| `/api/webhooks/whatsapp` | POST | `x-webhook-secret` | status pesan / STOP |
| `/api/webhooks/midtrans` | POST | `signature_key` | settle pembayaran |

QR payload: `WOS1.<guestId>.<subEventId>.<hmac22>` (HMAC-SHA256 base64url, `timingSafeEqual`).
