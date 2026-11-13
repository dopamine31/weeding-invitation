import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { appUrl } from "./blast";

/** PaymentProvider adapter: Midtrans Snap when MIDTRANS_SERVER_KEY is set, otherwise the mock checkout page. */
export async function createCheckout(paymentId: string, amountIdr: number, planName: string, email: string): Promise<string> {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) return `/pay/${paymentId}`;
  const base = process.env.MIDTRANS_PRODUCTION === "true" ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
  const res = await fetch(`${base}/snap/v1/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
    body: JSON.stringify({
      transaction_details: { order_id: paymentId, gross_amount: amountIdr },
      item_details: [{ id: planName, price: amountIdr, quantity: 1, name: `WeddingOS ${planName}` }],
      customer_details: { email },
      callbacks: { finish: `${appUrl()}/dashboard/billing` },
    }),
  });
  const json = (await res.json()) as { redirect_url?: string; error_messages?: string[] };
  if (!res.ok || !json.redirect_url) throw new Error(json.error_messages?.join(", ") ?? `Midtrans HTTP ${res.status}`);
  return json.redirect_url;
}

export function verifyMidtransSignature(orderId: string, statusCode: string, gross: string, signature: string): boolean {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) return false;
  return createHash("sha512").update(orderId + statusCode + gross + key).digest("hex") === signature;
}

export async function settlePayment(paymentId: string, ok: boolean): Promise<void> {
  const [p] = await db.select().from(s.payments).where(eq(s.payments.id, paymentId)).limit(1);
  if (!p || (p.status !== "PENDING" && p.status !== "VERIFYING")) return; // idempotent
  if (!ok) {
    await db.update(s.payments).set({ status: "FAILED" }).where(eq(s.payments.id, p.id));
    return;
  }
  await db.update(s.payments).set({ status: "PAID", paidAt: new Date() }).where(eq(s.payments.id, p.id));
  await db.insert(s.subscriptions).values({ workspaceId: p.workspaceId, planId: p.planId, amountIdr: p.amountIdr, interval: "ONCE" });
  await db.update(s.workspaces).set({ planId: p.planId }).where(eq(s.workspaces.id, p.workspaceId));
  await db.insert(s.auditLogs).values({ action: "billing.paid", target: p.workspaceId, meta: { planId: p.planId, amountIdr: p.amountIdr } });
}

/** Transfer manual: buat pembayaran dengan kode unik 3 digit, atau pakai ulang yang masih terbuka. */
export async function createManualPayment(workspaceId: string, planId: string, amountIdr: number) {
  const open = await db.select().from(s.payments).where(and(eq(s.payments.workspaceId, workspaceId), eq(s.payments.planId, planId), eq(s.payments.provider, "manual"), inArray(s.payments.status, ["PENDING", "VERIFYING"]))).limit(1);
  if (open[0]) return open[0];
  const used = new Set((await db.select({ c: s.payments.uniqueCode }).from(s.payments).where(and(eq(s.payments.amountIdr, amountIdr), inArray(s.payments.status, ["PENDING", "VERIFYING"])))).map((r) => r.c));
  let code = 0;
  for (let i = 0; i < 50; i++) {
    const c = 100 + Math.floor(Math.random() * 900);
    if (!used.has(c)) { code = c; break; }
  }
  const [pay] = await db.insert(s.payments).values({ workspaceId, planId, amountIdr, provider: "manual", uniqueCode: code }).returning();
  if (!pay) throw new Error("Gagal membuat pembayaran");
  return pay;
}

export async function rejectPayment(paymentId: string, reason: string): Promise<void> {
  const [p] = await db.select().from(s.payments).where(eq(s.payments.id, paymentId)).limit(1);
  if (!p || (p.status !== "PENDING" && p.status !== "VERIFYING")) return;
  await db.update(s.payments).set({ status: "FAILED", rejectReason: reason }).where(eq(s.payments.id, p.id));
  await db.insert(s.auditLogs).values({ action: "billing.rejected", target: p.workspaceId, meta: { paymentId: p.id, reason } });
}
