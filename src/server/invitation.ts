import { listGallery } from "./media";
import QRCode from "qrcode";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { asTz, type Tz } from "@/lib/tz";
import { migrateConfig, type InvitationConfig } from "@/lib/invitation-config";
import { signQr } from "@/lib/qr";
import type { WishItem } from "@/components/invitation/client";

export interface InvEvent {
  id: string; slug: string; title: string; timezone: Tz; language: string; templateSlug: string;
  groomName: string; brideName: string; groomFull: string; brideFull: string; groomParents: string; brideParents: string;
  status: string; noindex: boolean; config: InvitationConfig;
}
export interface InvSub { id: string; name: string; startsAt: string; endsAt: string | null; venue: string; address: string; mapsUrl: string; dressCode: string; streamingUrl: string }
export interface InvGuest {
  id: string; token: string; name: string; maxPax: number; table: string | null;
  rsvps: { subEventId: string; status: string; pax: number; menuId: string | null; allergy: string }[];
  qr: Record<string, string>;
}
export interface InvData {
  event: InvEvent;
  subEvents: InvSub[];
  pics: { id: string; name: string; phone: string; role: string }[];
  gifts: { id: string; type: string; provider: string; accountNumber: string; accountName: string }[];
  wishlist: { id: string; name: string; claimedBy: string | null }[];
  menus: { id: string; name: string }[];
  wishes: WishItem[];
  guest: InvGuest | null;
  gallery?: { id: string }[];
  demo: boolean;
}

export async function findEventBySlug(slug: string) {
  const [ev] = await db.select().from(s.events).where(eq(s.events.slug, slug)).limit(1);
  return ev ?? null;
}

export async function approvedWishes(eventId: string): Promise<WishItem[]> {
  const rows = await db
    .select()
    .from(s.wishes)
    .where(and(eq(s.wishes.eventId, eventId), eq(s.wishes.status, "APPROVED")))
    .orderBy(desc(s.wishes.pinned), desc(s.wishes.createdAt))
    .limit(60);
  return rows.map((w) => ({ id: w.id, name: w.name, message: w.message, reply: w.reply, pinned: w.pinned }));
}

export async function loadInvData(ev: typeof s.events.$inferSelect, guestToken: string | null): Promise<InvData> {
  const [subs, pics, gifts, wishlist, menus, wishes] = await Promise.all([
    db.select().from(s.subEvents).where(eq(s.subEvents.eventId, ev.id)).orderBy(asc(s.subEvents.sort), asc(s.subEvents.startsAt)),
    db.select().from(s.pics).where(eq(s.pics.eventId, ev.id)).orderBy(asc(s.pics.sort)),
    db.select().from(s.giftAccounts).where(eq(s.giftAccounts.eventId, ev.id)),
    db.select().from(s.wishlistItems).where(eq(s.wishlistItems.eventId, ev.id)),
    db.select().from(s.menuOptions).where(eq(s.menuOptions.eventId, ev.id)),
    approvedWishes(ev.id),
  ]);
  const gallery = await listGallery(ev.id);
  let guest: InvGuest | null = null;
  if (guestToken) {
    const [g] = await db.select().from(s.guests).where(and(eq(s.guests.token, guestToken), eq(s.guests.eventId, ev.id))).limit(1);
    if (g) {
      const rs = await db.select().from(s.rsvps).where(eq(s.rsvps.guestId, g.id));
      const [seat] = await db
        .select({ name: s.tables.name })
        .from(s.seatAssignments)
        .innerJoin(s.tables, eq(s.tables.id, s.seatAssignments.tableId))
        .where(eq(s.seatAssignments.guestId, g.id))
        .limit(1);
      const qr: Record<string, string> = {};
      for (const r of rs) if (r.status === "attending") qr[r.subEventId] = await QRCode.toDataURL(signQr(g.id, r.subEventId), { margin: 1, width: 240 });
      guest = { id: g.id, token: g.token, name: g.name, maxPax: g.maxPax, table: seat?.name ?? null, rsvps: rs.map((r) => ({ subEventId: r.subEventId, status: r.status, pax: r.pax, menuId: r.menuId, allergy: r.allergy })), qr };
    }
  }
  return {
    event: {
      id: ev.id, slug: ev.slug, title: ev.title, timezone: asTz(ev.timezone), language: ev.language, templateSlug: ev.templateSlug,
      groomName: ev.groomName, brideName: ev.brideName, groomFull: ev.groomFull, brideFull: ev.brideFull, groomParents: ev.groomParents, brideParents: ev.brideParents,
      status: ev.status, noindex: ev.noindex, config: migrateConfig(ev.config),
    },
    subEvents: subs.map((x) => ({ id: x.id, name: x.name, startsAt: x.startsAt.toISOString(), endsAt: x.endsAt?.toISOString() ?? null, venue: x.venue, address: x.address, mapsUrl: x.mapsUrl, dressCode: x.dressCode, streamingUrl: x.streamingUrl })),
    pics: pics.map((p) => ({ id: p.id, name: p.name, phone: p.phone, role: p.role })),
    gifts: gifts.map((g) => ({ id: g.id, type: g.type, provider: g.provider, accountNumber: g.accountNumber, accountName: g.accountName })),
    wishlist: wishlist.map((w) => ({ id: w.id, name: w.name, claimedBy: w.claimedBy })),
    menus: menus.map((m) => ({ id: m.id, name: m.name })),
    wishes,
    guest,
    gallery,
    demo: false,
  };
}

/** Static sample used by marketing previews (no DB access). */
export function sampleInvData(templateSlug: string): InvData {
  const start = new Date(Date.now() + 60 * 86_400_000);
  start.setUTCHours(2, 0, 0, 0);
  const iso = (d: Date) => d.toISOString();
  return {
    event: {
      id: "sample", slug: "sample", title: "The Wedding of Raka & Anindya", timezone: "WIB", language: "id", templateSlug,
      groomName: "Raka", brideName: "Anindya", groomFull: "Raka Pratama, S.T.", brideFull: "Anindya Putri Maharani, S.Ds.",
      groomParents: "Bapak Hadi Pratama & Ibu Sri Wahyuni", brideParents: "Bapak Bambang Maharani & Ibu Retno Lestari", status: "PUBLISHED", noindex: true,
      config: migrateConfig({
        texts: {
          quote: "Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan hidup agar kamu merasa tenteram kepadanya.", quoteSource: "QS. Ar-Rum: 21",
          greeting: "Dengan memohon rahmat dan ridho Allah SWT, kami mengundang Bapak/Ibu/Saudara/i untuk hadir pada pernikahan kami.", thanks: "Terima kasih atas doa dan kehadiran Anda.",
          dressNote: "Mohon berpakaian dengan nuansa senada.", dressColors: ["#B89B5E", "#E7D9BF", "#2B2A28"], customary: ["Mohon tidak membawa karangan bunga."],
          loveStory: [{ date: "2019", title: "Bertemu", text: "Pertemuan singkat di sebuah pameran seni." }, { date: "2022", title: "Melamar", text: "Sebuah janji di tepi danau saat senja." }, { date: "2025", title: "Menikah", text: "Melangkah ke pelaminan bersama restu keluarga." }],
        },
      }),
    },
    subEvents: [
      { id: "s1", name: "Akad Nikah", startsAt: iso(start), endsAt: null, venue: "Masjid Agung", address: "Jl. Asia Afrika No. 12, Bandung", mapsUrl: "https://maps.google.com/?q=Masjid+Agung+Bandung", dressCode: "", streamingUrl: "" },
      { id: "s2", name: "Resepsi", startsAt: iso(new Date(start.getTime() + 3 * 3600_000)), endsAt: null, venue: "Gedung Sasana Budaya", address: "Jl. Merdeka No. 45, Bandung", mapsUrl: "", dressCode: "Batik / formal", streamingUrl: "" },
    ],
    pics: [{ id: "p1", name: "Dimas", phone: "+6281234500001", role: "PIC" }],
    gifts: [{ id: "g1", type: "BANK", provider: "BCA", accountNumber: "1234567890", accountName: "Raka Pratama" }],
    wishlist: [{ id: "w1", name: "Air Fryer", claimedBy: null }],
    menus: [{ id: "m1", name: "Nasi Bakar Ayam" }],
    wishes: [{ id: "x1", name: "Budi", message: "Selamat menempuh hidup baru!", reply: null, pinned: true }],
    guest: null,
    demo: true,
  };
}
