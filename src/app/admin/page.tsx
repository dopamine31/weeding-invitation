import { desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { computeKpi, mrrSeries } from "@/lib/billing";
import { TEMPLATES } from "@/templates";
import { changePlan, impersonate, softDeleteTenant, toggleSuspend } from "@/app/actions/admin";
import { logoutAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Super Admin" };

const idr = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86_400_000);
  const [subs, wss, plans, pays, audits, tplUse] = await Promise.all([
    db.select().from(s.subscriptions),
    db.select().from(s.workspaces).where(isNull(s.workspaces.deletedAt)).orderBy(desc(s.workspaces.createdAt)),
    db.select().from(s.plans),
    db.select().from(s.payments).where(eq(s.payments.status, "PAID")),
    db.select().from(s.auditLogs).orderBy(desc(s.auditLogs.createdAt)).limit(15),
    db.select({ t: s.events.templateSlug, n: sql<number>`count(*)::int` }).from(s.events).groupBy(s.events.templateSlug),
  ]);
  const [wa] = await db.select({ n: sql<number>`count(*)::int` }).from(s.blastMessages).where(sql`${s.blastMessages.status} in ('SENT','DELIVERED','READ')`);
  const [upc] = await db.select({ n: sql<number>`count(*)::int` }).from(s.subEvents).where(sql`${s.subEvents.startsAt} between now() and now() + interval '30 days'`);
  const queue = (await db.execute(sql`select status, count(*)::int as n from blast_messages group by status`)) as unknown as { rows: { status: string; n: number }[] };
  const [newSignups] = await db.select({ n: sql<number>`count(*)::int` }).from(s.users).where(gt(s.users.createdAt, d30));

  const kpi = computeKpi(subs, now);
  const before = computeKpi(subs, d30);
  const canceled = subs.filter((x) => x.canceledAt && x.canceledAt > d30).length;
  const churn = before.activeSubs ? Math.round((canceled / before.activeSubs) * 100) : 0;
  const paid = wss.filter((w) => w.planId !== "free").length;
  const series = mrrSeries(subs, 6, now);
  const smax = Math.max(1, ...series.map((x) => x.mrr));
  const gmv = pays.reduce((a, p) => a + p.amountIdr, 0);
  const list = wss.filter((w) => !q || w.name.toLowerCase().includes(q.toLowerCase()));
  const kpis: [string, string][] = [["MRR", idr(kpi.mrr)], ["ARR", idr(kpi.arr)], ["ARPU", idr(kpi.arpu)], ["Tenant aktif", String(wss.filter((w) => !w.suspended).length)], ["Signup baru (30h)", String(newSignups?.n ?? 0)], ["Churn (30h)", `${churn}%`], ["Konversi Free→Paid", `${wss.length ? Math.round((paid / wss.length) * 100) : 0}%`], ["GMV (lifetime)", idr(gmv)], ["Pesan WA terkirim", String(wa?.n ?? 0)], ["Acara 30 hari ke depan", String(upc?.n ?? 0)]];

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <header className="flex justify-between items-center"><h1 className="font-display text-2xl">Super Admin</h1><form action={logoutAction}><button className="btn btn-sm">Keluar</button></form></header>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{kpis.map(([l, v]) => <div className="card" key={l}><p className="muted text-xs">{l}</p><p className="text-lg font-semibold tabular-nums">{v}</p></div>)}</div>
      <section className="card"><h2 className="font-semibold mb-3">Tren MRR (6 bulan)</h2>
        <div className="flex items-end gap-3 h-36">{series.map((x) => <div key={x.month} className="flex-1 text-center"><div className="text-[10px] muted">{(x.mrr / 1000).toFixed(0)}k</div><div className="rounded-t" style={{ height: `${(x.mrr / smax) * 100}px`, minHeight: 3, background: "var(--app-accent)" }} /><div className="text-[10px] muted mt-1">{x.month}</div></div>)}</div>
      </section>
      <section className="card overflow-auto"><div className="flex justify-between items-center mb-2 gap-2 flex-wrap"><h2 className="font-semibold">Tenant ({list.length})</h2><form><input name="q" defaultValue={q} placeholder="Cari tenant" aria-label="Cari tenant" className="input" style={{ width: 200 }} /></form></div>
        <table className="tbl"><thead><tr><th>Nama</th><th>Paket</th><th>Status</th><th>Dibuat</th><th>Aksi</th></tr></thead><tbody>
          {list.map((w) => (
            <tr key={w.id}><td>{w.name}</td>
              <td><form action={changePlan.bind(null, w.id)} className="flex gap-1"><select name="plan" defaultValue={w.planId} aria-label={`Paket ${w.name}`} className="input" style={{ minHeight: 32, width: 110 }}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="btn btn-sm">Ubah</button></form></td>
              <td><span className={`badge ${w.suspended ? "badge-bad" : "badge-ok"}`}>{w.suspended ? "Ditangguhkan" : "Aktif"}</span></td><td>{w.createdAt.toLocaleDateString("id-ID")}</td>
              <td className="whitespace-nowrap"><form action={toggleSuspend.bind(null, w.id)} className="inline"><button className="btn btn-sm">{w.suspended ? "Aktifkan" : "Suspend"}</button></form> <form action={impersonate.bind(null, w.id)} className="inline"><button className="btn btn-sm">Impersonate</button></form> <form action={softDeleteTenant.bind(null, w.id)} className="inline"><button className="btn btn-sm btn-danger">Hapus</button></form></td></tr>
          ))}
        </tbody></table>
      </section>
      <div className="grid md:grid-cols-3 gap-3">
        <section className="card"><h2 className="font-semibold mb-2">Pemakaian template</h2>{TEMPLATES.map((t) => <div key={t.slug} className="flex justify-between text-sm py-0.5"><span>{t.name}</span><b>{tplUse.find((x) => x.t === t.slug)?.n ?? 0}</b></div>)}</section>
        <section className="card"><h2 className="font-semibold mb-2">Antrian pesan (job)</h2>{queue.rows.length === 0 ? <p className="muted text-sm">Kosong</p> : queue.rows.map((r) => <div key={r.status} className="flex justify-between text-sm py-0.5"><span>{r.status}</span><b>{r.n}</b></div>)}</section>
        <section className="card"><h2 className="font-semibold mb-2">Audit log</h2><ul className="text-xs space-y-1 max-h-48 overflow-auto">{audits.map((a) => <li key={a.id}><b>{a.action}</b> <span className="muted">{a.target.slice(0, 18)} · {a.createdAt.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span></li>)}</ul></section>
      </div>
      <p className="muted text-xs">Belum tersedia: CRUD marketplace template, kupon, feature flags & system settings, bagi hasil kreator (lihat docs/PROGRESS.md).</p>
    </main>
  );
}
