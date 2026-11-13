import { asc, eq, sql, and } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { currentEventPage } from "@/server/auth";
import { SeatingClient } from "@/components/dashboard/SeatingClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Denah Meja" };

export default async function SeatingPage() {
  const { event } = await currentEventPage();
  const [tables, seats, guests, groups, pax] = await Promise.all([
    db.select().from(s.tables).where(eq(s.tables.eventId, event.id)).orderBy(asc(s.tables.name)),
    db.select().from(s.seatAssignments).where(eq(s.seatAssignments.eventId, event.id)),
    db.select().from(s.guests).where(eq(s.guests.eventId, event.id)).orderBy(asc(s.guests.name)),
    db.select().from(s.guestGroups).where(eq(s.guestGroups.eventId, event.id)),
    db.select({ guestId: s.rsvps.guestId, pax: sql<number>`max(${s.rsvps.pax})::int` }).from(s.rsvps).where(and(eq(s.rsvps.eventId, event.id), eq(s.rsvps.status, "attending"))).groupBy(s.rsvps.guestId),
  ]);
  const seatBy = new Map(seats.map((x) => [x.guestId, x.tableId]));
  const gName = new Map(groups.map((g) => [g.id, g.name]));
  const paxBy = new Map(pax.map((p) => [p.guestId, Math.max(1, p.pax)]));
  const list = guests.filter((g) => paxBy.has(g.id) || seatBy.has(g.id)).map((g) => ({ id: g.id, name: g.name, pax: paxBy.get(g.id) ?? 1, group: g.groupId ? gName.get(g.groupId) ?? "" : "", tableId: seatBy.get(g.id) ?? null }));
  return <SeatingClient eventId={event.id} tables={tables.map((t) => ({ id: t.id, name: t.name, shape: t.shape, capacity: t.capacity, x: t.x, y: t.y, rotation: t.rotation }))} guests={list} />;
}
