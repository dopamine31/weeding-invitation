"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireAdmin, requireAuth } from "@/server/auth";
import { rejectPayment, settlePayment } from "@/server/payments";
import { canAccessWorkspace } from "@/lib/tenant";

/** Pengantin: "Saya sudah transfer" (opsional, bisa juga langsung kirim bukti lewat WhatsApp). */
export async function confirmTransfer(paymentId: string, fd: FormData): Promise<void> {
  const a = await requireAuth();
  const [p] = await db.select().from(s.payments).where(eq(s.payments.id, paymentId)).limit(1);
  if (!p || !canAccessWorkspace({ role: a.user.role, memberships: a.memberships }, p.workspaceId, "OWNER")) return;
  if (p.status !== "PENDING" && p.status !== "VERIFYING") return;
  const senderName = String(fd.get("senderName") ?? "").trim().slice(0, 80);
  if (!senderName) return;
  const senderBank = String(fd.get("senderBank") ?? "").trim().slice(0, 40);
  const senderNote = String(fd.get("senderNote") ?? "").trim().slice(0, 300);
  await db.update(s.payments).set({ status: "VERIFYING", senderName, senderBank: senderBank || null, senderNote: senderNote || null, transferredAt: new Date() }).where(eq(s.payments.id, p.id));
  revalidatePath(`/pay/${paymentId}`);
}

/** Admin: setujui setelah saldo masuk dicek di rekening. */
export async function approvePayment(paymentId: string): Promise<void> {
  await requireAdmin();
  await settlePayment(paymentId, true);
  revalidatePath("/admin");
}

export async function rejectPaymentAction(paymentId: string, fd: FormData): Promise<void> {
  await requireAdmin();
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 200) || "Dana belum ditemukan di mutasi rekening";
  await rejectPayment(paymentId, reason);
  revalidatePath("/admin");
}
