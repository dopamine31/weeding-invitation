import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";

export const BUCKET = "media";
export const MAX_BYTES = 5 * 1024 * 1024;
export const GALLERY_LIMIT = 30;
export type MediaKind = "GALLERY" | "SELFIE" | "PROOF";

function cfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Penyimpanan foto belum dikonfigurasi");
  return { url, key };
}
const auth = (key: string) => ({ apikey: key, Authorization: `Bearer ${key}` });

/** Deteksi tipe gambar dari byte awal file (bukan dari nama/tipe kiriman browser). */
export function sniffMime(b: Uint8Array): string | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 12 && String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!) === "RIFF" && String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!) === "WEBP") return "image/webp";
  return null;
}

async function putObject(path: string, bytes: Uint8Array, mime: string): Promise<void> {
  const { url, key } = cfg();
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { ...auth(key), "Content-Type": mime, "x-upsert": "false" },
    body: new Blob([new Uint8Array(bytes)], { type: mime }),
  });
  if (!res.ok) throw new Error(`Upload gagal (HTTP ${res.status})`);
}

export async function getObject(path: string): Promise<{ data: ArrayBuffer; mime: string } | null> {
  const { url, key } = cfg();
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, { headers: auth(key), cache: "no-store" });
  if (!res.ok) return null;
  return { data: await res.arrayBuffer(), mime: res.headers.get("content-type") ?? "application/octet-stream" };
}

async function removeObject(path: string): Promise<void> {
  const { url, key } = cfg();
  await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, { method: "DELETE", headers: auth(key) }).catch(() => undefined);
}

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveMedia(a: { eventId: string; guestId?: string | null; kind: MediaKind; file: File }): Promise<SaveResult> {
  if (!a.file || a.file.size === 0) return { ok: false, error: "File kosong." };
  if (a.file.size > MAX_BYTES) return { ok: false, error: "Ukuran foto maksimal 5 MB." };
  const bytes = new Uint8Array(await a.file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) return { ok: false, error: "Format harus JPEG, PNG, atau WebP." };

  let sort = 0;
  if (a.kind === "GALLERY") {
    const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(s.media).where(and(eq(s.media.eventId, a.eventId), eq(s.media.kind, "GALLERY")));
    sort = c?.n ?? 0;
    if (sort >= GALLERY_LIMIT) return { ok: false, error: `Galeri maksimal ${GALLERY_LIMIT} foto.` };
  }

  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `${a.eventId}/${a.kind.toLowerCase()}/${randomUUID()}.${ext}`;
  try {
    await putObject(path, bytes, mime);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload gagal." };
  }
  const [row] = await db.insert(s.media).values({ eventId: a.eventId, guestId: a.guestId ?? null, kind: a.kind, path, mime, sizeBytes: a.file.size, sort }).returning();
  if (!row) {
    await removeObject(path);
    return { ok: false, error: "Gagal menyimpan data foto." };
  }
  return { ok: true, id: row.id };
}

export async function deleteMedia(eventId: string, id: string): Promise<boolean> {
  const [row] = await db.select().from(s.media).where(and(eq(s.media.id, id), eq(s.media.eventId, eventId))).limit(1);
  if (!row) return false;
  await removeObject(row.path);
  await db.delete(s.media).where(eq(s.media.id, row.id));
  return true;
}

export async function listGallery(eventId: string) {
  return db.select({ id: s.media.id, sort: s.media.sort }).from(s.media).where(and(eq(s.media.eventId, eventId), eq(s.media.kind, "GALLERY"))).orderBy(asc(s.media.sort), asc(s.media.createdAt));
}

/** Hapus semua file foto sebuah acara dari Storage (baris tabel dihapus terpisah). */
export async function purgeEventMedia(eventId: string): Promise<void> {
  const rows = await db.select({ path: s.media.path }).from(s.media).where(eq(s.media.eventId, eventId));
  for (const r of rows) {
    try { await removeObject(r.path); } catch { /* storage belum dikonfigurasi: lanjutkan */ }
  }
}
