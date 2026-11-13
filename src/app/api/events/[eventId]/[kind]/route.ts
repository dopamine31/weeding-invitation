import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { AccessError, requireEventAccess } from "@/server/auth";
import { getStats } from "@/server/stats";
import { sseResponse } from "@/server/sse";
import { processDue } from "@/server/blast";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function authorise(eventId: string) {
  try {
    return await requireEventAccess(eventId, "VIEWER");
  } catch (e) {
    if (e instanceof AccessError) return null;
    throw e;
  }
}

/** GET /api/events/:id/stream = dashboard SSE (stats). */
export async function GET(req: Request, ctx: { params: Promise<{ eventId: string; kind: string }> }) {
  const { eventId, kind } = await ctx.params;
  if (!(await authorise(eventId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (kind === "stream") return sseResponse(req, () => getStats(eventId));
  if (kind === "blast") {
    const camps = await db.select().from(s.blastCampaigns).where(eq(s.blastCampaigns.eventId, eventId)).orderBy(desc(s.blastCampaigns.createdAt)).limit(10);
    const out = [];
    for (const c of camps) {
      const r = (await db.execute(sql`select status, count(*)::int as n from blast_messages where campaign_id = ${c.id} group by status`)) as unknown as { rows: { status: string; n: number }[] };
      out.push({ id: c.id, name: c.name, status: c.status, counts: Object.fromEntries(r.rows.map((x) => [x.status, x.n])) });
    }
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

/** POST /api/events/:id/tick = process due blast messages in-process (demo / no separate worker). */
export async function POST(_req: Request, ctx: { params: Promise<{ eventId: string; kind: string }> }) {
  const { eventId, kind } = await ctx.params;
  if (kind !== "tick") return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    await requireEventAccess(eventId, "EDITOR");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const [any] = await db.select({ id: s.blastCampaigns.id }).from(s.blastCampaigns).where(and(eq(s.blastCampaigns.eventId, eventId), eq(s.blastCampaigns.status, "RUNNING"))).limit(1);
  if (!any) return NextResponse.json({ sent: 0, failed: 0, retried: 0 });
  return NextResponse.json(await processDue(new Date(), eventId));
}
