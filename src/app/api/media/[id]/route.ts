import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { AccessError, requireEventAccess } from "@/server/auth";
import { getObject } from "@/server/media";

export const dynamic = "force-dynamic";

const notFound = () => new NextResponse("Not found", { status: 404 });

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const [m] = await db.select().from(s.media).where(eq(s.media.id, id)).limit(1);
  if (!m) return notFound();
  if (m.kind !== "GALLERY") {
    try {
      await requireEventAccess(m.eventId, "VIEWER");
    } catch (e) {
      if (e instanceof AccessError) return notFound();
      throw e;
    }
  }
  const obj = await getObject(m.path);
  if (!obj) return notFound();
  return new NextResponse(obj.data, {
    headers: {
      "Content-Type": m.mime,
      "Cache-Control": m.kind === "GALLERY" ? "public, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
