import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { currentEventPage } from "@/server/auth";
import { BlastManual } from "@/components/dashboard/BlastManual";
import { allGuestVars } from "@/server/blast";
import type { TemplateVars } from "@/lib/spintax";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kirim Undangan WhatsApp" };

export default async function BlastPage() {
  const { event } = await currentEventPage();
  const guests = await db.select().from(s.guests).where(eq(s.guests.eventId, event.id)).orderBy(asc(s.guests.name));
  const vars = await allGuestVars(event.id, guests);
  return (
    <BlastManual
      eventId={event.id}
      guests={guests.map((g) => ({ id: g.id, name: g.name, phone: g.phone, optedOut: g.optedOut, sentAt: g.waSentAt ? g.waSentAt.toISOString() : null, vars: vars[g.id] as TemplateVars }))}
    />
  );
}
