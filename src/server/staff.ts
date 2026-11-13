import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { getAuth } from "@/server/auth";
import { canAccessWorkspace } from "@/lib/tenant";
import { hmacB64, safeEqual } from "@/lib/crypto";

export function staffToken(eventId: string, exp: number): string {
  return `${exp}.${hmacB64(`staff:${eventId}:${exp}`)}`;
}

/** Gate staff (PIN cookie) or a dashboard user with EDITOR access to the event. */
export async function hasStaffAccess(eventId: string): Promise<boolean> {
  const tok = (await cookies()).get(`staff_${eventId}`)?.value;
  if (tok) {
    const [exp] = tok.split(".");
    if (Number(exp) > Date.now() / 1000 && safeEqual(tok, staffToken(eventId, Number(exp)))) return true;
  }
  const a = await getAuth();
  if (!a) return false;
  const [ev] = await db.select({ ws: s.events.workspaceId }).from(s.events).where(eq(s.events.id, eventId)).limit(1);
  return !!ev && canAccessWorkspace({ role: a.user.role, memberships: a.memberships }, ev.ws, "EDITOR");
}
