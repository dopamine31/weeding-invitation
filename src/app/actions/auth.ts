"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { clearSession, getAuth, setSession } from "@/server/auth";
import { ensureDemo, DEMO_EMAIL, ADMIN_EMAIL } from "@/server/seed";

export type FormState = { error?: string } | undefined;

async function ip() {
  return ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0]?.trim() ?? "local";
}

async function startSessionFor(userId: string, role: string): Promise<string> {
  const [m] = await db.select({ ws: s.memberships.workspaceId }).from(s.memberships).where(eq(s.memberships.userId, userId)).limit(1);
  await setSession({ uid: userId, ws: m?.ws ?? null });
  return role === "SUPER_ADMIN" ? "/admin" : m ? "/dashboard" : "/onboarding";
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const rl = rateLimit(`login:${await ip()}:${email}`, 8, 10 * 60_000);
  if (!rl.ok) return { error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(rl.retryAfterSec / 60)} menit.` };
  const [u] = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
  if (u?.lockedUntil && u.lockedUntil.getTime() > Date.now()) return { error: "Akun dikunci sementara karena terlalu banyak percobaan gagal. Coba lagi nanti." };
  if (!u || !verifyPassword(password, u.passwordHash)) {
    if (u) {
      const fails = u.failedLogins + 1;
      await db.update(s.users).set({ failedLogins: fails >= 5 ? 0 : fails, lockedUntil: fails >= 5 ? new Date(Date.now() + 15 * 60_000) : null }).where(eq(s.users.id, u.id));
    }
    return { error: "Email atau kata sandi salah." };
  }
  await db.update(s.users).set({ failedLogins: 0, lockedUntil: null }).where(eq(s.users.id, u.id));
  redirect(await startSessionFor(u.id, u.role));
}

const registerSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(100) });

export async function registerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const p = registerSchema.safeParse({ name: fd.get("name"), email: fd.get("email"), password: fd.get("password") });
  if (!p.success) return { error: "Periksa kembali isian: nama, email valid, dan kata sandi minimal 8 karakter." };
  const rl = rateLimit(`register:${await ip()}`, 5, 60 * 60_000);
  if (!rl.ok) return { error: "Terlalu banyak pendaftaran dari jaringan ini." };
  const [exists] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, p.data.email)).limit(1);
  if (exists) return { error: "Email sudah terdaftar." };
  await db.insert(s.plans).values([{ id: "free", name: "Free", priceIdr: 0, guestLimit: 50, blastLimit: 0, tvMode: false, premiumTemplates: false }]).onConflictDoNothing();
  const [u] = await db.insert(s.users).values({ email: p.data.email, name: p.data.name, passwordHash: hashPassword(p.data.password) }).returning();
  if (!u) return { error: "Gagal mendaftar." };
  const [w] = await db.insert(s.workspaces).values({ name: `${p.data.name}'s Wedding`, ownerId: u.id, planId: "free" }).returning();
  if (w) await db.insert(s.memberships).values({ workspaceId: w.id, userId: u.id, role: "OWNER" });
  await setSession({ uid: u.id, ws: w?.id ?? null });
  redirect("/onboarding");
}

export async function demoLoginAction(who: "demo" | "admin"): Promise<void> {
  if (process.env.DEMO_MODE === "false") redirect("/login");
  await ensureDemo();
  const [u] = await db.select().from(s.users).where(eq(s.users.email, who === "admin" ? ADMIN_EMAIL : DEMO_EMAIL)).limit(1);
  if (!u) redirect("/login");
  redirect(await startSessionFor(u.id, u.role));
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/");
}

export async function stopImpersonation(): Promise<void> {
  const a = await getAuth();
  if (a?.impersonatedBy) {
    await db.insert(s.auditLogs).values({ actorId: a.impersonatedBy, action: "impersonate.stop", target: a.workspaceId ?? "" });
    await setSession({ uid: a.impersonatedBy, ws: null });
  }
  redirect("/admin");
}
