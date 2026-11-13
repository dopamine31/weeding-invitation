"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addTable, assignSeat, autoAssign, deleteTable, saveTables } from "@/app/actions/dashboard";
import { useToast } from "./ui";

export interface TableRow { id: string; name: string; shape: string; capacity: number; x: number; y: number; rotation: number }
export interface SeatGuest { id: string; name: string; pax: number; group: string; tableId: string | null }

export function SeatingClient({ eventId, tables: initial, guests }: { eventId: string; tables: TableRow[]; guests: SeatGuest[] }) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [, start] = useTransition();
  const [tables, setTables] = useState(initial);
  const [selId, setSelId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const refresh = () => start(() => router.refresh());
  const used = (id: string) => guests.filter((g) => g.tableId === id).reduce((a, g) => a + g.pax, 0);
  const sel = tables.find((t) => t.id === selId) ?? null;
  const unseated = guests.filter((g) => !g.tableId);

  const onDown = (e: React.PointerEvent, t: TableRow) => {
    const box = canvas.current?.getBoundingClientRect();
    if (!box) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: t.id, dx: ((e.clientX - box.left) / box.width) * 100 - t.x, dy: ((e.clientY - box.top) / box.height) * 100 - t.y };
    setSelId(t.id);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const box = canvas.current?.getBoundingClientRect();
    if (!d || !box) return;
    let x = ((e.clientX - box.left) / box.width) * 100 - d.dx;
    let y = ((e.clientY - box.top) / box.height) * 100 - d.dy;
    if (snap) { x = Math.round(x / 2.5) * 2.5; y = Math.round(y / 2.5) * 2.5; }
    setTables((ts) => ts.map((t) => (t.id === d.id ? { ...t, x: Math.max(2, Math.min(94, x)), y: Math.max(2, Math.min(92, y)) } : t)));
  };
  const onUp = async () => {
    const d = drag.current;
    drag.current = null;
    const t = tables.find((x) => x.id === d?.id);
    if (t) { const r = await saveTables(eventId, [t]); if (!r.ok) show(r.error); }
  };
  const patch = (id: string, p: Partial<TableRow>) => setTables((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const assign = async (gid: string, tid: string | null) => { const r = await assignSeat(eventId, gid, tid); show(r.ok ? r.data.warning ?? "Tersimpan" : r.error); refresh(); };

  return (
    <div className="space-y-4">
      {toast}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h1 className="font-display text-2xl">Denah Meja</h1>
        <div className="flex flex-wrap gap-2">
          {(["round", "square", "long", "zone"] as const).map((s) => <button key={s} className="btn btn-sm" onClick={async () => { const n = s === "zone" ? prompt("Nama zona (Panggung/Pintu/Buffet):", "Panggung") : ""; if (s === "zone" && !n) return; const r = await addTable(eventId, s, n ?? ""); show(r.ok ? "Ditambahkan" : r.error); refresh(); }}>+ {s === "round" ? "Bulat" : s === "square" ? "Persegi" : s === "long" ? "Panjang" : "Zona"}</button>)}
          <button className="btn btn-sm btn-primary" onClick={async () => { const r = await autoAssign(eventId); show(r.ok ? `${r.data.seated} tamu ditempatkan, ${r.data.unseated} belum muat` : r.error); refresh(); }}>Auto-assign per grup</button>
          <button className="btn btn-sm" onClick={() => window.print()}>Cetak / PDF</button>
        </div>
      </div>
      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <div className="card p-2">
          <div className="flex items-center gap-3 px-2 pb-2 text-sm"><label>Zoom <input type="range" min={0.6} max={1.6} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label><label><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap</label></div>
          <div className="overflow-auto">
            <div ref={canvas} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} className="relative rounded-xl touch-none select-none" style={{ width: `${zoom * 100}%`, minWidth: 560, aspectRatio: "4 / 3", background: "repeating-linear-gradient(0deg, transparent 0 39px, var(--app-border) 39px 40px), repeating-linear-gradient(90deg, transparent 0 39px, var(--app-border) 39px 40px)" }}>
              {tables.map((t) => {
                const u = used(t.id);
                const over = t.capacity > 0 && u > t.capacity;
                const size = t.shape === "long" ? { w: 18, h: 7 } : t.shape === "zone" ? { w: 16, h: 8 } : { w: 10, h: 13 };
                return (
                  <div key={t.id} role="button" tabIndex={0} aria-label={`Meja ${t.name}, ${u} dari ${t.capacity}`} onPointerDown={(e) => onDown(e, t)} onKeyDown={(e) => { const step = e.shiftKey ? 5 : 1; const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }; const d = m[e.key]; if (d) { e.preventDefault(); patch(t.id, { x: t.x + d[0], y: t.y + d[1] }); void saveTables(eventId, [{ ...t, x: t.x + d[0], y: t.y + d[1] }]); } }}
                    onClick={() => setSelId(t.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const gid = e.dataTransfer.getData("text/plain"); if (gid && t.capacity > 0) void assign(gid, t.id); }}
                    className="absolute grid place-items-center text-xs font-semibold cursor-grab active:cursor-grabbing"
                    style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${size.w}%`, aspectRatio: `${size.w} / ${size.h * 1.33}`, transform: `rotate(${t.rotation}deg)`, borderRadius: t.shape === "round" ? "50%" : t.shape === "zone" ? 4 : 8, background: t.shape === "zone" ? "color-mix(in srgb, var(--app-accent) 25%, transparent)" : "var(--app-card)", border: `2px solid ${over ? "var(--app-danger)" : selId === t.id ? "var(--app-accent)" : "var(--app-border)"}`, boxShadow: selId === t.id ? "0 0 0 3px color-mix(in srgb, var(--app-accent) 40%, transparent)" : undefined }}>
                    <span>{t.shape === "zone" ? t.name : `Meja ${t.name}`}{t.shape !== "zone" && <><br /><span className="font-normal" style={{ color: over ? "var(--app-danger)" : undefined }}>{u}/{t.capacity}</span></>}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <aside className="space-y-3">
          {sel && (
            <div className="card">
              <h2 className="font-semibold mb-1">{sel.shape === "zone" ? "Zona" : "Meja"} {sel.name}</h2>
              <label className="label" htmlFor="tn">Nama</label><input id="tn" className="input" value={sel.name} onChange={(e) => patch(sel.id, { name: e.target.value })} />
              {sel.shape !== "zone" && (<><label className="label" htmlFor="tc">Kapasitas</label><input id="tc" type="number" min={1} max={50} className="input" value={sel.capacity} onChange={(e) => patch(sel.id, { capacity: Number(e.target.value) })} /></>)}
              <label className="label" htmlFor="tr">Rotasi {sel.rotation}°</label><input id="tr" type="range" min={0} max={359} value={sel.rotation} onChange={(e) => patch(sel.id, { rotation: Number(e.target.value) })} className="w-full" />
              <div className="flex gap-2 mt-3"><button className="btn btn-sm btn-primary" onClick={async () => { const r = await saveTables(eventId, [sel]); show(r.ok ? "Tersimpan" : r.error); }}>Simpan</button><button className="btn btn-sm btn-danger" onClick={async () => { if (!confirm("Hapus meja ini? Penempatan tamu dilepas.")) return; const r = await deleteTable(eventId, sel.id); show(r.ok ? "Dihapus" : r.error); setSelId(null); setTables((ts) => ts.filter((t) => t.id !== sel.id)); refresh(); }}>Hapus</button></div>
              <ul className="mt-3 text-sm space-y-1">{guests.filter((g) => g.tableId === sel.id).map((g) => <li key={g.id} className="flex justify-between gap-2"><span className="truncate">{g.name} ({g.pax})</span><button className="underline text-xs" onClick={() => assign(g.id, null)}>lepas</button></li>)}</ul>
            </div>
          )}
          <div className="card">
            <h2 className="font-semibold mb-1">Belum duduk ({unseated.length})</h2>
            <p className="text-xs muted mb-2">Seret nama ke meja, atau pilih meja dari menu.</p>
            <ul className="space-y-1 max-h-96 overflow-auto">
              {unseated.map((g) => (
                <li key={g.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", g.id)} className="flex items-center gap-1 text-sm rounded-lg border px-2 py-1 cursor-grab" style={{ borderColor: "var(--app-border)" }}>
                  <span className="truncate flex-1">{g.name} <span className="muted">({g.pax}) {g.group}</span></span>
                  <select aria-label={`Meja untuk ${g.name}`} className="input" style={{ width: 84, minHeight: 28, padding: "2px 4px" }} value="" onChange={(e) => e.target.value && assign(g.id, e.target.value)}><option value="">Meja…</option>{tables.filter((t) => t.capacity > 0).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                </li>
              ))}
              {unseated.length === 0 && <li className="muted text-sm">Semua tamu yang hadir sudah duduk. 🎉</li>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
