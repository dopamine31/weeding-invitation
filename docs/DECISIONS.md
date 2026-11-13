# Keputusan Arsitektur

Format: konteks → opsi → keputusan → alasan. Prompt asli meminta stack tertentu; lingkungan sandbox ini
sudah menyediakan stack lain, sehingga ada deviasi besar yang dicatat jujur di sini.

## D1. Stack mengikuti template proyek, bukan prompt
- **Konteks:** workspace sudah berisi Next.js 16.4 (Turbopack), React 19.2, Tailwind 4, Drizzle ORM + `pg`, npm. Aturan platform melarang mengubah `package.json` manual dan menyuruh memakai Drizzle.
- **Opsi:** (a) pasang Prisma/pnpm/Tailwind 3 sesuai prompt, (b) pakai stack yang ada.
- **Keputusan:** (b). **Drizzle** menggantikan Prisma, **npm** menggantikan pnpm, **Tailwind 4** + CSS variables menggantikan Tailwind 3.4 + shadcn/ui (komponen UI ditulis sendiri sebagai class `.btn/.card/.input` di `globals.css`).
- **Alasan:** build dan `build_and_start` platform bergantung pada stack ini. Menggantinya berisiko membuat aplikasi tidak bisa dijalankan.

## D2. Auth: sesi cookie bertanda tangan HMAC, bukan Auth.js
- Credentials (scrypt, rate limit login, lockout 5 gagal → 15 menit) + tombol "Masuk sebagai demo". Sesi = cookie `wos_session` (payload JSON + HMAC-SHA256, 7 hari, httpOnly, sameSite=lax).
- **Magic Link, Google OAuth, verifikasi email, reset password tidak dikerjakan** (butuh SMTP/kredensial OAuth). Tombol-tombolnya tidak ditampilkan. Halaman login menyebutkan hal ini.
- Impersonate admin memakai field `imp` pada sesi + `AuditLog`.

## D3. RBAC & multi-tenant
`requireEventAccess(eventId, minRole)` di `src/server/auth.ts` adalah gerbang tunggal. Server action selalu memverifikasi event→workspace→membership lewat fungsi murni `canAccessWorkspace` (diuji di `tests/unit/core.test.ts`). Query turunan selalu di-scope `eventId`. Diverifikasi juga via HTTP (user lain mendapat 403).
Peran `GATE_STAFF` diimplementasikan sebagai PIN per event (hash HMAC) + cookie staf bertanda tangan, bukan akun.

## D4. Queue blast: antrian berbasis Postgres, bukan BullMQ/Redis
- Pesan disimpan di `blast_messages` dengan `send_after`; klaim atomik `UPDATE … WHERE status='QUEUED' RETURNING` mencegah kirim ganda; `idempotency_key` unik per (kampanye, tamu); retry eksponensial max 3×; jendela kirim, batas harian, jeda acak + jeda panjang (di `lib/throttle.ts`).
- Pemroses: `npm run worker` (proses terpisah, graceful shutdown) **atau** dashboard memanggil `POST /api/events/:id/tick` saat kampanye berjalan (mode demo tanpa worker).
- **Alasan:** tanpa Redis di sandbox; satu sumber kebenaran; lebih sedikit bagian bergerak. Trade-off: throughput lebih rendah dari BullMQ (cukup untuk blast WA yang memang dibatasi throttle).

## D5. Realtime: SSE dengan polling DB
`/api/events/:id/stream` (dashboard) dan `/api/tv/:id/stream` (TV) mengirim snapshot tiap 3–4 detik, klien auto-reconnect dengan exponential backoff. Tanpa Redis pub/sub. Daftar ucapan di undangan publik memakai polling 10 detik.

## D6. Studio: editor konten & tema berbasis section, BUKAN kanvas bebas
- **Konteks:** editor setara Canva (drag/resize/rotate, snapping, undo/redo patches, versi) tidak mungkin diselesaikan utuh dalam sesi ini.
- **Keputusan:** Studio menyediakan theme customizer (warna + cek kontras WCAG, font, radius, musik), urutan/visibilitas 12 section, penyuntingan teks, love story, pratinjau Mobile/Tablet/Desktop dalam iframe, simpan tervalidasi Zod (`configSchema` + `migrateConfig` versioned). **Tidak ada**: kanvas elemen bebas, layer panel, undo/redo, version history, draft vs publish terpisah.

## D7. Font: `next/font/google` (self-host saat build)
14 keluarga font di-download saat `next build` dan disajikan dari origin sendiri (tanpa `<link>` Google Fonts runtime). Butuh akses jaringan saat build. Font aksara Jawa, Scheherazade New tidak dimuat; teks Arab memakai Amiri. Font Picker terbatas 8 pilihan, bukan 40.

## D8. Storage/Mail/LLM
Tidak ada upload file, S3, SMTP, atau LLM moderation. Galeri memakai ilustrasi SVG buatan sendiri; musik = ambient WebAudio. Interface `ModerationProvider` ada (dengan fallback rule-based + timeout, diuji) tapi tidak ada implementasi LLM yang terpasang.

## D9. PWA check-in tulis tangan
Service worker `public/sw.js` (tanpa Serwist), IndexedDB langsung. Manifest dinamis per event. Verifikasi QR offline = pencocokan payload HMAC yang ada di manifest (secret tidak pernah dikirim ke perangkat).

## D10. i18n
Undangan publik memiliki kamus ID/EN (`lib/i18n.ts`, field bahasa per event). Marketing dan dashboard hanya Bahasa Indonesia (tanpa next-intl).

## D11. Build tanpa DB
Klien DB lazy lewat Proxy (`src/db/index.ts`); semua halaman data `force-dynamic`. `next build` lulus tanpa query ke DB.

## D12. Pembayaran
`createCheckout` memakai Midtrans Snap bila `MIDTRANS_SERVER_KEY` ada (+ webhook dengan verifikasi `signature_key` SHA-512), jika tidak halaman simulasi `/pay/:id`. Jalur Midtrans nyata **belum diuji** (tanpa kredensial).
