# Progress & Laporan

Legenda: ✅ terverifikasi (ada bukti perintah) · 🟡 jalan hanya di mock/tanpa uji nyata · ❌ tidak dikerjakan.

## 1. Ringkasan
Dibangun di atas Next 16 + Drizzle (lihat DECISIONS D1). ±75 file sumber: 27 route/halaman, 8 route API, 6 server-action module, 8 template (CSS + SVG buatan sendiri), 3 file tes (95 tes). Seed: 1 admin, 1 pasangan demo (60 tamu, 59 RSVP, 36 penempatan meja, 12 meja, 25 ucapan, 8 check-in, 1 kampanye, 7 tenant tambahan dengan langganan).

## 2. Hasil verifikasi
| Perintah | Hasil |
|---|---|
| `npx next typegen` | ✅ sukses |
| `tsc --noEmit` | ✅ 0 error |
| `npm run lint` | ✅ 0 error (2 warning `<img>` untuk QR data-URL) |
| `npm test` | ✅ 95/95 (moderasi 50 kasus, telepon, spintax, HMAC QR, konflik check-in, MRR, isolasi tenant, throttle, import 5.000 baris ≈1 dtk) |
| `npm run build` | ✅ lulus tanpa query DB |
| `db:push` + `db:seed` | ✅ |
| `build_and_start` | dijalankan di akhir sesi |
| Playwright e2e | ❌ tidak dikerjakan |
Smoke test HTTP manual (server produksi): 8 template `/demo/*` → 200; `?to=<script>` ter-sanitasi; check-in: PIN salah 401, QR valid OK, replay idempoten, scan kedua DUPLICATE (yang paling awal menang), HMAC salah INVALID, 20 scan batch OK lalu re-scan 20 DUPLICATE tanpa baris ganda; blast 59 pesan: 51 SENT + 8 retry, tanpa baris ganda saat enqueue ulang; export catering.xlsx berisi 4 sheet; tenant lain mendapat 403 pada export/stream; anon 307/403.

## 3. Matriks fitur
| Fitur | Status | Catatan |
|---|---|---|
| 6.1 Undangan publik: cover tap-to-open, `?to=`, `?g=`, PIC WA, countdown+ICS+Google, multi-acara+Maps/Waze, love story, galeri+lightbox, streaming facade, dress code, adat, gift+copy+wishlist, RSVP per acara, wish realtime(polling), cari meja, password, expiry, arsip, noindex, JSON-LD, OG image | ✅ | Gyro/parallax hanya pointer; galeri = ilustrasi SVG (tanpa upload foto/blurhash); musik = ambient WebAudio. RSVP hanya field tetap. |
| 6.2 Delapan template | ✅ render (200) / 🟡 | Cover, ornamen, tata letak, animasi berbeda. Kontras diatur AA per token, tapi belum diaudit dengan alat. Aksara Jawa tidak ditampilkan. |
| 6.3 Dashboard: onboarding, overview SSE, tabel tamu+filter+bulk+inline edit, link & QR, import CSV/XLSX (mapping, duplikat fuzzy, strategi, laporan), moderasi, ekspor, billing, hak data | ✅ | **Form Builder RSVP: ❌** (form tetap). Retensi: ✅ fungsi + worker per jam, belum diuji waktu nyata. |
| 6.4 Studio | 🟡 parsial | Theme/section/teks/love story + pratinjau; ❌ kanvas bebas, layer, undo/redo, versi, draft/publish, Font Picker 40 font, musik unggah. |
| 6.5 Blast WA | ✅ mock / 🟡 provider nyata | Spintax, variabel, segmen, throttle, jendela, batas harian, idempotensi, retry, pause/cancel/kirim ulang, status mock. **Reminder otomatis H-7/H-1: ❌** (hanya segmen "belum RSVP" manual). Tanpa BullMQ (D4). |
| 6.6 Seating | ✅ | Drag meja, zona, kapasitas+peringatan, auto-assign per grup, drag tamu; cetak via print browser. ❌ PDF/gambar server-side, mini-denah publik. |
| 6.7 QR check-in PWA | ✅ | Terverifikasi lewat HTTP (lihat atas). Kamera/BarcodeDetector/jsQR/torch/offline-queue di klien **tidak diuji di perangkat nyata** (🟡). Klaim souvenir ❌. |
| 6.8 Catering Matrix | ✅ | 4 sheet, header beku, A4 landscape, filter per acara. Tanpa streaming (buffer). |
| 6.9 Moderasi | ✅ | Rule-based ID+EN+regional; ❌ LLM nyata. |
| 6.10 TV mode | 🟡 | SSE+backoff, wake lock, welcome popup, QR; slideshow foto = ilustrasi. Tidak diuji di layar nyata; remote control ❌. |
| 6.11 Auth | 🟡 | Email+sandi, lockout, rate limit, demo login ✅. Google, magic link, verifikasi email, reset sandi, hapus akun ❌. |
| 6.12 Super Admin | 🟡 | KPI (MRR/ARR/ARPU/churn/konversi/GMV/WA/acara), tren MRR, tenant search/suspend/ubah paket/impersonate/hapus soft, audit, status antrian ✅. ❌ marketplace template, kupon, feature flag, system settings. |
| 6.13 Marketing | ✅ | Landing, galeri, detail + pratinjau ponsel, harga, legal (templat, perlu review hukum). |
| i18n | 🟡 | Undangan ID/EN; marketing & dashboard hanya ID. |
| Dark mode dashboard | ✅ via `prefers-color-scheme` (tanpa toggle). |

## 4. Kredensial yang diperlukan
Lihat README bagian "Mengganti mock": `FONNTE_TOKEN` / `WA_CLOUD_*`, `WEBHOOK_SECRET`, `MIDTRANS_SERVER_KEY`, `APP_SECRET` (wajib diganti), `APP_URL`.

## 5. Performa
Lighthouse **tidak dijalankan** (tidak ada Chrome headless di sandbox). Terukur dari server produksi: JS awal halaman undangan ≈ **176.8 KB gzip** (9 chunk; termasuk runtime React/Next) → **sedikit melewati budget 170 KB**; CSS ≈ 15 KB gzip; HTML ≈ 61 KB. Font di-lazy dan `preload:false`. Komponen klien tidak memuat kamera/editor di halaman undangan.

## 6. Keputusan & trade-off
Lihat `docs/DECISIONS.md` (D1-D12).

## 7. Known issues & langkah berikut
1. Kurangi JS undangan (<170 KB): pisahkan Gallery/Lightbox dengan `dynamic()`, hapus server action client dari bundle awal.
2. Form Builder RSVP, reminder H-7/H-1, upload foto + `sharp`, S3 adapter.
3. Studio kanvas (react-moveable + dnd-kit + Immer patches) dan version history.
4. Auth.js (Google/magic link), verifikasi email, reset sandi.
5. Playwright e2e dan audit Lighthouse/axe di CI.
6. Rate limit & realtime → Redis untuk multi-instance; BullMQ bila throughput perlu.
7. Uji adapter Fonnte/Cloud API/Midtrans dengan kredensial sungguhan.
8. Per-event `metadataBase` untuk OG image absolut.
