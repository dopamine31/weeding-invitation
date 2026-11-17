"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { guard, requireEventAccess, type ActionResult } from "@/server/auth";
import { deleteMedia, listGallery, saveMedia } from "@/server/media";

export async function uploadGalleryPhoto(eventId: string, fd: FormData): Promise<ActionResult<undefined>> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    const file = fd.get("file");
    if (!(file instanceof File)) return { ok: false, error: "File tidak ditemukan." };
    const r = await saveMedia({ eventId, kind: "GALLERY", file });
    if (!r.ok) return { ok: false, error: r.error };
    revalidatePath("/dashboard/gallery");
    return { ok: true, data: undefined };
  });
}

export async function deleteGalleryPhoto(eventId: string, id: string): Promise<ActionResult<undefined>> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    await deleteMedia(eventId, id);
    revalidatePath("/dashboard/gallery");
    return { ok: true, data: undefined };
  });
}

export async function moveGalleryPhoto(eventId: string, id: string, dir: -1 | 1): Promise<ActionResult<undefined>> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    const ids = (await listGallery(eventId)).map((x) => x.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i >= 0 && j >= 0 && j < ids.length) {
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
      for (let k = 0; k < ids.length; k++) {
        await db.update(s.media).set({ sort: k }).where(and(eq(s.media.id, ids[k]!), eq(s.media.eventId, eventId)));
      }
    }
    revalidatePath("/dashboard/gallery");
    return { ok: true, data: undefined };
  });
}

export async function deleteSelfiePhoto(eventId: string, id: string): Promise<ActionResult<undefined>> {
  return guard(async () => {
    await requireEventAccess(eventId, "EDITOR");
    const [row] = await db
      .select({ id: s.media.id })
      .from(s.media)
      .where(and(eq(s.media.id, id), eq(s.media.eventId, eventId), eq(s.media.kind, "SELFIE")))
      .limit(1);
    if (!row) return { ok: false, error: "Foto tidak ditemukan." };
    await deleteMedia(eventId, id);
    revalidatePath("/dashboard/attendance");
    return { ok: true, data: undefined };
  });
}
