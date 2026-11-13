import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireAuth } from "@/server/auth";
import { settlePayment } from "@/server/payments";
import { canAccessWorkspace } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "Simulasi Pembayaran", robots: { index: false } };

export default async function MockPay({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const a = await requireAuth();
  const [p] = await db.select().from(s.payments).where(eq(s.payments.id, paymentId)).limit(1).catch(() => []);
  if (!p || !canAccessWorkspace({ role: a.user.role, memberships: a.memberships }, p.workspaceId, "OWNER")) notFound();

  async function settle(fd: FormData) {
    "use server";
    const auth = await requireAuth();
    const [pay] = await db.select().from(s.payments).where(eq(s.payments.id, paymentId)).limit(1);
    if (!pay || !canAccessWorkspace({ role: auth.user.role, memberships: auth.memberships }, pay.workspaceId, "OWNER")) return;
    await settlePayment(paymentId, fd.get("result") === "success");
    redirect("/dashboard/billing");
  }

  return (
    <main className="min-h-screen grid place-items-center bg-stone-100 p-6">
      <form action={settle} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg space-y-4">
        <p className="text-xs uppercase tracking-widest text-amber-700">Mode Demo · Mock Payment</p>
        <h1 className="text-xl font-semibold">Bayar paket {p.planId}</h1>
        <p className="text-3xl font-semibold">Rp {p.amountIdr.toLocaleString("id-ID")}</p>
        <p className="text-sm text-stone-600">Status: {p.status}. Halaman ini mensimulasikan Midtrans Snap. Isi MIDTRANS_SERVER_KEY untuk pembayaran nyata.</p>
        <div className="grid gap-2">
          <button name="result" value="success" className="min-h-11 rounded-lg bg-emerald-600 px-4 text-white font-medium">Simulasikan sukses</button>
          <button name="result" value="fail" className="min-h-11 rounded-lg border border-stone-300 px-4 font-medium">Simulasikan gagal</button>
        </div>
      </form>
    </main>
  );
}
