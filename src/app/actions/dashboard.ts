"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { guard, requireAuth, requireEventAccess, setSession, type ActionResult, AccessError } from "@/server/auth";
import { assertEntitlement, planOf } from "@/server/entitlements";
import { enqueueCampaign, segmentGuests, type Segment } from "@/server/blast";
import { anonymizeEvent, deleteEventData } from "@/server/privacy";
import { createCheckout } from "@/server/payments";
import { hashPin, randomToken } from "@/lib/crypto";
import { normalizePhone } from "@/lib/phone";
import { detectDuplicates, failedRowsCsv, normName, validateRows, parseTable, type Mapping, type RowResult } from "@/lib/import";
import { validateTemplate } from "@/lib/spintax";
import { DEFAULT_SETTINGS, DEMO_SETTINGS, type BlastSettings } from "@/lib/throttle";
import { configSchema, migrateConfig } from "@/lib/invitation-config";
import { localToUtc, type Tz } from "@/lib/tz";
import { sanitizeText } from "@/lib/moderation";
import { TEMPLATES, getTemplate } from "@/templates";
import ExcelJS from "exceljs";

const ok = <T = undefined>(data?: T): ActionResult<T> => ({ ok: true, data: data as T });
const fail = (error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> => ({ ok: false, error, fieldErrors });

/* ===================== Onboarding & event settings ===================== */
const createSchema = z.object({
  groomName: z.string().trim().min(1).max(40), brideName: z.string().trim().min(1).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.enum(["WIB", "WITA", "WIT"]), venue: z.string().trim().max(120), address: z.string().trim().max(240),
  templateSlug: z.string(), slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/, "Slug 3-40 karakter: huruf kecil, angka, strip."),
});

export async function createEventAction(input: z.infer<typeof createSchema>): Promise<ActionResult<{ slug: string }>> {
  return guard(async () => {
    const a = await requireAuth();
    const p = createSchema.safeParse(input);
    if (!p.success) return fail("Periksa kembali isian Anda.", p.error.flatten().fieldErrors);
    const d = p.data;
    if (!TEMPLATES.some((t) => t.slug === d.templateSlug)) return fail("Template tidak valid.");
    let wsId = a.workspaceId;
    if (!wsId) {
      const [w] = await db.insert(s.workspaces).values({ name: `${d.groomName} & ${d.brideName}`, ownerId: a.user.id }).returning();
      if (!w) return fail("Gagal membuat workspace.");
      await db.insert(s.memberships).values({ workspaceId: w.id, userId: a.user.id, role: "OWNER" });
      wsId = w.id;
    }
    const plan = await planOf(wsId);
    if (getTemplate(d.templateSlug).tier === "premium" && !plan.premiumTemplates) return fail("Template ini khusus paket Premium. Pilih template Free atau upgrade.");
    const [taken] = await db.select({ id: s.events.id }).from(s.events).where(eq(s.events.slug, d.slug)).limit(1);
    if (taken) return fail("Slug sudah dipakai.", { slug: ["Slug sudah dipakai"] });
    const [ev] = await db.insert(s.events).values({
      workspaceId: wsId, slug: d.slug, title: `The Wedding of ${d.groomName} & ${d.brideName}`, status: "PUBLISHED", timezone: d.timezone, templateSlug: d.templateSlug,
      groomName: d.groomName, brideName: d.brideName, groomFull: d.groomName, brideFull: d.brideName, tvKey: randomToken(12),
      config: { texts: { greeting: "Dengan memohon rahmat dan ridho Tuhan Yang Maha Esa, kami mengundang Anda untuk hadir pada hari bahagia kami.", thanks: "Terima kasih atas doa dan kehadiran Anda." } },
    }).returning();
    if (!ev) return fail("Gagal membuat undangan.");
    await db.insert(s.subEvents).values({ eventId: ev.id, name: "Resepsi", startsAt: localToUtc(d.date, d.time, d.timezone), venue: d.venue, address: d.address });
    await setSession({ uid: a.user.id, ws: wsId });
    return ok({ slug: d.slug });
  });
}

const subSchema = z.object({
  id: z.string().uuid().optional(), name: z.string().trim().min(1).max(80), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")), venue: z.string().max(120), address: z.string().max(240),
  mapsUrl: z.string().url().max(400).or(z.literal("")), dressCode: z.string().max(120), streamingUrl: z.string().url().max(400).or(z.literal("")),
});
const settingsSchema = z.object({
  title: z.string().trim().min(2).max(120), groomName: z.string().trim().min(1).max(40), brideName: z.string().trim().min(1).max(40),
  groomFull: z.string().max(120), brideFull: z.string().max(120), groomParents: z.string().max(200), brideParents: z.string().max(200),
  timezone: z.enum(["WIB", "WITA", "WIT"]), language: z.enum(["id", "en"]), wishPolicy: z.enum(["AUTO", "MANUAL"]), noindex: z.boolean(),
  password: z.string().max(60).optional(), expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")), retentionDays: z.number().int().min(1).max(3650),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]), templateSlug: z.string(),
  subEvents: z.array(subSchema).max(10),
  pics: z.array(z.object({ name: z.string().trim().min(1).max(60), phone: z.string().max(30), role: z.string().max(60) })).max(5),
  gifts: z.array(z.object({ type: z.enum(["BANK", "EWALLET", "QRIS"]), provider: z.string().trim().min(1).max(40), accountNumber: z.string().trim().min(1).max(40), accountName: z.string().trim().min(1).max(80) })).max(8),
  menus: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(60) })).max(10),
  wishlist: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(80) })).max(20),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export async function saveEventSettings(eventId: string, input: SettingsInput): Promise<ActionResult> {
  return guard(async () => {
    const { event, auth, workspace } = await requireEventAccess(eventId, "EDITOR");
    const p = settingsSchema.safeParse(input);
    if (!p.success) return fail("Periksa kembali isian Anda.", p.error.flatten().fieldErrors);
    const d = p.data;
    if (!TEMPLATES.some((t) => t.slug === d.templateSlug)) return fail("Template tidak valid.");
    if (d.templateSlug !== event.templateSlug) await assertEntitlement(event.workspaceId, eventId, "premiumTemplate", { template: d.templateSlug });
    const pics: { name: string; phone: string; role: string }[] = [];
    for (const x of d.pics) {
      const phone = normalizePhone(x.phone);
      if (!phone) return fail(`Nomor PIC tidak valid: ${x.phone}`);
      pics.push({ ...x, phone });
    }
    const [slugOwner] = await db.select({ id: s.events.id }).from(s.events).where(and(eq(s.events.id, eventId))).limit(1);
    void slugOwner;
    const password = d.password === undefined ? undefined : d.password === "" ? null : hashPin(d.password);
    await db.update(s.events).set({
      title: d.title, groomName: d.groomName, brideName: d.brideName, groomFull: d.groomFull, brideFull: d.brideFull, groomParents: d.groomParents, brideParents: d.brideParents,
      timezone: d.timezone, language: d.language, wishPolicy: d.wishPolicy, noindex: d.noindex, retentionDays: d.retentionDays, status: d.status, templateSlug: d.templateSlug,
      expiresAt: d.expiresAt ? new Date(`${d.expiresAt}T23:59:59+07:00`) : null, ...(password !== undefined ? { password } : {}), updatedAt: new Date(),
    }).where(eq(s.events.id, eventId));
    // sub events: upsert + delete removed
    const keep: string[] = [];
    for (const [i, x] of d.subEvents.entries()) {
      const vals = { name: x.name, startsAt: localToUtc(x.date, x.time, d.timezone as Tz), endsAt: x.endTime ? localToUtc(x.date, x.endTime, d.timezone as Tz) : null, venue: x.venue, address: x.address, mapsUrl: x.mapsUrl, dressCode: x.dressCode, streamingUrl: x.streamingUrl, sort: i };
      if (x.id) {
        const r = await db.update(s.subEvents).set(vals).where(and(eq(s.subEvents.id, x.id), eq(s.subEvents.eventId, eventId))).returning({ id: s.subEvents.id });
        if (r[0]) keep.push(r[0].id);
      } else {
        const [n] = await db.insert(s.subEvents).values({ eventId, ...vals }).returning({ id: s.subEvents.id });
        if (n) keep.push(n.id);
      }
    }
    const removed = await db.select({ id: s.subEvents.id }).from(s.subEvents).where(and(eq(s.subEvents.eventId, eventId), keep.length ? notInArray(s.subEvents.id, keep) : undefined));
    if (removed.length) {
      const ids = removed.map((r) => r.id);
      await db.delete(s.rsvps).where(inArray(s.rsvps.subEventId, ids));
      await db.delete(s.subEvents).where(inArray(s.subEvents.id, ids));
    }
    await db.delete(s.pics).where(eq(s.pics.eventId, eventId));
    if (pics.length) await db.insert(s.pics).values(pics.map((x, i) => ({ eventId, ...x, sort: i })));
    await db.delete(s.giftAccounts).where(eq(s.giftAccounts.eventId, eventId));
    if (d.gifts.length) await db.insert(s.giftAccounts).values(d.gifts.map((g) => ({ eventId, ...g })));
    for (const [table, list] of [[s.menuOptions, d.menus], [s.wishlistItems, d.wishlist]] as const) {
      const keepIds: string[] = [];
      for (const m of list) {
        if (m.id) {
          const r = await db.update(table).set({ name: m.name }).where(and(eq(table.id, m.id), eq(table.eventId, eventId))).returning({ id: table.id });
          if (r[0]) keepIds.push(r[0].id);
        } else {
          const [n] = await db.insert(table).values({ eventId, name: m.name }).returning({ id: table.id });
          if (n) keepIds.push(n.id);
        }
      }
      await db.delete(table).where(and(eq(table.eventId, eventId), keepIds.length ? notInArray(table.id, keepIds) : undefined));
    }
    await db.insert(s.auditLogs).values({ actorId: auth.user.id, action: "event.update", target: eventId, meta: { workspace: workspace?.id } });
    revalidatePath("/dashboard", "layout");
    revalidatePath(`/i/${event.slug}`);
    return ok();
  });
}

export async function saveInvitationConfig(eventId: string, raw: unknown): Promise<ActionResult> {
  return guard(async () => {
    const { event } = await requireEventAccess(eventId, "EDITOR");
    const p = configSchema.safeParse(raw);
    if (!p.success) return fail("Dokumen tidak valid.", p.error.flatten().fieldErrors as Record<string, string[]>);
    await db.update(s.events).set({ config: migrateConfig(p.data), updatedAt: new Date() }).where(eq(s.events.id, eventId));
    revalidatePath(`/i/${event.slug}`);
    return ok();
  });
}

export async function setEventStatus(eventId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED"): Promise<ActionResult> {
  return guard(async () => {
    const { event } = await requireEventAccess(eventId, "EDITOR");
    await db.update(s.events).set({ status, updatedAt: new Date() }).where(eq(s.events.id, eventId));
    revalidatePath(`/i/${event.slug}`);
    revalidatePath("/dashboard", "layout");
    return ok();
  });
}

export async function resetStaffPin(eventId: string): Promise<ActionResult<{ pin: string }>> {
  return guard(async () => {
    await requireEventAccess(eventId, "OWNER");
    const pin = String(100000 + Math.floor(Math.random() * 900000));
    await db.update(s.events).set({ staffPinHash: hashPin(pin) }).where(eq(s.events.id, eventId));
    return ok({ pin });
  });
}

export async function anonymizeNow(eventId: string): Promise<ActionResult<{ count: number }>> {
  return guard(async () => {
    const { auth } = await requireEventAccess(eventId, "OWNER");
    const count = await anonymizeEvent(eventId);
    await db.insert(s.auditLogs).values({ actorId: auth.user.id, action: "event.anonymize", target: eventId, meta: { count } });
    return ok({ count });
  });
}

export async function deleteEventPermanently(eventId: string, confirmSlug: string): Promise<ActionResult> {
  return guard(async () => {
    const { event, auth } = await requireEventAccess(eventId, "OWNER");
    if (confirmSlug !== event.slug) return fail("Ketik slug undangan dengan benar untuk mengonfirmasi.");
    await deleteEventData(eventId);
    await db.insert(s.auditLogs).values({ actorId: auth.user.id, action: "event.delete", target: event.slug });
    return ok();
  });
}

/* ===================== Guests ===================== */
async function groupIdFor(eventId: string, name: string): Promise<string | null> {
  const n = name.trim();
  if (!n) return null;
  const [g] = await db.select().from(s.guestGroups).where(and(eq(s.guestGroups.eventId, eventId), eq(s.guestGroups.name, n))).limit(1);
  if (g) return g.id;
  const [c] = await db.insert(s.guestGroups).values({ eventId, name: n }).returning();
  return c?.id ?? null;
}

const guestSchema = z.object({
  name: z.string().trim().min(1).max(120), phone: z.string().max(30).optional().default(""), email: z.string().max(120).optional().default(""),
  group: z.string().max(60).optional().default(""), category: z.enum(["REGULAR", "VIP", "FAMILY"]).default("REGULAR"), maxPax: z.number().int().min(1).max(20).default(2), notes: z.string().max(300).optional().default(""),
});

export async function addGuest(eventId: string, input: z.input<typeof guestSchema>): Promise<ActionResult> {
  return guard(async () => {
    const { event } = await requireEventAccess(eventId, "EDITOR");
    const p = guestSchema.safeParse(input);
    if (!p.success) return fail("Periksa kembali isian.", p.error.flatten().fieldErrors);
    const phone = p.data.phone ? normalizePhone(p.data.phone) : null;
    if (p.data.phone && !phone) return fail("Nomor telepon tidak valid.", { phone: ["Tidak valid"] });
    await assertEntitlement(event.workspaceId, eventId, "guests");
    await db.insert(s.guests).values({ eventId, name: p.data.name, normName: normName(p.data.name), phone, email: p.data.email || null, groupId: await groupIdFor(eventId, p.data.group), category: p.data.category, maxPax: p.data.maxPax, notes: p.data.notes, token: randomToken(18) });
    revalidatePath("/dashboard/guests");
    return ok();
  });
}

export async function updateGuest(eventId: string, guestId: string, patch: { name?: string; phone?: string; maxPax?: number; category?: string; notes?: string }): Promise<ActionResult> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    const set: Partial<typeof s.guests.$inferInsert> = {};
    if (patch.name !== undefined) {
      const n = sanitizeText(patch.name, 120);
      if (!n) return fail("Nama wajib diisi.");
      set.name = n;
      set.normName = normName(n);
    }
    if (patch.phone !== undefined) {
      const ph = patch.phone ? normalizePhone(patch.phone) : null;
      if (patch.phone && !ph) return fail("Nomor telepon tidak valid.");
      set.phone = ph;
    }
    if (patch.maxPax !== undefined) set.maxPax = Math.max(1, Math.min(20, Math.floor(patch.maxPax)));
    if (patch.category && ["REGULAR", "VIP", "FAMILY"].includes(patch.category)) set.category = patch.category;
    if (patch.notes !== undefined) set.notes = sanitizeText(patch.notes, 300);
    await db.update(s.guests).set(set).where(and(eq(s.guests.id, guestId), eq(s.guests.eventId, eventId)));
    return ok();
  });
}

export async function deleteGuests(eventId: string, ids: string[]): Promise<ActionResult> {
  return guard(async () => {
    const { auth } = await requireEventAccess(eventId, "EDITOR");
    if (!ids.length) return ok();
    const mine = (await db.select({ id: s.guests.id }).from(s.guests).where(and(eq(s.guests.eventId, eventId), inArray(s.guests.id, ids)))).map((g) => g.id);
    if (!mine.length) return ok();
    await db.delete(s.rsvps).where(inArray(s.rsvps.guestId, mine));
    await db.delete(s.seatAssignments).where(inArray(s.seatAssignments.guestId, mine));
    await db.delete(s.linkOpens).where(inArray(s.linkOpens.guestId, mine));
    await db.delete(s.blastMessages).where(inArray(s.blastMessages.guestId, mine));
    await db.delete(s.guests).where(inArray(s.guests.id, mine));
    await db.insert(s.auditLogs).values({ actorId: auth.user.id, action: "guests.delete", target: eventId, meta: { count: mine.length } });
    revalidatePath("/dashboard/guests");
    return ok();
  });
}

export async function setGuestGroup(eventId: string, ids: string[], groupName: string): Promise<ActionResult> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    const gid = await groupIdFor(eventId, groupName);
    if (ids.length) await db.update(s.guests).set({ groupId: gid }).where(and(eq(s.guests.eventId, eventId), inArray(s.guests.id, ids)));
    revalidatePath("/dashboard/guests");
    return ok();
  });
}

/* ----- import ----- */
export async function parseSpreadsheet(eventId: string, fd: FormData): Promise<ActionResult<{ headers: string[]; rows: string[][] }>> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    const file = fd.get("file");
    if (!(file instanceof File)) return fail("File tidak ditemukan.");
    if (file.size > 8 * 1024 * 1024) return fail("Ukuran file maksimal 8 MB.");
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx")) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load((await file.arrayBuffer()) as ExcelJS.Buffer);
      const ws = wb.worksheets[0];
      if (!ws) return fail("Sheet kosong.");
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: false }, (row) => {
        const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
        rows.push(vals.map((v) => (v === null || v === undefined ? "" : typeof v === "object" ? String((v as { text?: string; result?: unknown }).text ?? (v as { result?: unknown }).result ?? "") : String(v)).trim()));
      });
      return ok({ headers: rows[0] ?? [], rows: rows.slice(1) });
    }
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      const t = parseTable(await file.text());
      return ok({ headers: t.headers, rows: t.rows });
    }
    return fail("Format harus .csv atau .xlsx");
  });
}

export async function previewImport(eventId: string, rows: string[][], mapping: Mapping): Promise<ActionResult<{ results: RowResult[] }>> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    if (rows.length > 5000) return fail("Maksimal 5.000 baris per impor.");
    const existing = await db.select({ id: s.guests.id, name: s.guests.name, phone: s.guests.phone }).from(s.guests).where(eq(s.guests.eventId, eventId));
    return ok({ results: detectDuplicates(validateRows(rows, mapping), existing) });
  });
}

export async function commitImport(eventId: string, rows: string[][], mapping: Mapping, strategy: "skip" | "update" | "create"): Promise<ActionResult<{ created: number; updated: number; skipped: number; failed: number; failedCsv: string }>> {
  return guard(async () => {
    const { event, auth } = await requireEventAccess(eventId, "EDITOR");
    if (rows.length > 5000) return fail("Maksimal 5.000 baris per impor.");
    const existing = await db.select({ id: s.guests.id, name: s.guests.name, phone: s.guests.phone }).from(s.guests).where(eq(s.guests.eventId, eventId));
    const results = detectDuplicates(validateRows(rows, mapping), existing); // never trust the client preview
    const good = results.filter((r) => !r.errors.length);
    const failed = results.length - good.length;
    const toCreate = good.filter((r) => !r.duplicate || strategy === "create");
    const toUpdate = strategy === "update" ? good.filter((r) => r.duplicate && r.duplicate.source === "existing") : [];
    await assertEntitlement(event.workspaceId, eventId, "guests", { adding: toCreate.length });
    const groupCache = new Map<string, string | null>();
    const gid = async (n: string) => { if (!groupCache.has(n)) groupCache.set(n, await groupIdFor(eventId, n)); return groupCache.get(n) ?? null; };
    let created = 0;
    for (let i = 0; i < toCreate.length; i += 500) {
      const chunk = toCreate.slice(i, i + 500);
      const vals = [];
      for (const r of chunk) vals.push({ eventId, name: r.data.name, normName: normName(r.data.name), phone: r.data.phone, email: r.data.email, groupId: await gid(r.data.group), category: r.data.category, maxPax: r.data.maxPax, notes: r.data.notes, token: randomToken(18) });
      const ins = await db.insert(s.guests).values(vals).returning({ id: s.guests.id });
      created += ins.length;
    }
    let updated = 0;
    for (const r of toUpdate) {
      const target = existing.find((e) => (r.duplicate?.reason === "phone" ? e.phone === r.data.phone : normName(e.name) === normName(r.duplicate?.of ?? "")));
      if (!target) continue;
      await db.update(s.guests).set({ name: r.data.name, normName: normName(r.data.name), phone: r.data.phone ?? target.phone, email: r.data.email, maxPax: r.data.maxPax, notes: r.data.notes, groupId: await gid(r.data.group) }).where(and(eq(s.guests.id, target.id), eq(s.guests.eventId, eventId)));
      updated++;
    }
    await db.insert(s.consentLogs).values({ eventId, purpose: `import:${created + updated}` });
    await db.insert(s.auditLogs).values({ actorId: auth.user.id, action: "guests.import", target: eventId, meta: { created, updated, failed } });
    revalidatePath("/dashboard/guests");
    return ok({ created, updated, skipped: good.length - toCreate.length - updated, failed, failedCsv: failedRowsCsv(results) });
  });
}

/* ===================== Wishes ===================== */
export async function moderateWishes(eventId: string, ids: string[], action: "approve" | "reject" | "pin" | "unpin" | "delete" | "reply", reply?: string): Promise<ActionResult> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    if (!ids.length) return ok();
    const where = and(eq(s.wishes.eventId, eventId), inArray(s.wishes.id, ids));
    if (action === "approve") await db.update(s.wishes).set({ status: "APPROVED" }).where(where);
    else if (action === "reject") await db.update(s.wishes).set({ status: "REJECTED", pinned: false }).where(where);
    else if (action === "pin") await db.update(s.wishes).set({ pinned: true, status: "APPROVED" }).where(where);
    else if (action === "unpin") await db.update(s.wishes).set({ pinned: false }).where(where);
    else if (action === "reply") await db.update(s.wishes).set({ reply: reply ? sanitizeText(reply, 300) : null }).where(where);
    else {
      await db.delete(s.moderationLogs).where(inArray(s.moderationLogs.wishId, ids));
      await db.delete(s.wishes).where(where);
    }
    revalidatePath("/dashboard/wishes");
    return ok();
  });
}

/* ===================== Seating ===================== */
export async function addTable(eventId: string, shape: "round" | "square" | "long" | "zone", name: string): Promise<ActionResult> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(s.tables).where(eq(s.tables.eventId, eventId));
    await db.insert(s.tables).values({ eventId, name: name.trim().slice(0, 30) || String((c?.n ?? 0) + 1), shape, capacity: shape === "long" ? 10 : shape === "zone" ? 0 : 8, x: 40, y: 40 });
    return ok();
  });
}

export async function saveTables(eventId: string, items: { id: string; x: number; y: number; rotation: number; capacity: number; name: string }[]): Promise<ActionResult> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    for (const t of items) {
      await db.update(s.tables).set({ x: Math.max(0, Math.min(100, t.x)), y: Math.max(0, Math.min(100, t.y)), rotation: t.rotation, capacity: Math.max(0, Math.min(50, Math.floor(t.capacity))), name: t.name.trim().slice(0, 30) || "-" }).where(and(eq(s.tables.id, t.id), eq(s.tables.eventId, eventId)));
    }
    return ok();
  });
}

export async function deleteTable(eventId: string, tableId: string): Promise<ActionResult> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    await db.delete(s.seatAssignments).where(and(eq(s.seatAssignments.eventId, eventId), eq(s.seatAssignments.tableId, tableId)));
    await db.delete(s.tables).where(and(eq(s.tables.id, tableId), eq(s.tables.eventId, eventId)));
    return ok();
  });
}

async function paxOf(eventId: string): Promise<Map<string, number>> {
  const rows = await db.select({ guestId: s.rsvps.guestId, pax: sql<number>`max(${s.rsvps.pax})::int` }).from(s.rsvps).where(and(eq(s.rsvps.eventId, eventId), eq(s.rsvps.status, "attending"))).groupBy(s.rsvps.guestId);
  return new Map(rows.map((r) => [r.guestId, Math.max(1, r.pax)]));
}

export async function assignSeat(eventId: string, guestId: string, tableId: string | null): Promise<ActionResult<{ warning?: string }>> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    const [g] = await db.select({ id: s.guests.id }).from(s.guests).where(and(eq(s.guests.id, guestId), eq(s.guests.eventId, eventId))).limit(1);
    if (!g) return fail("Tamu tidak ditemukan.");
    if (!tableId) {
      await db.delete(s.seatAssignments).where(eq(s.seatAssignments.guestId, guestId));
      return ok({});
    }
    const [t] = await db.select().from(s.tables).where(and(eq(s.tables.id, tableId), eq(s.tables.eventId, eventId))).limit(1);
    if (!t) return fail("Meja tidak ditemukan.");
    await db.insert(s.seatAssignments).values({ eventId, guestId, tableId }).onConflictDoUpdate({ target: s.seatAssignments.guestId, set: { tableId } });
    const pax = await paxOf(eventId);
    const seated = await db.select({ guestId: s.seatAssignments.guestId }).from(s.seatAssignments).where(eq(s.seatAssignments.tableId, tableId));
    const used = seated.reduce((a, r) => a + (pax.get(r.guestId) ?? 1), 0);
    return ok(used > t.capacity ? { warning: `Meja ${t.name} melebihi kapasitas (${used}/${t.capacity}).` } : {});
  });
}

export async function autoAssign(eventId: string): Promise<ActionResult<{ seated: number; unseated: number }>> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    const [tbls, seated, guests, pax] = await Promise.all([
      db.select().from(s.tables).where(and(eq(s.tables.eventId, eventId), sql`${s.tables.capacity} > 0`)).orderBy(asc(s.tables.name)),
      db.select().from(s.seatAssignments).where(eq(s.seatAssignments.eventId, eventId)),
      db.select().from(s.guests).where(eq(s.guests.eventId, eventId)),
      paxOf(eventId),
    ]);
    const load = new Map<string, number>(tbls.map((t) => [t.id, 0]));
    const done = new Set(seated.map((x) => x.guestId));
    for (const a of seated) load.set(a.tableId, (load.get(a.tableId) ?? 0) + (pax.get(a.guestId) ?? 1));
    // keep families/groups together: order by group, then name
    const todo = guests.filter((g) => pax.has(g.id) && !done.has(g.id)).sort((a, b) => (a.groupId ?? "").localeCompare(b.groupId ?? "") || a.name.localeCompare(b.name));
    let n = 0;
    let left = 0;
    for (const g of todo) {
      const need = pax.get(g.id) ?? 1;
      // prefer a table that already holds the same group, else first with room
      const sameGroup = tbls.find((t) => (load.get(t.id) ?? 0) + need <= t.capacity && seated.some((a) => a.tableId === t.id && guests.find((x) => x.id === a.guestId)?.groupId === g.groupId && g.groupId));
      const t = sameGroup ?? tbls.find((x) => (load.get(x.id) ?? 0) + need <= x.capacity);
      if (!t) { left++; continue; }
      await db.insert(s.seatAssignments).values({ eventId, guestId: g.id, tableId: t.id });
      seated.push({ id: "", eventId, guestId: g.id, tableId: t.id });
      load.set(t.id, (load.get(t.id) ?? 0) + need);
      n++;
    }
    return ok({ seated: n, unseated: left });
  });
}

/* ===================== Blast ===================== */
const campaignSchema = z.object({
  name: z.string().trim().min(1).max(80), template: z.string().min(5).max(1000),
  segment: z.object({ kind: z.enum(["all", "group", "notRsvp", "noOpen", "attending"]), groupId: z.string().uuid().optional() }),
  preset: z.enum(["safe", "demo"]),
  minDelaySec: z.number().min(1).max(600), maxDelaySec: z.number().min(1).max(900), dailyCap: z.number().int().min(1).max(1000),
  windowStart: z.number().int().min(0).max(23), windowEnd: z.number().int().min(1).max(24),
});

export async function createCampaign(eventId: string, input: z.infer<typeof campaignSchema>): Promise<ActionResult<{ queued: number }>> {
  return guard(async () => {
    const { event, auth } = await requireEventAccess(eventId, "EDITOR");
    const p = campaignSchema.safeParse(input);
    if (!p.success) return fail("Periksa kembali isian kampanye.", p.error.flatten().fieldErrors);
    const v = validateTemplate(p.data.template);
    if (!v.ok) return fail(v.unknown.length ? `Variabel tidak dikenal: ${v.unknown.join(", ")}` : "Template kosong.");
    const target = (await segmentGuests(eventId, p.data.segment as Segment)).filter((g) => g.phone && !g.optedOut);
    if (!target.length) return fail("Tidak ada tamu bernomor telepon pada segmen ini.");
    await assertEntitlement(event.workspaceId, eventId, "blast", { adding: target.length });
    const settings: BlastSettings = p.data.preset === "demo" ? DEMO_SETTINGS : { ...DEFAULT_SETTINGS, minDelaySec: p.data.minDelaySec, maxDelaySec: Math.max(p.data.minDelaySec, p.data.maxDelaySec), dailyCap: p.data.dailyCap, windowStart: p.data.windowStart, windowEnd: p.data.windowEnd };
    const [c] = await db.insert(s.blastCampaigns).values({ eventId, name: p.data.name, template: p.data.template, segment: p.data.segment, settings, status: "DRAFT" }).returning();
    if (!c) return fail("Gagal membuat kampanye.");
    const r = await enqueueCampaign(c.id);
    await db.insert(s.auditLogs).values({ actorId: auth.user.id, action: "blast.start", target: c.id, meta: { queued: r.queued } });
    revalidatePath("/dashboard/blast");
    return ok({ queued: r.queued });
  });
}

export async function controlCampaign(eventId: string, campaignId: string, action: "pause" | "resume" | "cancel" | "resendFailed"): Promise<ActionResult> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    const [c] = await db.select().from(s.blastCampaigns).where(and(eq(s.blastCampaigns.id, campaignId), eq(s.blastCampaigns.eventId, eventId))).limit(1);
    if (!c) return fail("Kampanye tidak ditemukan.");
    if (action === "pause") await db.update(s.blastCampaigns).set({ status: "PAUSED" }).where(eq(s.blastCampaigns.id, c.id));
    if (action === "resume") await db.update(s.blastCampaigns).set({ status: "RUNNING" }).where(eq(s.blastCampaigns.id, c.id));
    if (action === "cancel") {
      await db.update(s.blastMessages).set({ status: "SKIPPED", error: "Dibatalkan" }).where(and(eq(s.blastMessages.campaignId, c.id), eq(s.blastMessages.status, "QUEUED")));
      await db.update(s.blastCampaigns).set({ status: "CANCELED" }).where(eq(s.blastCampaigns.id, c.id));
    }
    if (action === "resendFailed") {
      await db.update(s.blastMessages).set({ status: "QUEUED", attempt: 0, error: null, sendAfter: new Date() }).where(and(eq(s.blastMessages.campaignId, c.id), eq(s.blastMessages.status, "FAILED")));
      await db.update(s.blastCampaigns).set({ status: "RUNNING" }).where(eq(s.blastCampaigns.id, c.id));
    }
    revalidatePath("/dashboard/blast");
    return ok();
  });
}

/* ===================== Billing ===================== */
export async function startCheckout(planId: string): Promise<void> {
  const a = await requireAuth();
  if (!a.workspaceId) redirect("/onboarding");
  const [plan] = await db.select().from(s.plans).where(eq(s.plans.id, planId)).limit(1);
  if (!plan || plan.priceIdr <= 0) redirect("/dashboard/billing");
  if (!a.memberships.some((m) => m.workspaceId === a.workspaceId && m.role === "OWNER") && a.user.role !== "SUPER_ADMIN") throw new AccessError("Hanya pemilik yang dapat membeli paket.");
  const [pay] = await db.insert(s.payments).values({ workspaceId: a.workspaceId, planId, amountIdr: plan.priceIdr, provider: process.env.MIDTRANS_SERVER_KEY ? "midtrans" : "mock" }).returning();
  if (!pay) redirect("/dashboard/billing");
  redirect(await createCheckout(pay.id, plan.priceIdr, plan.name, a.user.email));
}
