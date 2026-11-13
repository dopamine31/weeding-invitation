import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { hasStaffAccess, staffToken } from "@/server/staff";
import { hashPin, safeEqual } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { signQr, verifyQr } from "@/lib/qr";
import { pickWinner, validateDeviceTime } from "@/lib/checkin-logic";
import { z } from "zod";

export const dynamic = "force-dynamic";

const scanSchema = z.object({
  clientEventId: z.string().min(6).max(80), qr: z.string().max(200).optional(), guestId: z.string().uuid().optional(), subEventId: z.string().uuid().optional(),
  walkInName: z.string().max(80).optional(), scannedAt: z.number(), gate: z.string().max(30).default("Gate 1"), source: z.enum(["ONLINE", "OFFLINE_SYNC", "MANUAL"]).default("ONLINE"),
});
const syncSchema = z.object({ scans: z.array(scanSchema).max(500) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ eventId: string; op: string }> }) {
  const { eventId, op } = await ctx.params;
  const uuid = z.string().uuid().safeParse(eventId);
  if (!uuid.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  if (op === "login") {
    const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`pin:${ip}:${eventId}`, 8, 10 * 60_000).ok) return NextResponse.json({ error: "Terlalu banyak percobaan." }, { status: 429 });
    const body = (await req.json().catch(() => ({}))) as { pin?: string };
    const [ev] = await db.select({ h: s.events.staffPinHash }).from(s.events).where(eq(s.events.id, eventId)).limit(1);
    if (!ev || !ev.h || !body.pin || !safeEqual(hashPin(String(body.pin)), ev.h)) return NextResponse.json({ error: "PIN salah." }, { status: 401 });
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 16;
    const res = NextResponse.json({ ok: true });
    res.cookies.set(`staff_${eventId}`, staffToken(eventId, exp), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 16, secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true" });
    return res;
  }

  if (!(await hasStaffAccess(eventId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (op !== "sync") return NextResponse.json({ error: "not_found" }, { status: 404 });

  const parsed = syncSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const now = new Date();
  const subs = await db.select({ id: s.subEvents.id }).from(s.subEvents).where(eq(s.subEvents.eventId, eventId));
  const subIds = new Set(subs.map((x) => x.id));
  const results = [];
  for (const sc of parsed.data.scans) {
    const at = validateDeviceTime(sc.scannedAt, now);
    let guestId = sc.guestId ?? null;
    let subEventId = sc.subEventId ?? null;
    if (sc.qr) {
      const v = verifyQr(sc.qr);
      if (!v) { results.push({ clientEventId: sc.clientEventId, status: "INVALID", reason: "QR tidak valid" }); continue; }
      guestId = v.guestId;
      subEventId = v.subEventId;
    }
    if (!sc.walkInName && (!guestId || !subEventId)) { results.push({ clientEventId: sc.clientEventId, status: "INVALID", reason: "Data tidak lengkap" }); continue; }
    if (subEventId && !subIds.has(subEventId)) { results.push({ clientEventId: sc.clientEventId, status: "INVALID", reason: "Bukan acara ini" }); continue; }
    if (sc.walkInName) {
      const [row] = await db.insert(s.checkIns).values({ eventId, guestId: null, subEventId: subEventId ?? subs[0]?.id ?? null, walkInName: sc.walkInName.trim(), scannedAt: at, gate: sc.gate, clientEventId: sc.clientEventId, source: "MANUAL", pax: 1 }).onConflictDoNothing({ target: s.checkIns.clientEventId }).returning();
      results.push({ clientEventId: sc.clientEventId, status: "OK", name: sc.walkInName.trim(), walkIn: true, at: (row?.scannedAt ?? at).toISOString() });
      continue;
    }
    const [g] = await db.select().from(s.guests).where(and(eq(s.guests.id, guestId as string), eq(s.guests.eventId, eventId))).limit(1);
    if (!g) { results.push({ clientEventId: sc.clientEventId, status: "INVALID", reason: "Tamu tidak ditemukan" }); continue; }
    const [rsvp] = await db.select().from(s.rsvps).where(and(eq(s.rsvps.guestId, g.id), eq(s.rsvps.subEventId, subEventId as string))).limit(1);
    await db.insert(s.checkIns).values({ eventId, guestId: g.id, subEventId, scannedAt: at, gate: sc.gate, clientEventId: sc.clientEventId, source: sc.source, pax: rsvp?.pax || 1 }).onConflictDoNothing({ target: s.checkIns.clientEventId });
    const all = await db.select().from(s.checkIns).where(and(eq(s.checkIns.guestId, g.id), eq(s.checkIns.subEventId, subEventId as string)));
    const winner = pickWinner(all.map((x) => ({ ...x })));
    const [seat] = await db.select({ name: s.tables.name }).from(s.seatAssignments).innerJoin(s.tables, eq(s.tables.id, s.seatAssignments.tableId)).where(eq(s.seatAssignments.guestId, g.id)).limit(1);
    const dup = winner && winner.clientEventId !== sc.clientEventId;
    results.push({
      clientEventId: sc.clientEventId, status: dup ? "DUPLICATE" : "OK", name: g.name, table: seat?.name ?? null, pax: rsvp?.pax || 1, vip: g.category === "VIP",
      notes: g.notes, allergy: rsvp?.allergy ?? "", first: dup && winner ? { at: winner.scannedAt.toISOString(), gate: winner.gate } : undefined,
    });
  }
  return NextResponse.json({ results });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ eventId: string; op: string }> }) {
  const { eventId, op } = await ctx.params;
  if (op !== "manifest") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!z.string().uuid().safeParse(eventId).success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!(await hasStaffAccess(eventId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const [ev] = await db.select().from(s.events).where(eq(s.events.id, eventId)).limit(1);
  if (!ev) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [subs, guests, rsvps, seats, checks] = await Promise.all([
    db.select().from(s.subEvents).where(eq(s.subEvents.eventId, eventId)),
    db.select().from(s.guests).where(eq(s.guests.eventId, eventId)),
    db.select().from(s.rsvps).where(eq(s.rsvps.eventId, eventId)),
    db.select({ guestId: s.seatAssignments.guestId, name: s.tables.name }).from(s.seatAssignments).innerJoin(s.tables, eq(s.tables.id, s.seatAssignments.tableId)).where(eq(s.seatAssignments.eventId, eventId)),
    db.select().from(s.checkIns).where(and(eq(s.checkIns.eventId, eventId), inArray(s.checkIns.source, ["ONLINE", "OFFLINE_SYNC", "MANUAL"]))),
  ]);
  const seatBy = new Map(seats.map((x) => [x.guestId, x.name]));
  const manifest = {
    eventId, title: ev.title, generatedAt: new Date().toISOString(),
    subEvents: subs.map((x) => ({ id: x.id, name: x.name })),
    guests: guests.map((g) => ({
      id: g.id, name: g.name, vip: g.category === "VIP", notes: g.notes, table: seatBy.get(g.id) ?? null,
      qr: Object.fromEntries(subs.map((x) => [x.id, signQr(g.id, x.id)])),
      rsvp: Object.fromEntries(rsvps.filter((r) => r.guestId === g.id).map((r) => [r.subEventId, { status: r.status, pax: r.pax, allergy: r.allergy }])),
    })),
    checkedIn: checks.filter((c) => c.guestId).map((c) => ({ guestId: c.guestId, subEventId: c.subEventId, at: c.scannedAt.toISOString(), gate: c.gate })),
  };
  return NextResponse.json(manifest, { headers: { "Cache-Control": "no-store" } });
}
