import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { hashPassword, hashPin, randomToken } from "@/lib/crypto";
import { normName } from "@/lib/import";
import { PLAN_SEED } from "@/lib/billing";
import { seededRng } from "@/lib/spintax";

export const DEMO_EMAIL = "demo@weddingos.test";
export const DEMO_PASSWORD = "Demo1234!";
export const ADMIN_EMAIL = "admin@weddingos.test";
export const ADMIN_PASSWORD = "Admin1234!";
export const DEMO_SLUG = "raka-anindya";
export const DEMO_PIN = "123456";

const FIRST = ["Budi", "Siti", "Agus", "Dewi", "Eko", "Fitri", "Gunawan", "Hesti", "Irfan", "Jihan", "Kevin", "Lestari", "Made", "Nanda", "Oki", "Putri", "Qori", "Rizky", "Sari", "Tono"];
const LAST = ["Santoso", "Wijaya", "Pratama", "Lestari", "Kusuma", "Saputra", "Hartono", "Nugroho", "Rahayu", "Siregar"];
const DAY = 86_400_000;

let running: Promise<void> | null = null;

export function ensureDemo(): Promise<void> {
  if (!running) running = seedDemo().catch((e) => { running = null; throw e; });
  return running;
}

export async function seedDemo(opts: { force?: boolean } = {}): Promise<void> {
  const [already] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, DEMO_EMAIL)).limit(1);
  if (already && !opts.force) return;
  if (opts.force) {
    await db.execute(sql`truncate table users, plans, workspaces, memberships, subscriptions, payments, events, sub_events, pics, guest_groups, guests, link_opens, menu_options, rsvps, seat_tables, seat_assignments, wishes, gift_accounts, wishlist_items, blast_campaigns, blast_messages, check_ins, audit_logs, moderation_logs, consent_logs restart identity cascade`);
  }
  const rng = seededRng(7);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)] as T;
  const now = Date.now();

  await db.insert(s.plans).values(PLAN_SEED).onConflictDoNothing();

  const [admin] = await db.insert(s.users).values({ email: ADMIN_EMAIL, name: "Super Admin", passwordHash: hashPassword(ADMIN_PASSWORD), role: "SUPER_ADMIN" }).onConflictDoNothing().returning();
  void admin;
  const [demo] = await db.insert(s.users).values({ email: DEMO_EMAIL, name: "Raka Pratama", passwordHash: hashPassword(DEMO_PASSWORD) }).returning();
  if (!demo) return;
  const [ws] = await db.insert(s.workspaces).values({ name: "Raka & Anindya", ownerId: demo.id, planId: "premium" }).returning();
  if (!ws) return;
  await db.insert(s.memberships).values({ workspaceId: ws.id, userId: demo.id, role: "OWNER" });
  await db.insert(s.subscriptions).values({ workspaceId: ws.id, planId: "premium", amountIdr: 299000, interval: "ONCE", startedAt: new Date(now - 20 * DAY) });
  await db.insert(s.payments).values({ workspaceId: ws.id, planId: "premium", amountIdr: 299000, status: "PAID", paidAt: new Date(now - 20 * DAY), createdAt: new Date(now - 20 * DAY) });

  const [ev] = await db
    .insert(s.events)
    .values({
      workspaceId: ws.id, slug: DEMO_SLUG, title: "The Wedding of Raka & Anindya", status: "PUBLISHED", timezone: "WIB", templateSlug: "elegant-ivory",
      groomName: "Raka", brideName: "Anindya", groomFull: "Raka Pratama, S.T.", brideFull: "Anindya Putri Maharani, S.Ds.",
      groomParents: "Bapak Hadi Pratama & Ibu Sri Wahyuni", brideParents: "Bapak Bambang Maharani & Ibu Retno Lestari",
      tvKey: randomToken(12), staffPinHash: hashPin(DEMO_PIN), wishPolicy: "AUTO",
      config: {
        texts: {
          quote: "Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan hidup agar kamu merasa tenteram kepadanya.", quoteSource: "QS. Ar-Rum: 21",
          greeting: "Dengan memohon rahmat dan ridho Allah SWT, kami mengundang Bapak/Ibu/Saudara/i untuk hadir dan memberikan doa restu pada pernikahan kami.",
          thanks: "Terima kasih atas doa, kehadiran, dan kebaikan hati Anda semua.", dressNote: "Mohon berpakaian dengan nuansa earth tone.",
          dressColors: ["#B89B5E", "#E7D9BF", "#2B2A28", "#8A7B5C"], customary: ["Mohon tidak membawa karangan bunga.", "Tidak diperkenankan memotret saat prosesi akad."],
          loveStory: [
            { date: "2019", title: "Bertemu di Bandung", text: "Kami bertemu pertama kali di sebuah pameran seni, dan obrolan singkat berubah menjadi cerita panjang." },
            { date: "2022", title: "Menjalin Janji", text: "Setelah tiga tahun saling mendukung, Raka melamar Anindya di tepi danau saat senja." },
            { date: "2025", title: "Hari Bahagia", text: "Dengan restu keluarga, kami melangkah ke pelaminan." },
          ],
          music: "ambient",
        },
      },
    })
    .returning();
  if (!ev) return;
  const eventDay = new Date(now + 45 * DAY);
  eventDay.setUTCHours(1, 0, 0, 0); // 08:00 WIB
  const [akad, resepsi] = await db
    .insert(s.subEvents)
    .values([
      { eventId: ev.id, name: "Akad Nikah", startsAt: eventDay, endsAt: new Date(eventDay.getTime() + 2 * 3600_000), venue: "Masjid Agung Al-Ikhlas", address: "Jl. Asia Afrika No. 12, Bandung", mapsUrl: "https://maps.google.com/?q=Masjid+Agung+Bandung", dressCode: "Putih & earth tone", sort: 0 },
      { eventId: ev.id, name: "Resepsi", startsAt: new Date(eventDay.getTime() + 3 * 3600_000), endsAt: new Date(eventDay.getTime() + 7 * 3600_000), venue: "Gedung Sasana Budaya", address: "Jl. Merdeka No. 45, Bandung", mapsUrl: "https://maps.google.com/?q=Gedung+Sasana+Budaya+Bandung", dressCode: "Batik / formal", sort: 1 },
    ])
    .returning();
  if (!akad || !resepsi) return;
  await db.insert(s.pics).values([
    { eventId: ev.id, name: "Dimas (PIC Pria)", phone: "+6281234500001", role: "Keluarga Mempelai Pria", sort: 0 },
    { eventId: ev.id, name: "Nadia (PIC Wanita)", phone: "+6281234500002", role: "Keluarga Mempelai Wanita", sort: 1 },
  ]);
  const menus = await db.insert(s.menuOptions).values([{ eventId: ev.id, name: "Nasi Bakar Ayam" }, { eventId: ev.id, name: "Sapi Lada Hitam" }, { eventId: ev.id, name: "Vegetarian" }]).returning();
  await db.insert(s.giftAccounts).values([
    { eventId: ev.id, type: "BANK", provider: "BCA", accountNumber: "1234567890", accountName: "Raka Pratama" },
    { eventId: ev.id, type: "EWALLET", provider: "GoPay", accountNumber: "081234500001", accountName: "Anindya Putri" },
  ]);
  await db.insert(s.wishlistItems).values([{ eventId: ev.id, name: "Air Fryer" }, { eventId: ev.id, name: "Set Peralatan Makan" }, { eventId: ev.id, name: "Rice Cooker", claimedBy: "Kantor Raka" }, { eventId: ev.id, name: "Voucher Honeymoon" }]);

  const groups = await db.insert(s.guestGroups).values(["Keluarga", "Teman Kuliah", "Kantor", "Tetangga"].map((name) => ({ eventId: ev.id, name }))).returning();
  const guestRows = Array.from({ length: 60 }, (_, i) => {
    const name = `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`;
    return {
      eventId: ev.id, groupId: (groups[i % groups.length] as { id: string }).id, name, normName: normName(name),
      phone: `+62812${String(34510000 + i * 37).padStart(8, "0")}`, email: i % 3 === 0 ? `tamu${i}@example.com` : null,
      category: i % 10 === 0 ? "VIP" : i % 4 === 0 ? "FAMILY" : "REGULAR", maxPax: 1 + (i % 3), plusOne: i % 5 === 0, token: randomToken(18),
      notes: i % 10 === 0 ? "Tamu kehormatan" : "", optedOut: i === 59,
    };
  });
  const gs = await db.insert(s.guests).values(guestRows).returning();

  const rsvpRows: (typeof s.rsvps.$inferInsert)[] = [];
  const allergies = [["Alergi kacang", "SEVERE"], ["Alergi seafood", "SEVERE"], ["Tidak makan gluten", "MILD"], ["Alergi susu", "MILD"]] as const;
  gs.slice(0, 44).forEach((g, i) => {
    const status = i % 9 === 0 ? "declined" : i % 13 === 0 ? "maybe" : "attending";
    const al = i % 7 === 0 ? allergies[i % allergies.length] : undefined;
    for (const sub of [akad, resepsi]) {
      if (sub === akad && i % 3 !== 0) continue;
      rsvpRows.push({
        eventId: ev.id, guestId: g.id, subEventId: sub.id, status, pax: status === "attending" ? Math.max(1, Math.min(g.maxPax, 1 + (i % 2))) : 0,
        menuId: status === "attending" ? (menus[i % menus.length] as { id: string }).id : null, allergy: al?.[0] ?? "", severity: al?.[1] ?? "NONE",
        createdAt: new Date(now - (i % 14) * DAY), updatedAt: new Date(now - (i % 14) * DAY),
      });
    }
  });
  await db.insert(s.rsvps).values(rsvpRows);
  await db.insert(s.linkOpens).values(gs.slice(0, 52).map((g, i) => ({ eventId: ev.id, guestId: g.id, openedAt: new Date(now - (i % 10) * DAY) })));

  const tbls = await db.insert(s.tables).values(Array.from({ length: 12 }, (_, i) => ({
    eventId: ev.id, name: `${i + 1}`, shape: i % 4 === 3 ? "long" : i % 3 === 0 ? "square" : "round", capacity: i % 4 === 3 ? 10 : 8, x: 12 + (i % 4) * 25, y: 15 + Math.floor(i / 4) * 28, rotation: 0,
  }))).returning();
  const attendingIds = [...new Set(rsvpRows.filter((r) => r.status === "attending").map((r) => r.guestId))];
  const load = new Map<string, number>();
  const assigns: (typeof s.seatAssignments.$inferInsert)[] = [];
  for (const gid of attendingIds) {
    const g = gs.find((x) => x.id === gid);
    const need = g ? Math.min(g.maxPax, 2) : 1;
    const t = tbls.find((tb) => (load.get(tb.id) ?? 0) + need <= tb.capacity);
    if (!t) continue;
    load.set(t.id, (load.get(t.id) ?? 0) + need);
    assigns.push({ eventId: ev.id, guestId: gid, tableId: t.id });
  }
  await db.insert(s.seatAssignments).values(assigns);

  const msgs = ["Selamat menempuh hidup baru! Semoga sakinah, mawaddah, warahmah.", "Barakallah, semoga langgeng sampai kakek nenek.", "Congratulations Raka & Anindya! Wishing you a lifetime of happiness.", "Happy wedding! Cant wait to celebrate with you.", "Doa terbaik untuk kalian berdua, semoga jadi keluarga yang penuh cinta.", "Selamat ya! Akhirnya sampai juga di hari bahagia ini."];
  const wishRows: (typeof s.wishes.$inferInsert)[] = Array.from({ length: 25 }, (_, i) => {
    const g = gs[i % gs.length] as (typeof gs)[number];
    const status = i < 17 ? "APPROVED" : i < 21 ? "PENDING" : i < 24 ? "FLAGGED" : "REJECTED";
    const message = status === "FLAGGED" ? (i === 21 ? "Cek promo di https://judi.example.com sekarang" : i === 22 ? "wa 081234567890 untuk info" : "dasar anjing") : status === "REJECTED" ? "anjing bangsat" : pick(msgs);
    return { eventId: ev.id, guestId: g.id, name: g.name, message, status, score: status === "FLAGGED" ? 60 : status === "REJECTED" ? 95 : 0, reasons: [], pinned: i === 0, reply: i === 1 ? "Terima kasih banyak atas doanya!" : null, createdAt: new Date(now - i * 3600_000 * 5) };
  });
  await db.insert(s.wishes).values(wishRows);

  const [camp] = await db.insert(s.blastCampaigns).values({ eventId: ev.id, name: "Undangan Gelombang 1", template: "{Halo|Hai} {{nama}}, kami mengundang Anda ke pernikahan {{nama_mempelai}} pada {{tanggal}}. Detail: {{link}}", status: "DONE", segment: { kind: "all" }, settings: {} }).returning();
  if (camp) {
    const statuses = ["READ", "READ", "DELIVERED", "DELIVERED", "SENT", "FAILED"] as const;
    await db.insert(s.blastMessages).values(gs.slice(0, 30).map((g, i) => ({
      campaignId: camp.id, eventId: ev.id, guestId: g.id, phone: g.phone ?? "", body: `Halo ${g.name}, kami mengundang Anda ke pernikahan Raka & Anindya.`, status: statuses[i % statuses.length] as string,
      attempt: 1, idempotencyKey: `${camp.id}:${g.id}`, sentAt: new Date(now - 10 * DAY), error: i % 6 === 5 ? "Nomor tidak terdaftar di WhatsApp" : null,
    })));
  }
  await db.insert(s.checkIns).values(gs.slice(0, 8).map((g, i) => ({ eventId: ev.id, guestId: g.id, subEventId: resepsi.id, clientEventId: `seed-${i}`, gate: "Gate 1", source: "ONLINE", pax: 1, scannedAt: new Date(now - i * 60_000) })));

  // Other tenants for the admin KPI charts
  const tenants: { name: string; plan: string; amount: number; interval: string; startedDaysAgo: number; canceledDaysAgo?: number }[] = [
    { name: "Bima & Citra", plan: "premium", amount: 299000, interval: "MONTH", startedDaysAgo: 150 },
    { name: "Dika & Elsa", plan: "premium", amount: 299000, interval: "MONTH", startedDaysAgo: 120, canceledDaysAgo: 40 },
    { name: "Fajar & Gita", plan: "exclusive", amount: 9588000, interval: "YEAR", startedDaysAgo: 100 },
    { name: "Hendra & Intan", plan: "premium", amount: 299000, interval: "MONTH", startedDaysAgo: 70 },
    { name: "Joko & Kirana", plan: "exclusive", amount: 799000, interval: "MONTH", startedDaysAgo: 45 },
    { name: "Lutfi & Maya", plan: "free", amount: 0, interval: "MONTH", startedDaysAgo: 30 },
    { name: "Naufal & Olla", plan: "premium", amount: 299000, interval: "MONTH", startedDaysAgo: 15 },
  ];
  for (const [i, t] of tenants.entries()) {
    const [u] = await db.insert(s.users).values({ email: `tenant${i + 1}@weddingos.test`, name: t.name, passwordHash: hashPassword("Tenant1234!"), createdAt: new Date(now - t.startedDaysAgo * DAY) }).returning();
    if (!u) continue;
    const [w] = await db.insert(s.workspaces).values({ name: t.name, ownerId: u.id, planId: t.canceledDaysAgo ? "free" : t.plan, createdAt: new Date(now - t.startedDaysAgo * DAY) }).returning();
    if (!w) continue;
    await db.insert(s.memberships).values({ workspaceId: w.id, userId: u.id, role: "OWNER" });
    if (t.amount > 0) {
      await db.insert(s.subscriptions).values({ workspaceId: w.id, planId: t.plan, amountIdr: t.amount, interval: t.interval, status: t.canceledDaysAgo ? "CANCELED" : "ACTIVE", startedAt: new Date(now - t.startedDaysAgo * DAY), canceledAt: t.canceledDaysAgo ? new Date(now - t.canceledDaysAgo * DAY) : null });
      await db.insert(s.payments).values({ workspaceId: w.id, planId: t.plan, amountIdr: t.amount, status: "PAID", paidAt: new Date(now - t.startedDaysAgo * DAY), createdAt: new Date(now - t.startedDaysAgo * DAY) });
    }
  }
  await db.insert(s.auditLogs).values({ action: "seed", target: "system", meta: { by: "seed" } });
}
