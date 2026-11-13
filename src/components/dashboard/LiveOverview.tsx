"use client";

import { useEffect, useState } from "react";
import type { Stats } from "@/server/stats";

export function LiveOverview({ eventId, initial, slug }: { eventId: string; initial: Stats; slug: string }) {
  const [s, setS] = useState(initial);
  const [live, setLive] = useState(false);
  useEffect(() => {
    let es: EventSource | null = null;
    let retry = 1000;
    let timer: number | undefined;
    const connect = () => {
      es = new EventSource(`/api/events/${eventId}/stream`);
      es.onopen = () => { setLive(true); retry = 1000; };
      es.onmessage = (e) => setS(JSON.parse(e.data) as Stats);
      es.onerror = () => {
        setLive(false);
        es?.close();
        timer = window.setTimeout(connect, retry);
        retry = Math.min(retry * 2, 15000);
      };
    };
    connect();
    return () => { es?.close(); window.clearTimeout(timer); };
  }, [eventId]);

  const funnel: [string, number][] = [["Diundang", s.invited], ["Terkirim", s.sent], ["Dibuka", s.opened], ["RSVP", s.rsvped], ["Hadir", s.attending]];
  const max = Math.max(1, s.invited);
  const dmax = Math.max(1, ...s.daily.map((d) => d.n));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl">Ringkasan</h1>
        <div className="flex items-center gap-2"><span className={`badge ${live ? "badge-ok" : "badge-bad"}`} aria-live="polite">{live ? "● Live" : "Menyambung ulang…"}</span><a className="btn btn-sm" href={`/i/${slug}`} target="_blank" rel="noreferrer">Lihat undangan ↗</a></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([["Total pax hadir", s.totalPax], ["Belum RSVP", s.notRsvp], ["Sudah check-in", s.checkedIn], ["Ucapan perlu ditinjau", s.wishesPending]] as const).map(([l, v]) => (
          <div key={l} className="card"><p className="muted text-xs">{l}</p><p className="text-3xl font-semibold tabular-nums">{v}</p></div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <section className="card" aria-label="Funnel">
          <h2 className="font-semibold mb-3">Funnel undangan</h2>
          {funnel.map(([l, v]) => (
            <div key={l} className="mb-2">
              <div className="flex justify-between text-sm"><span>{l}</span><span className="tabular-nums">{v}</span></div>
              <div className="h-2 rounded-full" style={{ background: "var(--app-border)" }}><div className="h-2 rounded-full" style={{ width: `${(v / max) * 100}%`, background: "var(--app-accent)", transition: "width .6s" }} /></div>
            </div>
          ))}
        </section>
        <section className="card" aria-label="RSVP harian">
          <h2 className="font-semibold mb-3">RSVP 14 hari terakhir</h2>
          {s.daily.length === 0 ? <p className="muted text-sm">Belum ada RSVP.</p> : (
            <div className="flex items-end gap-1 h-32">
              {s.daily.map((d) => (<div key={d.day} className="flex-1 text-center" title={`${d.day}: ${d.n}`}><div className="rounded-t" style={{ height: `${(d.n / dmax) * 100}px`, background: "var(--app-accent)", minHeight: 4 }} /><div className="text-[9px] muted mt-1">{d.day.slice(0, 2)}</div></div>))}
            </div>
          )}
        </section>
        <section className="card" aria-label="Menu dan alergi">
          <h2 className="font-semibold mb-2">Menu & alergi</h2>
          {s.menus.length === 0 ? <p className="muted text-sm">Belum ada pilihan menu.</p> : s.menus.map((m) => <div key={m.name} className="flex justify-between text-sm py-1"><span>{m.name}</span><b>{m.pax}</b></div>)}
          <p className="text-sm mt-2"><span className="badge badge-bad">{s.allergies}</span> tamu melaporkan alergi/diet</p>
        </section>
        <section className="card" aria-label="RSVP terbaru">
          <h2 className="font-semibold mb-2">RSVP terbaru</h2>
          {s.recent.length === 0 ? <p className="muted text-sm">Belum ada.</p> : s.recent.map((r, i) => <div key={i} className="flex justify-between text-sm py-1 gap-2"><span className="truncate">{r.name}</span><span className="muted whitespace-nowrap">{r.status === "attending" ? "Hadir" : r.status === "declined" ? "Tidak" : "Mungkin"} · {r.at}</span></div>)}
        </section>
      </div>
    </div>
  );
}
