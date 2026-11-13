import { NextResponse } from "next/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { safeEqual } from "@/lib/crypto";
import { sseResponse } from "@/server/sse";
import { planOf } from "@/server/entitlements";

export const dynamic = "force-dynamic";

/** SSE for TV mode. Auth = tvKey of the event. Only APPROVED wishes are ever emitted. */
export async function GET(req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const [ev] = await db.select().from(s.events).where(eq(s.events.id, eventId)).limit(1).catch(() => []);
  if (!ev || !safeEqual(key, ev.tvKey)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await planOf(ev.workspaceId)).tvMode) return NextResponse.json({ error: "plan" }, { status: 402 });
  const since = new Date(Date.now() - 15_000);
  return sseResponse(req, async () => {
    const wishes = await db.select({ id: s.wishes.id, name: s.wishes.name, message: s.wishes.message, pinned: s.wishes.pinned }).from(s.wishes).where(and(eq(s.wishes.eventId, eventId), eq(s.wishes.status, "APPROVED"))).orderBy(desc(s.wishes.pinned), desc(s.wishes.createdAt)).limit(30);
    const arrivals = await db.select({ id: s.checkIns.id, name: s.guests.name, walk: s.checkIns.walkInName, at: s.checkIns.scannedAt }).from(s.checkIns).leftJoin(s.guests, eq(s.guests.id, s.checkIns.guestId)).where(and(eq(s.checkIns.eventId, eventId), gt(s.checkIns.scannedAt, since))).orderBy(desc(s.checkIns.scannedAt)).limit(5);
    return { wishes, arrivals: arrivals.map((a) => ({ id: a.id, name: a.name ?? a.walk ?? "Tamu" })) };
  }, 4000);
}
