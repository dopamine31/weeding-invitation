"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderateWishes } from "@/app/actions/dashboard";
import { Empty, useToast } from "./ui";

export interface WishRow { id: string; name: string; message: string; status: string; score: number; reasons: string[]; pinned: boolean; reply: string | null; at: string }
const TABS = [["ALL", "Semua"], ["PENDING", "Menunggu"], ["FLAGGED", "Ditandai"], ["APPROVED", "Disetujui"], ["REJECTED", "Ditolak"]] as const;

export function WishesClient({ eventId, rows }: { eventId: string; rows: WishRow[] }) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [, start] = useTransition();
  const [tab, setTab] = useState<string>("ALL");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const list = rows.filter((r) => tab === "ALL" || r.status === tab);
  const act = async (ids: string[], a: Parameters<typeof moderateWishes>[2], reply?: string) => {
    const r = await moderateWishes(eventId, ids, a, reply);
    show(r.ok ? "Berhasil" : r.error);
    setSel(new Set());
    start(() => router.refresh());
  };
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div className="space-y-4">
      {toast}
      <div className="flex flex-wrap justify-between gap-2 items-center"><h1 className="font-display text-2xl">Buku Tamu & Ucapan</h1><a className="btn" href={`/api/export/wishes.csv?eventId=${eventId}`}>Ekspor CSV</a></div>
      <div className="flex gap-1 flex-wrap" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`btn btn-sm ${tab === k ? "btn-primary" : ""}`} onClick={() => setTab(k)}>{l} ({k === "ALL" ? rows.length : rows.filter((r) => r.status === k).length})</button>)}</div>
      {sel.size > 0 && <div className="card flex gap-2 items-center flex-wrap"><b className="text-sm">{sel.size} dipilih</b><button className="btn btn-sm" onClick={() => act([...sel], "approve")}>Setujui</button><button className="btn btn-sm" onClick={() => act([...sel], "reject")}>Tolak</button><button className="btn btn-sm btn-danger" onClick={() => confirm("Hapus permanen?") && act([...sel], "delete")}>Hapus</button></div>}
      {list.length === 0 ? <Empty icon="💌" title="Belum ada ucapan" hint="Ucapan dari tamu akan muncul di sini setelah dimoderasi otomatis." /> : (
        <ul className="grid gap-2">
          {list.map((w) => (
            <li key={w.id} className="card flex gap-3">
              <input type="checkbox" aria-label={`Pilih ucapan ${w.name}`} checked={sel.has(w.id)} onChange={() => toggle(w.id)} className="mt-1" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2 items-center"><b>{w.pinned && "📌 "}{w.name}</b><span className={`badge ${w.status === "APPROVED" ? "badge-ok" : w.status === "REJECTED" || w.status === "FLAGGED" ? "badge-bad" : ""}`}>{w.status}</span>{w.score > 0 && <span className="text-xs muted">skor {w.score} {w.reasons.join(", ")}</span>}<span className="text-xs muted ml-auto">{w.at}</span></div>
                <p className="text-sm mt-1 break-words">{w.message}</p>
                {w.reply && <p className="text-sm muted mt-1">↳ {w.reply}</p>}
                <div className="flex gap-1 flex-wrap mt-2">
                  <button className="btn btn-sm" onClick={() => act([w.id], "approve")}>Setujui</button>
                  <button className="btn btn-sm" onClick={() => act([w.id], "reject")}>Tolak</button>
                  <button className="btn btn-sm" onClick={() => act([w.id], w.pinned ? "unpin" : "pin")}>{w.pinned ? "Lepas sematan" : "Sematkan"}</button>
                  <button className="btn btn-sm" onClick={() => { const r = prompt("Balasan untuk tamu:", w.reply ?? ""); if (r !== null) void act([w.id], "reply", r); }}>Balas</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
