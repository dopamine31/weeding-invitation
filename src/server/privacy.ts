import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { purgeEventMedia } from "./media";

/** UU PDP: irreversibly strip personal data of an event's guests (keeps aggregate RSVP stats). */
export async function anonymizeEvent(eventId: string): Promise<number> {
  const rows = await db.select({ id: s.guests.id }).from(s.guests).where(and(eq(s.guests.eventId, eventId), sql`${s.guests.anonymizedAt} is null`));
  let i = 0;
  for (const g of rows) {
    i++;
    await db.update(s.guests).set({ name: `Tamu #${i}`, normName: `tamu ${i}`, phone: null, email: null, notes: "", anonymizedAt: new Date() }).where(eq(s.guests.id, g.id));
  }
  if (rows.length) {
    await db.update(s.wishes).set({ name: "Anonim" }).where(inArray(s.wishes.guestId, rows.map((r) => r.id)));
    await db.update(s.blastMessages).set({ phone: "", body: "" }).where(eq(s.blastMessages.eventId, eventId));
  }
  return rows.length;
}

/** Run by the worker hourly: anonymise events whose last sub-event ended more than `retentionDays` ago. */
export async function runRetention(now = new Date()): Promise<number> {
  const evs = await db.select().from(s.events);
  let total = 0;
  for (const ev of evs) {
    const [last] = await db.select({ t: sql<Date | null>`max(coalesce(${s.subEvents.endsAt}, ${s.subEvents.startsAt}))` }).from(s.subEvents).where(eq(s.subEvents.eventId, ev.id));
    if (!last?.t) continue;
    if (new Date(last.t).getTime() + ev.retentionDays * 86_400_000 < now.getTime()) total += await anonymizeEvent(ev.id);
  }
  return total;
}

const EVENT_TABLES = [s.subEvents, s.pics, s.guestGroups, s.guests, s.linkOpens, s.menuOptions, s.rsvps, s.tables, s.seatAssignments, s.wishes, s.giftAccounts, s.wishlistItems, s.blastCampaigns, s.blastMessages, s.checkIns, s.consentLogs, s.media] as const;

export async function deleteEventData(eventId: string): Promise<void> {
  await purgeEventMedia(eventId);
  await db.transaction(async (tx) => {
    const wishIds = await tx.select({ id: s.wishes.id }).from(s.wishes).where(eq(s.wishes.eventId, eventId));
    if (wishIds.length) await tx.delete(s.moderationLogs).where(inArray(s.moderationLogs.wishId, wishIds.map((w) => w.id)));
    for (const t of EVENT_TABLES) await tx.delete(t).where(eq(t.eventId, eventId));
    await tx.delete(s.events).where(eq(s.events.id, eventId));
  });
}
