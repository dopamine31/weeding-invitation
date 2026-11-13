import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { currentEventPage } from "@/server/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ekspor" };

export default async function ExportPage() {
  const { event } = await currentEventPage();
  const subs = await db.select().from(s.subEvents).where(eq(s.subEvents.eventId, event.id)).orderBy(asc(s.subEvents.sort));
  const q = `eventId=${event.id}`;
  const items: [string, string, string][] = [["Daftar tamu (XLSX)", `/api/export/guests.xlsx?${q}`, "Nama, kontak, grup, meja"], ["Daftar tamu (CSV)", `/api/export/guests.csv?${q}`, "Untuk impor ulang"], ["RSVP (CSV)", `/api/export/rsvp.csv?${q}`, "Status, pax, menu, alergi"], ["Ucapan (CSV)", `/api/export/wishes.csv?${q}`, "Beserta status moderasi"], ["Semua data (JSON)", `/api/export/all.json?${q}`, "Hak akses data UU PDP"]];
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Ekspor</h1>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map(([t, h, d]) => <a key={h} href={h} className="card block hover:opacity-90"><b>{t}</b><p className="muted text-sm">{d}</p></a>)}
      </div>
      <section className="card">
        <h2 className="font-semibold">Catering Matrix (XLSX)</h2>
        <p className="muted text-sm mb-3">Siap kirim ke vendor: Ringkasan, Per Meja, Alergi & Diet, Daftar Tamu. Hanya tamu yang hadir.</p>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-primary" href={`/api/export/catering.xlsx?${q}`}>Semua acara</a>
          {subs.map((x) => <a key={x.id} className="btn" href={`/api/export/catering.xlsx?${q}&sub=${x.id}`}>{x.name}</a>)}
        </div>
      </section>
    </div>
  );
}
