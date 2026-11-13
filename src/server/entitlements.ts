import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { getTemplate } from "@/templates";
import { AccessError } from "./auth";

export async function planOf(workspaceId: string) {
  const [w] = await db.select({ planId: s.workspaces.planId }).from(s.workspaces).where(eq(s.workspaces.id, workspaceId)).limit(1);
  const [p] = await db.select().from(s.plans).where(eq(s.plans.id, w?.planId ?? "free")).limit(1);
  if (!p) throw new AccessError("Paket tidak ditemukan.");
  return p;
}

export type Entitlement = "guests" | "blast" | "tv" | "premiumTemplate";

/** Server-side feature enforcement. Throws AccessError with an upgrade message. */
export async function assertEntitlement(workspaceId: string, eventId: string, what: Entitlement, opts: { adding?: number; template?: string } = {}): Promise<void> {
  const plan = await planOf(workspaceId);
  if (what === "guests") {
    const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(s.guests).where(eq(s.guests.eventId, eventId));
    if ((c?.n ?? 0) + (opts.adding ?? 1) > plan.guestLimit) throw new AccessError(`Batas ${plan.guestLimit} tamu untuk paket ${plan.name} tercapai. Upgrade paket di menu Billing.`);
  }
  if (what === "blast") {
    if (plan.blastLimit <= 0) throw new AccessError(`Blast WhatsApp tidak tersedia di paket ${plan.name}. Upgrade di menu Billing.`);
    const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(s.blastMessages).where(eq(s.blastMessages.eventId, eventId));
    if ((c?.n ?? 0) + (opts.adding ?? 1) > plan.blastLimit) throw new AccessError(`Kuota blast ${plan.blastLimit} pesan terlampaui.`);
  }
  if (what === "tv" && !plan.tvMode) throw new AccessError(`TV Mode hanya tersedia di paket Premium ke atas.`);
  if (what === "premiumTemplate" && opts.template && getTemplate(opts.template).tier === "premium" && !plan.premiumTemplates) throw new AccessError("Template ini khusus paket Premium.");
}
