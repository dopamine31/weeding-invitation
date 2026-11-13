import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { events, memberships, users, workspaces } from "@/db/schema";
import { appSecret, hmacB64, safeEqual } from "@/lib/crypto";
import { canAccessWorkspace, type Role } from "@/lib/tenant";

const COOKIE = "wos_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export interface SessionPayload {
  uid: string;
  ws: string | null;
  imp?: string;
  exp: number;
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export class AccessError extends Error {}

function sign(p: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${hmacB64(body, appSecret())}`;
}

function verify(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, hmacB64(body, appSecret()))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    return p.exp > Date.now() / 1000 ? p : null;
  } catch {
    return null;
  }
}

export async function setSession(p: Omit<SessionPayload, "exp">): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, sign({ ...p, exp: Math.floor(Date.now() / 1000) + MAX_AGE }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export interface Auth {
  user: { id: string; email: string; name: string; role: string };
  memberships: { workspaceId: string; role: string }[];
  workspaceId: string | null;
  impersonatedBy?: string;
}

export const getAuth = cache(async (): Promise<Auth | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = verify(token);
  if (!s) return null;
  const [u] = await db.select().from(users).where(eq(users.id, s.uid)).limit(1);
  if (!u) return null;
  const ms = await db.select({ workspaceId: memberships.workspaceId, role: memberships.role }).from(memberships).where(eq(memberships.userId, u.id));
  let workspaceId = s.ws;
  if (workspaceId && u.role !== "SUPER_ADMIN" && !ms.some((m) => m.workspaceId === workspaceId)) workspaceId = null;
  if (!workspaceId) workspaceId = ms[0]?.workspaceId ?? null;
  return { user: { id: u.id, email: u.email, name: u.name, role: u.role }, memberships: ms, workspaceId, impersonatedBy: s.imp };
});

export async function requireAuth(): Promise<Auth> {
  const a = await getAuth();
  if (!a) redirect("/login");
  return a;
}

export async function requireAdmin(): Promise<Auth> {
  const a = await requireAuth();
  if (a.user.role !== "SUPER_ADMIN") redirect("/dashboard");
  return a;
}

/**
 * Central tenant guard. Every tenant-data read/write must pass through this:
 * it loads the event, then verifies the caller's membership of the owning workspace.
 */
export async function requireEventAccess(eventId: string, min: Role = "VIEWER") {
  const a = await getAuth();
  if (!a) throw new AccessError("Sesi berakhir, silakan masuk kembali.");
  const [ev] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!ev || !canAccessWorkspace({ role: a.user.role, memberships: a.memberships }, ev.workspaceId, min)) {
    throw new AccessError("Anda tidak memiliki akses ke undangan ini.");
  }
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, ev.workspaceId)).limit(1);
  if (ws?.suspended && a.user.role !== "SUPER_ADMIN") throw new AccessError("Akun ditangguhkan. Hubungi dukungan.");
  return { auth: a, event: ev, workspace: ws };
}

/** Wrap a server-action body: converts AccessError and unexpected errors into ActionResult. */
export async function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AccessError) return { ok: false, error: e.message };
    console.error("action failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "Terjadi kesalahan. Coba lagi." };
  }
}

/** For dashboard pages: the active event of the signed-in workspace. */
export async function currentEventPage(min: Role = "VIEWER") {
  const auth = await requireAuth();
  if (!auth.workspaceId) redirect("/onboarding");
  const [ev] = await db
    .select()
    .from(events)
    .where(and(eq(events.workspaceId, auth.workspaceId)))
    .orderBy(asc(events.createdAt))
    .limit(1);
  if (!ev) redirect("/onboarding");
  const { workspace } = await requireEventAccess(ev.id, min).catch(() => redirect("/login?error=denied"));
  if (workspace?.suspended && auth.user.role !== "SUPER_ADMIN") redirect("/login?error=suspended");
  return { auth, event: ev, workspace };
}

export async function workspaceExists(id: string): Promise<boolean> {
  const [w] = await db.select({ id: workspaces.id }).from(workspaces).where(and(eq(workspaces.id, id), isNull(workspaces.deletedAt))).limit(1);
  return !!w;
}
