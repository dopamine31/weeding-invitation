import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { currentEventPage } from "@/server/auth";
import { GuestsClient, type GuestRow } from "@/components/dashboard/GuestsClient";
import { appUrl } from "@/server/blast";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tamu" };

export default async function GuestsPage() {
  const { event } = await currentEventPage();
  const [guests, groups, rsvps, msgs, opens, seats] = await Promise.all([
    db.select().from(s.guests).where(eq(s.guests.eventId, event.id)).orderBy(asc(s.guests.name)),
    db.select().from(s.guestGroups).where(eq(s.guestGroups.eventId, event.id)),
    db.select({ guestId: s.rsvps.guestId, status: s.rsvps.status }).from(s.rsvps).where(eq(s.rsvps.eventId, event.id)),
    db.select({ guestId: s.blastMessages.guestId }).from(s.blastMessages).where(and(eq(s.blastMessages.eventId, event.id), inArray(s.blastMessages.status, ["SENT", "DELIVERED", "READ"]))),
    db.select({ guestId: s.linkOpens.guestId }).from(s.linkOpens).where(eq(s.linkOpens.eventId, event.id)),
    db.select({ guestId: s.seatAssignments.guestId, name: s.tables.name }).from(s.seatAssignments).innerJoin(s.tables, eq(s.tables.id, s.seatAssignments.tableId)).where(eq(s.seatAssignments.eventId, event.id)),
  ]);
  const gName = new Map(groups.map((g) => [g.id, g.name]));
  const rs = new Map<string, string>();
  for (const r of rsvps) if (r.status === "attending" || !rs.has(r.guestId)) rs.set(r.guestId, r.status);
  const sent = new Set(msgs.map((m) => m.guestId));
  const opened = new Set(opens.map((o) => o.guestId));
  const seat = new Map(seats.map((x) => [x.guestId, x.name]));
  const rows: GuestRow[] = guests.map((g) => ({ id: g.id, name: g.name, phone: g.phone ?? "", email: g.email ?? "", group: g.groupId ? gName.get(g.groupId) ?? "" : "", category: g.category, maxPax: g.maxPax, notes: g.notes, token: g.token, optedOut: g.optedOut, rsvp: rs.get(g.id) ?? null, sent: sent.has(g.id), opened: opened.has(g.id), table: seat.get(g.id) ?? "" }));
  return <GuestsClient eventId={event.id} slug={event.slug} base={appUrl()} rows={rows} groups={groups.map((g) => g.name)} />;
}
