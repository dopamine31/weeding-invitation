import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { currentEventPage } from "@/server/auth";
import { BlastClient } from "@/components/dashboard/BlastClient";
import { previewVars } from "@/server/blast";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blast WhatsApp" };

export default async function BlastPage() {
  const { event } = await currentEventPage();
  const [groups, guests, camps] = await Promise.all([
    db.select().from(s.guestGroups).where(eq(s.guestGroups.eventId, event.id)),
    db.select().from(s.guests).where(eq(s.guests.eventId, event.id)).orderBy(asc(s.guests.name)),
    db.select().from(s.blastCampaigns).where(eq(s.blastCampaigns.eventId, event.id)).orderBy(desc(s.blastCampaigns.createdAt)).limit(10),
  ]);
  const first = guests[0];
  const sample = first ? await previewVars(event.id, first) : { nama: "Tamu", link: "", nama_mempelai: `${event.groomName} & ${event.brideName}` };
  const counts = new Map<string, Record<string, number>>();
  if (camps.length) {
    const r = (await db.execute(sql`select campaign_id, status, count(*)::int as n from blast_messages where event_id = ${event.id} group by campaign_id, status`)) as unknown as { rows: { campaign_id: string; status: string; n: number }[] };
    for (const x of r.rows) counts.set(x.campaign_id, { ...(counts.get(x.campaign_id) ?? {}), [x.status]: x.n });
  }
  return <BlastClient eventId={event.id} groups={groups.map((g) => ({ id: g.id, name: g.name }))} withPhone={guests.filter((g) => g.phone && !g.optedOut).length} sample={sample} campaigns={camps.map((c) => ({ id: c.id, name: c.name, status: c.status, counts: counts.get(c.id) ?? {} }))} />;
}
