import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { randomToken } from "@/lib/crypto";
import { renderTemplate, type TemplateVars } from "@/lib/spintax";
import { DEFAULT_SETTINGS, MAX_ATTEMPTS, backoffMs, idempotencyKey, inWindow, nextWindowStart, planSchedule, type BlastSettings } from "@/lib/throttle";
import { asTz, formatDate } from "@/lib/tz";

/* ---------------- Provider adapters ---------------- */
export interface WhatsAppProvider {
  name: string;
  send(to: string, body: string, idempotencyKey: string): Promise<{ providerMessageId: string }>;
}

class MockProvider implements WhatsAppProvider {
  name = "mock";
  async send(to: string): Promise<{ providerMessageId: string }> {
    if (Math.random() < 0.08) throw new Error(`Mock: ${to} tidak terdaftar di WhatsApp (simulasi)`);
    return { providerMessageId: `mock_${randomToken(6)}` };
  }
}

class FonnteProvider implements WhatsAppProvider {
  name = "fonnte";
  async send(to: string, body: string): Promise<{ providerMessageId: string }> {
    const token = process.env.FONNTE_TOKEN;
    if (!token) throw new Error("FONNTE_TOKEN belum diatur");
    const res = await fetch("https://api.fonnte.com/send", { method: "POST", headers: { Authorization: token }, body: new URLSearchParams({ target: to.replace("+", ""), message: body }) });
    const json = (await res.json()) as { status?: boolean; reason?: string; id?: string[] };
    if (!json.status) throw new Error(json.reason ?? `Fonnte HTTP ${res.status}`);
    return { providerMessageId: json.id?.[0] ?? `fonnte_${randomToken(6)}` };
  }
}

class CloudApiProvider implements WhatsAppProvider {
  name = "cloud";
  async send(to: string, body: string): Promise<{ providerMessageId: string }> {
    const token = process.env.WA_CLOUD_TOKEN;
    const phoneId = process.env.WA_CLOUD_PHONE_ID;
    if (!token || !phoneId) throw new Error("WA_CLOUD_TOKEN / WA_CLOUD_PHONE_ID belum diatur");
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace("+", ""), type: "text", text: { body } }),
    });
    const json = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
    const id = json.messages?.[0]?.id;
    if (!res.ok || !id) throw new Error(json.error?.message ?? `Cloud API HTTP ${res.status}`);
    return { providerMessageId: id };
  }
}

export function getProvider(): WhatsAppProvider {
  switch (process.env.WA_PROVIDER) {
    case "fonnte": return new FonnteProvider();
    case "cloud": return new CloudApiProvider();
    default: return new MockProvider();
  }
}

/* ---------------- Campaign creation ---------------- */
export interface Segment { kind: "all" | "group" | "notRsvp" | "noOpen" | "attending"; groupId?: string }

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function segmentGuests(eventId: string, seg: Segment) {
  const all = await db.select().from(s.guests).where(eq(s.guests.eventId, eventId));
  if (seg.kind === "all") return all;
  if (seg.kind === "group") return all.filter((g) => g.groupId === seg.groupId);
  const rs = await db.select({ guestId: s.rsvps.guestId, status: s.rsvps.status }).from(s.rsvps).where(eq(s.rsvps.eventId, eventId));
  const responded = new Set(rs.map((r) => r.guestId));
  if (seg.kind === "notRsvp") return all.filter((g) => !responded.has(g.id));
  if (seg.kind === "attending") {
    const att = new Set(rs.filter((r) => r.status === "attending").map((r) => r.guestId));
    return all.filter((g) => att.has(g.id));
  }
  const opens = await db.select({ guestId: s.linkOpens.guestId }).from(s.linkOpens).where(eq(s.linkOpens.eventId, eventId));
  const opened = new Set(opens.map((o) => o.guestId));
  return all.filter((g) => !opened.has(g.id));
}

export async function previewVars(eventId: string, guest: { id: string; name: string; token: string }): Promise<TemplateVars> {
  const [ev] = await db.select().from(s.events).where(eq(s.events.id, eventId)).limit(1);
  const [pic] = await db.select().from(s.pics).where(eq(s.pics.eventId, eventId)).orderBy(asc(s.pics.sort)).limit(1);
  const [sub] = await db.select().from(s.subEvents).where(eq(s.subEvents.eventId, eventId)).orderBy(asc(s.subEvents.startsAt)).limit(1);
  const [seat] = await db.select({ name: s.tables.name }).from(s.seatAssignments).innerJoin(s.tables, eq(s.tables.id, s.seatAssignments.tableId)).where(eq(s.seatAssignments.guestId, guest.id)).limit(1);
  const tz = asTz(ev?.timezone ?? "WIB");
  return {
    nama: guest.name,
    link: `${appUrl()}/i/${ev?.slug}?to=${encodeURIComponent(guest.name)}&g=${guest.token}`,
    pic_nama: pic?.name ?? "",
    pic_wa: pic?.phone ?? "",
    nama_mempelai: ev ? `${ev.groomName} & ${ev.brideName}` : "",
    tanggal: sub ? formatDate(sub.startsAt, tz, "id-ID", { dateStyle: "full" }) : "",
    lokasi: sub ? `${sub.venue}, ${sub.address}` : "",
    meja: seat?.name ?? "",
  };
}

export async function enqueueCampaign(campaignId: string): Promise<{ queued: number; skipped: number }> {
  const [camp] = await db.select().from(s.blastCampaigns).where(eq(s.blastCampaigns.id, campaignId)).limit(1);
  if (!camp) throw new Error("Kampanye tidak ditemukan");
  const [ev] = await db.select().from(s.events).where(eq(s.events.id, camp.eventId)).limit(1);
  if (!ev) throw new Error("Event tidak ditemukan");
  const settings: BlastSettings = { ...DEFAULT_SETTINGS, ...(camp.settings as Partial<BlastSettings>) };
  const guests = await segmentGuests(camp.eventId, camp.segment as Segment);
  const sendable = guests.filter((g) => g.phone && !g.optedOut);
  const times = planSchedule(sendable.length, settings, asTz(ev.timezone), new Date());
  const rows: (typeof s.blastMessages.$inferInsert)[] = [];
  const base = await Promise.all(
    guests.map(async (g) => ({ g, vars: await previewVars(camp.eventId, g) })),
  );
  let k = 0;
  for (const { g, vars } of base) {
    const ok = !!g.phone && !g.optedOut;
    rows.push({
      campaignId, eventId: camp.eventId, guestId: g.id, phone: g.phone ?? "", body: renderTemplate(camp.template, vars),
      status: ok ? "QUEUED" : "SKIPPED", error: ok ? null : g.optedOut ? "Tamu opt-out (STOP)" : "Tidak ada nomor telepon",
      idempotencyKey: idempotencyKey(campaignId, g.id), sendAfter: ok ? (times[k++] as Date) : new Date(),
    });
  }
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const r = await db.insert(s.blastMessages).values(rows.slice(i, i + 500)).onConflictDoNothing({ target: s.blastMessages.idempotencyKey }).returning({ id: s.blastMessages.id });
    inserted += r.length;
  }
  await db.update(s.blastCampaigns).set({ status: "RUNNING" }).where(eq(s.blastCampaigns.id, campaignId));
  return { queued: sendable.length, skipped: guests.length - sendable.length + (rows.length - inserted) * 0 };
}

/* ---------------- Queue processing (Postgres-backed) ---------------- */
export async function processDue(now: Date = new Date(), eventId?: string): Promise<{ sent: number; failed: number; retried: number }> {
  const out = { sent: 0, failed: 0, retried: 0 };
  const provider = getProvider();
  const due = await db
    .select({ m: s.blastMessages, c: s.blastCampaigns, tz: s.events.timezone })
    .from(s.blastMessages)
    .innerJoin(s.blastCampaigns, eq(s.blastCampaigns.id, s.blastMessages.campaignId))
    .innerJoin(s.events, eq(s.events.id, s.blastMessages.eventId))
    .where(and(eq(s.blastMessages.status, "QUEUED"), eq(s.blastCampaigns.status, "RUNNING"), lte(s.blastMessages.sendAfter, now), eventId ? eq(s.blastMessages.eventId, eventId) : undefined))
    .orderBy(asc(s.blastMessages.sendAfter))
    .limit(25);
  for (const { m, c, tz } of due) {
    const settings: BlastSettings = { ...DEFAULT_SETTINGS, ...(c.settings as Partial<BlastSettings>) };
    if (!inWindow(now, asTz(tz), settings)) {
      await db.update(s.blastMessages).set({ sendAfter: nextWindowStart(now, asTz(tz), settings), updatedAt: now }).where(eq(s.blastMessages.id, m.id));
      continue;
    }
    // Atomic claim: only one worker can move QUEUED -> SENDING (idempotent under concurrency).
    const claimed = await db.update(s.blastMessages).set({ status: "SENDING", attempt: sql`${s.blastMessages.attempt} + 1`, updatedAt: now }).where(and(eq(s.blastMessages.id, m.id), eq(s.blastMessages.status, "QUEUED"))).returning();
    const row = claimed[0];
    if (!row) continue;
    try {
      const r = await provider.send(row.phone, row.body, row.idempotencyKey);
      await db.update(s.blastMessages).set({ status: "SENT", providerMessageId: r.providerMessageId, sentAt: new Date(), error: null, updatedAt: new Date() }).where(eq(s.blastMessages.id, row.id));
      out.sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal mengirim";
      if (row.attempt < MAX_ATTEMPTS) {
        await db.update(s.blastMessages).set({ status: "QUEUED", error: msg, sendAfter: new Date(Date.now() + backoffMs(row.attempt)), updatedAt: new Date() }).where(eq(s.blastMessages.id, row.id));
        out.retried++;
      } else {
        await db.update(s.blastMessages).set({ status: "FAILED", error: msg, updatedAt: new Date() }).where(eq(s.blastMessages.id, row.id));
        out.failed++;
      }
    }
  }
  // Mock delivery receipts (a real provider would call /api/webhooks/whatsapp instead)
  await db.execute(sql`update blast_messages set status='DELIVERED', updated_at=now() where status='SENT' and provider_message_id like 'mock_%' and sent_at < now() - interval '3 seconds'`);
  await db.execute(sql`update blast_messages set status='READ', updated_at=now() where status='DELIVERED' and provider_message_id like 'mock_%' and sent_at < now() - interval '8 seconds' and random() < 0.7`);
  // Close finished campaigns
  const running = await db.select({ id: s.blastCampaigns.id }).from(s.blastCampaigns).where(and(eq(s.blastCampaigns.status, "RUNNING"), eventId ? eq(s.blastCampaigns.eventId, eventId) : undefined));
  for (const r of running) {
    const [pending] = await db.select({ n: sql<number>`count(*)::int` }).from(s.blastMessages).where(and(eq(s.blastMessages.campaignId, r.id), inArray(s.blastMessages.status, ["QUEUED", "SENDING"])));
    if (!pending?.n) await db.update(s.blastCampaigns).set({ status: "DONE" }).where(eq(s.blastCampaigns.id, r.id));
  }
  return out;
}

export async function handleOptOut(phone: string, text: string): Promise<boolean> {
  if (!/^\s*(stop|berhenti|unsubscribe)\s*$/i.test(text)) return false;
  const guestsRows = await db.update(s.guests).set({ optedOut: true }).where(eq(s.guests.phone, phone)).returning({ id: s.guests.id });
  if (guestsRows.length) await db.update(s.blastMessages).set({ status: "SKIPPED", error: "Opt-out (STOP)" }).where(and(inArray(s.blastMessages.guestId, guestsRows.map((g) => g.id)), eq(s.blastMessages.status, "QUEUED")));
  return true;
}

/** Variabel template untuk banyak tamu sekaligus (blast manual lewat WhatsApp pribadi). */
export async function allGuestVars(eventId: string, list: { id: string; name: string; token: string }[]): Promise<Record<string, TemplateVars>> {
  const [ev] = await db.select().from(s.events).where(eq(s.events.id, eventId)).limit(1);
  const [pic] = await db.select().from(s.pics).where(eq(s.pics.eventId, eventId)).orderBy(asc(s.pics.sort)).limit(1);
  const [sub] = await db.select().from(s.subEvents).where(eq(s.subEvents.eventId, eventId)).orderBy(asc(s.subEvents.startsAt)).limit(1);
  const ids = list.map((g) => g.id);
  const seats = ids.length ? await db.select({ guestId: s.seatAssignments.guestId, name: s.tables.name }).from(s.seatAssignments).innerJoin(s.tables, eq(s.tables.id, s.seatAssignments.tableId)).where(inArray(s.seatAssignments.guestId, ids)) : [];
  const seatBy = new Map(seats.map((x) => [x.guestId, x.name]));
  const tz = asTz(ev?.timezone ?? "WIB");
  const out: Record<string, TemplateVars> = {};
  for (const g of list) {
    out[g.id] = {
      nama: g.name,
      link: `${appUrl()}/i/${ev?.slug}?to=${encodeURIComponent(g.name)}&g=${g.token}`,
      pic_nama: pic?.name ?? "",
      pic_wa: pic?.phone ?? "",
      nama_mempelai: ev ? `${ev.groomName} & ${ev.brideName}` : "",
      tanggal: sub ? formatDate(sub.startsAt, tz, "id-ID", { dateStyle: "full" }) : "",
      lokasi: sub ? `${sub.venue}, ${sub.address}` : "",
      meja: seatBy.get(g.id) ?? "",
    };
  }
  return out;
}
