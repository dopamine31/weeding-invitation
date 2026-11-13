"use server";

import { headers, cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { hashPin, randomToken } from "@/lib/crypto";
import { moderateWithFallback, sanitizeText } from "@/lib/moderation";
import { normName } from "@/lib/import";
import { rateLimit } from "@/lib/rate-limit";
import { signQr } from "@/lib/qr";
import type { ActionResult } from "@/server/auth";

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "local").split(",")[0]?.trim() ?? "local";
}

async function openEvent(slug: string) {
  const [ev] = await db.select().from(s.events).where(eq(s.events.slug, slug)).limit(1);
  if (!ev || ev.status !== "PUBLISHED") return null;
  if (ev.expiresAt && ev.expiresAt.getTime() < Date.now()) return null;
  return ev;
}

const rsvpSchema = z.object({
  slug: z.string().min(1).max(80),
  token: z.string().max(80).nullable(),
  name: z.string().max(80),
  subEventId: z.string().uuid(),
  status: z.enum(["attending", "declined", "maybe"]),
  pax: z.number().int().min(0).max(20),
  menuId: z.string().uuid().nullable(),
  allergy: z.string().max(160),
  hp: z.string().max(200),
  elapsed: z.number(),
});

const SEVERE = /(kacang|seafood|udang|kerang|anafilaks|peanut|nut|shellfish|shrimp)/i;

export async function submitRsvp(input: z.infer<typeof rsvpSchema>): Promise<ActionResult<{ token: string; qr?: string }>> {
  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid.", fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  const rl = rateLimit(`rsvp:${await clientIp()}`, 20, 10 * 60_000);
  if (!rl.ok) return { ok: false, error: `Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfterSec} detik.` };
  if (d.hp) return { ok: true, data: { token: d.token ?? "" } }; // honeypot: silently accept
  if (d.elapsed < 1500) return { ok: false, error: "Mohon isi formulir dengan teliti, lalu kirim kembali." };
  const ev = await openEvent(d.slug);
  if (!ev) return { ok: false, error: "Undangan tidak tersedia." };
  const [sub] = await db.select().from(s.subEvents).where(and(eq(s.subEvents.id, d.subEventId), eq(s.subEvents.eventId, ev.id))).limit(1);
  if (!sub) return { ok: false, error: "Acara tidak ditemukan." };

  let guest: typeof s.guests.$inferSelect | undefined;
  if (d.token) [guest] = await db.select().from(s.guests).where(and(eq(s.guests.token, d.token), eq(s.guests.eventId, ev.id))).limit(1);
  if (!guest) {
    const name = sanitizeText(d.name, 80);
    if (name.length < 2) return { ok: false, error: "Nama wajib diisi." };
    [guest] = await db.insert(s.guests).values({ eventId: ev.id, name, normName: normName(name), token: randomToken(18), maxPax: 5, consent: true }).returning();
    if (guest) await db.insert(s.consentLogs).values({ eventId: ev.id, guestId: guest.id, purpose: "rsvp" });
  }
  if (!guest) return { ok: false, error: "Gagal menyimpan." };
  const attending = d.status === "attending";
  const pax = attending ? Math.max(1, Math.min(d.pax, guest.maxPax)) : 0;
  const allergy = attending ? sanitizeText(d.allergy, 160) : "";
  const severity = allergy ? (SEVERE.test(allergy) ? "SEVERE" : "MILD") : "NONE";
  let menuId: string | null = null;
  if (attending && d.menuId) {
    const [m] = await db.select({ id: s.menuOptions.id }).from(s.menuOptions).where(and(eq(s.menuOptions.id, d.menuId), eq(s.menuOptions.eventId, ev.id))).limit(1);
    menuId = m?.id ?? null;
  }
  await db
    .insert(s.rsvps)
    .values({ eventId: ev.id, guestId: guest.id, subEventId: sub.id, status: d.status, pax, menuId, allergy, severity })
    .onConflictDoUpdate({ target: [s.rsvps.guestId, s.rsvps.subEventId], set: { status: d.status, pax, menuId, allergy, severity, updatedAt: new Date() } });
  const qr = attending ? await QRCode.toDataURL(signQr(guest.id, sub.id), { margin: 1, width: 240 }) : undefined;
  return { ok: true, data: { token: guest.token, qr } };
}

const wishSchema = z.object({
  slug: z.string().min(1).max(80),
  token: z.string().max(80).nullable(),
  name: z.string().min(1).max(60),
  message: z.string().min(2).max(300),
  hp: z.string().max(200),
  elapsed: z.number(),
});

export async function submitWish(input: z.infer<typeof wishSchema>): Promise<ActionResult<{ status: string }>> {
  const parsed = wishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nama dan ucapan wajib diisi (maks. 300 karakter)." };
  const d = parsed.data;
  const rl = rateLimit(`wish:${await clientIp()}`, 6, 10 * 60_000);
  if (!rl.ok) return { ok: false, error: `Terlalu banyak ucapan. Coba lagi dalam ${rl.retryAfterSec} detik.` };
  if (d.hp) return { ok: true, data: { status: "PENDING" } };
  if (d.elapsed < 1500) return { ok: false, error: "Mohon periksa kembali ucapan Anda, lalu kirim." };
  const ev = await openEvent(d.slug);
  if (!ev) return { ok: false, error: "Undangan tidak tersedia." };
  let guestId: string | null = null;
  if (d.token) {
    const [g] = await db.select({ id: s.guests.id }).from(s.guests).where(and(eq(s.guests.token, d.token), eq(s.guests.eventId, ev.id))).limit(1);
    guestId = g?.id ?? null;
  }
  const message = sanitizeText(d.message, 300);
  const name = sanitizeText(d.name, 60);
  const res = await moderateWithFallback(`${message} ${name}`, ev.wishPolicy === "MANUAL" ? "MANUAL" : "AUTO");
  const [w] = await db.insert(s.wishes).values({ eventId: ev.id, guestId, name, message, status: res.decision, score: res.score, reasons: res.reasons }).returning();
  if (w) await db.insert(s.moderationLogs).values({ wishId: w.id, decision: res.decision, score: res.score, reasons: res.reasons });
  return { ok: true, data: { status: res.decision } };
}

export async function claimWishlist(input: { slug: string; itemId: string; name: string }): Promise<ActionResult> {
  const ev = await openEvent(input.slug);
  if (!ev) return { ok: false, error: "Undangan tidak tersedia." };
  const rl = rateLimit(`claim:${await clientIp()}`, 10, 10 * 60_000);
  if (!rl.ok) return { ok: false, error: "Terlalu banyak percobaan." };
  const name = sanitizeText(input.name || "Tamu", 60);
  const r = await db
    .update(s.wishlistItems)
    .set({ claimedBy: name })
    .where(and(eq(s.wishlistItems.id, input.itemId), eq(s.wishlistItems.eventId, ev.id), sql`${s.wishlistItems.claimedBy} is null`))
    .returning({ id: s.wishlistItems.id });
  return r.length ? { ok: true, data: undefined } : { ok: false, error: "Item sudah ditandai." };
}

export async function unlockInvitation(slug: string, formData: FormData): Promise<void> {
  const pw = String(formData.get("password") ?? "");
  const rl = rateLimit(`unlock:${await clientIp()}:${slug}`, 8, 10 * 60_000);
  if (!rl.ok) return;
  const [ev] = await db.select({ password: s.events.password }).from(s.events).where(eq(s.events.slug, slug)).limit(1);
  if (ev?.password && hashPin(pw) === ev.password) {
    (await cookies()).set(`inv_${slug}`, hashPin(`unlock:${slug}`), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 * 30 });
  }
}
