import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireAuth } from "@/server/auth";
import { canAccessWorkspace } from "@/lib/tenant";
import { BANKS, adminWa, adminName } from "@/lib/bank";
import { confirmTransfer } from "@/app/actions/payments";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pembayaran", robots: { index: false } };

const rp = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default async function PayPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const a = await requireAuth();
  const [p] = await db.select().from(s.payments).where(eq(s.payments.id, paymentId)).limit(1).catch(() => []);
  if (!p || !canAccessWorkspace({ role: a.user.role, memberships: a.memberships }, p.workspaceId, "OWNER")) notFound();

  const code = p.id.slice(0, 8).toUpperCase();
  const total = p.amountIdr + p.uniqueCode;
  const wa = adminWa();
  const msg = [
    `Halo ${adminName()}, saya sudah transfer untuk pesanan ${code}.`,
    `Paket: ${p.planId}`,
    `Nominal: ${rp(total)}`,
    `Nama pengirim: ${p.senderName ?? "(isi nama pengirim)"}`,
    `Bukti transfer saya lampirkan di chat ini.`,
  ].join("\n");
  const waHref = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;

  async function confirm(fd: FormData) {
    "use server";
    await confirmTransfer(paymentId, fd);
  }

  const open = p.status === "PENDING" || p.status === "VERIFYING";

  return (
    <main className="min-h-screen grid place-items-center bg-stone-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg space-y-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-500">Pesanan {code}</p>
          <h1 className="text-xl font-semibold">Pembayaran paket {p.planId}</h1>
        </div>

        {p.status === "PAID" && (
          <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
            Pembayaran sudah dikonfirmasi dan paket aktif. Terima kasih!
          </div>
        )}

        {p.status === "FAILED" && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
            <p className="font-medium">Pembayaran ditolak / gagal.</p>
            <p>Alasan: {p.rejectReason ?? "-"}</p>
            <p className="mt-1">Silakan hubungi admin lewat WhatsApp atau buat pesanan baru dari halaman Billing.</p>
          </div>
        )}

        {p.status === "VERIFYING" && (
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            Konfirmasi transfer diterima. Admin sedang memeriksa mutasi rekening. Paket aktif setelah disetujui.
          </div>
        )}

        {open && (
          <>
            <div className="rounded-xl border border-stone-200 p-4">
              <p className="text-sm text-stone-600">Transfer tepat sejumlah</p>
              <p className="text-3xl font-semibold">{rp(total)}</p>
              <p className="mt-1 text-xs text-stone-500">
                Harga paket {rp(p.amountIdr)} + kode unik {p.uniqueCode}. Mohon transfer sesuai nominal sampai digit terakhir agar mudah dicek.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Transfer ke salah satu rekening:</p>
              {BANKS.map((b) => (
                <div key={b.bank} className="rounded-lg bg-stone-50 p-3 text-sm">
                  <p className="font-semibold">{b.bank}</p>
                  <p className="text-lg tracking-wide select-all">{b.number}</p>
                  <p className="text-stone-600">a/n {b.holder}</p>
                </div>
              ))}
            </div>

            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-center rounded-lg bg-emerald-600 px-4 font-medium text-white"
            >
              Kirim bukti via WhatsApp
            </a>

            {p.status === "PENDING" && (
              <form action={confirm} className="space-y-2 border-t border-stone-200 pt-4">
                <p className="text-sm font-medium">Atau konfirmasi di sini (opsional)</p>
                <input name="senderName" required placeholder="Nama pengirim / pemilik rekening" className="min-h-11 w-full rounded-lg border border-stone-300 px-3" />
                <input name="senderBank" placeholder="Bank pengirim (mis. BRI)" className="min-h-11 w-full rounded-lg border border-stone-300 px-3" />
                <input name="senderNote" placeholder="Catatan (opsional)" className="min-h-11 w-full rounded-lg border border-stone-300 px-3" />
                <button className="min-h-11 w-full rounded-lg border border-stone-300 px-4 font-medium">Saya sudah transfer</button>
              </form>
            )}
          </>
        )}

        <Link href="/dashboard/billing" className="block text-center text-sm text-stone-600 underline">
          Kembali ke Billing
        </Link>
      </div>
    </main>
  );
}
