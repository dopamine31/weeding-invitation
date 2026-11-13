"use server";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { TZ_IANA } from "@/lib/tz";
import { saveMedia } from "@/server/media";
import type { ActionResult } from "@/server/auth";

const dayKey = (d: Date, zone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

const fail = (error: string): ActionResult<{ already: boolean }> => ({ ok: false, error });

export async function selfieCheckin(slug: string, token: string, fd: FormData): Promise<ActionResult<{ already: boolean }>> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "local").split(",")[0]?.trim() ?? "local";
  const rl = rateLimit(`selfie:${ip}`, 10, 10 * 60_000);
  if (!rl.ok) return fail(`Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfterSec} detik.`);
  if (fd.get("consent") !== "yes") return fail("Centang izin foto terlebih dulu.");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Ambil foto selfie terlebih dulu.");

  const [ev] = await db.select().from(s.events).where(eq(s.events.slug, slug)).limit(1);
  if (!ev || ev.status !== "PUBLISHED") return fail("Undangan tidak tersedia.");
  if (ev.expiresAt && ev.expiresAt.getTime() < Date.now()) return fail("Undangan tidak tersedia.");
  const [guest] = await db.select().from(s.guests).where(and(eq(s.guests.token, token), eq(s.guests.eventId, ev.id))).limit(1);
  if (!guest) return fail("Link tamu tidak valid.");

  const zone = (TZ_IANA as Record<string, string>)[ev.timezone] ?? "Asia/Jakarta";
  const subs = await db.select().from(s.subEvents).where(eq(s.subEvents.eventId, ev.id));
  const today = dayKey(new Date(), zone);
  const now = Date.now();
  const todays = subs.filter((x) => dayKey(x.startsAt, zone) === today).sort((a, b) => Math.abs(a.startsAt.getTime() - now) - Math.abs(b.startsAt.getTime() - now));
  const sub = todays[0];
  if (!sub) return fail("Check-in selfie hanya dibuka pada hari acara.");

  const clientEventId = `selfie:${guest.id}:${sub.id}`;
  const [dup] = await db.select({ id: s.checkIns.id }).from(s.checkIns).where(eq(s.checkIns.clientEventId, clientEventId)).limit(1);
  if (dup) return { ok: true, data: { already: true } };

  const r = await saveMedia({ eventId: ev.id, guestId: guest.id, kind: "SELFIE", file });
  if (!r.ok) return fail(r.error);
  await db.insert(s.consentLogs).values({ eventId: ev.id, guestId: guest.id, purpose: "selfie_photo" });
  await db.insert(s.checkIns).values({ eventId: ev.id, guestId: guest.id, subEventId: sub.id, clientEventId, source: "SELFIE", pax: 1 }).onConflictDoNothing();
  return { ok: true, data: { already: false } };
}
