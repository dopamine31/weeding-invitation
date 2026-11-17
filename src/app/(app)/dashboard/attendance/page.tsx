import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { currentEventPage } from "@/server/auth";
import { AttendanceList, type AttendanceRow } from "@/components/dashboard/AttendanceList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kehadiran" };

export default async function AttendancePage() {
  const { event } = await currentEventPage();
  const [guests, rsvps, checkIns, selfies] = await Promise.all([
    db.select({ id: s.guests.id, name: s.guests.name }).from(s.guests).where(eq(s.guests.eventId, event.id)),
    db.select({ guestId: s.rsvps.guestId, status: s.rsvps.status }).from(s.rsvps).where(eq(s.rsvps.eventId, event.id)),
    db.select({ guestId: s.checkIns.guestId, at: s.checkIns.scannedAt }).from(s.checkIns).where(eq(s.checkIns.eventId, event.id)),
    db.select({ id: s.media.id, guestId: s.media.guestId }).from(s.media).where(and(eq(s.media.eventId, event.id), eq(s.media.kind, "SELFIE"))),
  ]);

  const rank: Record<string, number> = { attending: 3, maybe: 2, declined: 1 };
  const status = new Map<string, string>();
  for (const r of rsvps) {
    if (!r.guestId) continue;
    if ((rank[r.status] ?? 0) > (rank[status.get(r.guestId) ?? ""] ?? 0)) status.set(r.guestId, r.status);
  }
  const seen = new Map<string, Date>();
  for (const c of checkIns) {
    if (!c.guestId || !c.at) continue;
    const prev = seen.get(c.guestId);
    if (!prev || c.at < prev) seen.set(c.guestId, c.at);
  }
  const pic = new Map<string, string>();
  for (const m of selfies) {
    if (!m.guestId) continue;
    pic.set(m.guestId, m.id);
  }

  const rows: AttendanceRow[] = guests
    .filter((g) => status.get(g.id) === "attending" || seen.has(g.id))
    .map((g) => ({
      id: g.id,
      name: g.name,
      rsvp: status.get(g.id) ?? "none",
      checkedInAt: seen.get(g.id)?.toISOString() ?? null,
      selfieId: pic.get(g.id) ?? null,
    }))
    .sort((a, b) => (a.checkedInAt ? 0 : 1) - (b.checkedInAt ? 0 : 1) || a.name.localeCompare(b.name));

  return <AttendanceList eventId={event.id} rows={rows} />;
}
