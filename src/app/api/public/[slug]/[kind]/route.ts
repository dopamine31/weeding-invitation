import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { approvedWishes, findEventBySlug } from "@/server/invitation";
import { rateLimit } from "@/lib/rate-limit";
import { normName } from "@/lib/import";
import { buildIcs } from "@/lib/ics";

export const dynamic = "force-dynamic";

function mask(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.map((p, i) => (i === 0 ? p : `${p.charAt(0)}.`)).join(" ");
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await ctx.params;
  const ev = await findEventBySlug(slug);
  if (!ev || ev.status === "DRAFT") return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (kind === "wishes") return NextResponse.json(await approvedWishes(ev.id), { headers: { "Cache-Control": "no-store" } });

  if (kind === "seat") {
    const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0]?.trim() ?? "local";
    const rl = rateLimit(`seat:${ip}`, 30, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
    const q = normName(req.nextUrl.searchParams.get("q") ?? "");
    if (q.length < 3) return NextResponse.json([]);
    const safe = q.replace(/[%_\\]/g, "");
    const rows = await db
      .select({ name: s.guests.name, table: s.tables.name })
      .from(s.guests)
      .leftJoin(s.seatAssignments, eq(s.seatAssignments.guestId, s.guests.id))
      .leftJoin(s.tables, eq(s.tables.id, s.seatAssignments.tableId))
      .where(and(eq(s.guests.eventId, ev.id), like(s.guests.normName, `%${safe}%`)))
      .orderBy(asc(s.guests.name))
      .limit(5);
    return NextResponse.json(rows.map((r) => ({ name: mask(r.name), table: r.table })));
  }

  if (kind === "calendar") {
    const subs = await db.select().from(s.subEvents).where(eq(s.subEvents.eventId, ev.id));
    const ics = buildIcs(subs.map((x) => ({ uid: x.id, title: `${x.name} · ${ev.title}`, start: x.startsAt, end: x.endsAt, location: `${x.venue}, ${x.address}` })));
    return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${ev.slug}.ics"` } });
  }
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
