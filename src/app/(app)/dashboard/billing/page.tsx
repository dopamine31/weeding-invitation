import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { currentEventPage } from "@/server/auth";
import { startCheckout } from "@/app/actions/dashboard";

const STATUS_LABEL: Record<string, string> = { PENDING: "Menunggu transfer", VERIFYING: "Sedang diperiksa", PAID: "Lunas", FAILED: "Ditolak" };
const METHOD_LABEL: Record<string, string> = { manual: "Transfer bank", midtrans: "Midtrans" };

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const { event, workspace } = await currentEventPage();
  const [plans, pays] = await Promise.all([db.select().from(s.plans), db.select().from(s.payments).where(eq(s.payments.workspaceId, event.workspaceId)).orderBy(desc(s.payments.createdAt)).limit(20)]);
  const order = ["free", "premium", "exclusive"];
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Paket & Billing</h1>
      <div className="grid md:grid-cols-3 gap-3">
        {plans.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).map((p) => (
          <div key={p.id} className="card space-y-2" style={workspace?.planId === p.id ? { borderColor: "var(--app-accent)", borderWidth: 2 } : undefined}>
            <div className="flex justify-between"><b>{p.name}</b>{workspace?.planId === p.id && <span className="badge badge-ok">Aktif</span>}</div>
            <p className="text-2xl font-semibold">{p.priceIdr ? `Rp ${p.priceIdr.toLocaleString("id-ID")}` : "Gratis"}</p>
            <ul className="text-sm muted space-y-1"><li>Hingga {p.guestLimit.toLocaleString("id-ID")} tamu</li><li>{p.blastLimit ? `${p.blastLimit.toLocaleString("id-ID")} pesan blast WA` : "Tanpa blast WA"}</li><li>{p.tvMode ? "TV Mode & Live Guestbook" : "Tanpa TV Mode"}</li><li>{p.premiumTemplates ? "Semua template premium" : "Template Free"}</li></ul>
            {p.priceIdr > 0 && workspace?.planId !== p.id && <form action={startCheckout.bind(null, p.id)}><button className="btn btn-primary w-full">Pilih {p.name}</button></form>}
          </div>
        ))}
      </div>
      <section className="card overflow-auto">
        <h2 className="font-semibold mb-2">Invoice</h2>
        {pays.length === 0 ? <p className="muted text-sm">Belum ada transaksi.</p> : (
          <table className="tbl"><thead><tr><th>Tanggal</th><th>Paket</th><th>Jumlah</th><th>Status</th><th>Metode</th><th>Aksi</th></tr></thead><tbody>
            {pays.map((p) => (
              <tr key={p.id}>
                <td>{p.createdAt.toLocaleDateString("id-ID")}</td>
                <td>{p.planId}</td>
                <td className="tabular-nums">Rp {(p.amountIdr + p.uniqueCode).toLocaleString("id-ID")}</td>
                <td><span className={`badge ${p.status === "PAID" ? "badge-ok" : p.status === "FAILED" ? "badge-bad" : ""}`}>{STATUS_LABEL[p.status] ?? p.status}</span></td>
                <td>{METHOD_LABEL[p.provider] ?? p.provider}</td>
                <td>{p.provider === "manual" ? <Link href={`/pay/${p.id}`} className="btn btn-sm">{p.status === "PENDING" ? "Bayar" : "Lihat"}</Link> : null}</td>
              </tr>
            ))}
          </tbody></table>
        )}
      </section>
    </div>
  );
}
