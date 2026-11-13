# Arsitektur

```
src/
  app/
    (marketing)/   landing, templates, pricing, legal      (statis)
    (auth)/        login, register
    (app)/dashboard/…   ringkasan, tamu, ucapan, seating, blast, checkin, export, settings, billing
    studio/[eventId]    editor tema & konten
    i/[slug]            undangan publik (+ opengraph-image, actions.ts)
    demo/[template]     pratinjau template tanpa DB
    checkin/[eventId]   PWA scanner (+ manifest dinamis)
    tv/[eventId]        TV mode
    admin               super admin
    pay/[paymentId]     checkout mock
    api/                public, events (SSE/tick/blast), checkin, tv, export, webhooks, health
    actions/            server actions: auth, dashboard, admin
  components/{invitation,dashboard,checkin,tv,marketing}
  server/   auth (sesi+RBAC), seed, invitation (loader), blast (adapter WA + antrian), payments, stats, sse, privacy, entitlements, staff
  lib/      fungsi murni teruji: phone, spintax, qr, moderation, import, throttle, checkin-logic, billing, tenant, tz, ics, invitation-config
  templates/ registri 8 template (token desain)
  db/       schema.ts (Drizzle), index.ts (klien lazy)
  worker/   index.ts (blast + retensi)
```

**Alur tenant:** sesi → `getAuth()` (user + memberships) → `requireEventAccess(eventId, role)` → semua query di-scope `eventId`. Super admin lolos semua, impersonate via `imp` + audit.

**Render undangan:** `loadInvData` → `Invitation` (Server Component; token template → CSS variables, section dari `config` JSON tervalidasi Zod) → `Shell` (client: cover, musik WebAudio, tombol WA) + island client (Countdown, RSVP, Wish, TableSearch, Gallery).

**Blast:** `createCampaign` → `enqueueCampaign` (render spintax per tamu, `planSchedule` → `send_after`) → `processDue` (klaim atomik, retry/backoff, kirim lewat `WhatsAppProvider`) → status via webhook atau simulator mock.

**Check-in:** manifest tamu (payload QR ber-HMAC) → IndexedDB → scan lokal → `/api/checkin/:id/sync` (idempoten via `clientEventId`; pemenang = scan paling awal).
