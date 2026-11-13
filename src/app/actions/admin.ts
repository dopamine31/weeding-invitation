"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireAdmin, setSession } from "@/server/auth";

async function audit(actorId: string, action: string, target: string, meta: Record<string, unknown> = {}) {
  await db.insert(s.auditLogs).values({ actorId, action, target, meta });
}

export async function toggleSuspend(wsId: string): Promise<void> {
  const a = await requireAdmin();
  const [w] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, wsId)).limit(1);
  if (!w) return;
  await db.update(s.workspaces).set({ suspended: !w.suspended }).where(eq(s.workspaces.id, wsId));
  await audit(a.user.id, w.suspended ? "tenant.activate" : "tenant.suspend", wsId);
  revalidatePath("/admin");
}

export async function changePlan(wsId: string, fd: FormData): Promise<void> {
  const a = await requireAdmin();
  const planId = String(fd.get("plan"));
  const [p] = await db.select().from(s.plans).where(eq(s.plans.id, planId)).limit(1);
  if (!p) return;
  await db.update(s.workspaces).set({ planId }).where(eq(s.workspaces.id, wsId));
  if (p.priceIdr > 0) await db.insert(s.subscriptions).values({ workspaceId: wsId, planId, amountIdr: p.priceIdr, interval: "MONTH" });
  await audit(a.user.id, "tenant.plan", wsId, { planId });
  revalidatePath("/admin");
}

export async function impersonate(wsId: string): Promise<void> {
  const a = await requireAdmin();
  await audit(a.user.id, "impersonate.start", wsId);
  await setSession({ uid: a.user.id, ws: wsId, imp: a.user.id });
  redirect("/dashboard");
}

export async function softDeleteTenant(wsId: string): Promise<void> {
  const a = await requireAdmin();
  await db.update(s.workspaces).set({ deletedAt: new Date(), suspended: true }).where(eq(s.workspaces.id, wsId));
  await audit(a.user.id, "tenant.delete", wsId);
  revalidatePath("/admin");
}
