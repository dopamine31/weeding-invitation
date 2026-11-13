"use client";

import { useMemo, useRef, useState } from "react";
import { markGuestWaSent } from "@/app/actions/dashboard";
import { KNOWN_VARS, renderTemplate, seededRng, validateTemplate, type TemplateVars } from "@/lib/spintax";
import { normalizePhone, waLink } from "@/lib/phone";
import { Empty, useToast } from "./ui";

interface G { id: string; name: string; phone: string | null; optedOut: boolean; sentAt: string | null; vars: TemplateVars }

const DEFAULT_TPL = "{Halo|Hai|Selamat siang} {{nama}}, kami {{nama_mempelai}} mengundang Anda ke pernikahan kami pada {{tanggal}} di {{lokasi}}.\nBuka undangan: {{link}}\nTerima kasih atas doa dan kehadirannya.";

export function BlastManual({ eventId, guests }: { eventId: string; guests: G[] }) {
  const [toast, show] = useToast();
  const [tpl, setTpl] = useState(DEFAULT_TPL);
  const [sent, setSent] = useState<Record<string, boolean>>(() => Object.fromEntries(guests.map((g) => [g.id, !!g.sentAt])));
  const [filter, setFilter] = useState<"all" | "todo" | "done">("todo");
  const [q, setQ] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);
  const v = validateTemplate(tpl);

  const rows = useMemo(
    () => guests.map((g, i) => ({ g, phone: normalizePhone(g.phone), text: renderTemplate(tpl, g.vars, seededRng(i + 1)) })),
    [guests, tpl],
  );
  const sendable = rows.filter((r) => r.phone && !r.g.optedOut);
  const doneCount = sendable.filter((r) => sent[r.g.id]).length;
  const shown = rows.filter((r) => {
    if (q && !r.g.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "todo") return !sent[r.g.id];
    if (filter === "done") return !!sent[r.g.id];
    return true;
  });

  const insert = (key: string) => {
    const pos = ta.current?.selectionStart ?? tpl.length;
    setTpl(tpl.slice(0, pos) + `{{${key}}}` + tpl.slice(pos));
  };
  const mark = async (id: string, val: boolean) => {
    setSent((p) => ({ ...p, [id]: val }));
    const r = await markGuestWaSent(eventId, id, val);
    if (!r.ok) {
      setSent((p) => ({ ...p, [id]: !val }));
      show(r.error);
    }
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); show("Pesan disalin"); } catch { show("Gagal menyalin"); }
  };

  return (
    <div className="space-y-4">
      {toast}
      <h1 className="font-display text-2xl">Kirim Undangan via WhatsApp</h1>
      <div className="card text-sm" role="note" style={{ borderColor: "var(--app-accent)" }}>
        Pesan dikirim dari <b>WhatsApp pribadi Anda</b>. Tekan <b>Kirim</b> di samping nama tamu, WhatsApp terbuka dengan pesan sudah terisi, lalu tekan kirim di WhatsApp. Tamu yang sudah Anda klik akan ditandai <b>Terkirim</b>.
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card space-y-1">
          <h2 className="font-semibold">Template pesan</h2>
          <label className="label" htmlFor="bt">Isi pesan <span className="float-right">{tpl.length} karakter</span></label>
          <textarea id="bt" ref={ta} className="input" rows={8} value={tpl} onChange={(e) => setTpl(e.target.value)} />
          <div className="flex flex-wrap gap-1">{KNOWN_VARS.map((k) => <button key={k} type="button" className="btn btn-sm" onClick={() => insert(k)}>{`{{${k}}}`}</button>)}</div>
          {!v.ok && <p role="alert" className="text-sm" style={{ color: "var(--app-danger)" }}>{v.unknown.length ? `Variabel tidak dikenal: ${v.unknown.join(", ")}` : "Template kosong"}</p>}
          <p className="text-xs muted pt-1">Pilihan seperti {"{Halo|Hai}"} dipilih acak per tamu supaya pesan tidak terlihat seragam. Template kembali ke bawaan kalau halaman dimuat ulang.</p>
          <p className="text-sm pt-2"><b>{doneCount}</b> dari <b>{sendable.length}</b> tamu bernomor sudah dikirimi.</p>
        </section>
        <section className="card space-y-2">
          <h2 className="font-semibold">Pratinjau (tamu pertama)</h2>
          <pre className="whitespace-pre-wrap text-sm rounded-xl p-3" style={{ background: "color-mix(in srgb, var(--app-ok) 12%, var(--app-card))" }}>{rows[0]?.text ?? "Belum ada tamu."}</pre>
        </section>
      </div>
      <section className="card">
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <h2 className="font-semibold mr-auto">Daftar tamu</h2>
          <input className="input" style={{ width: 180 }} placeholder="Cari nama" aria-label="Cari nama" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" style={{ width: 160 }} aria-label="Filter" value={filter} onChange={(e) => setFilter(e.target.value as "all")}>
            <option value="todo">Belum dikirim</option><option value="done">Sudah dikirim</option><option value="all">Semua</option>
          </select>
        </div>
        {guests.length === 0 ? <Empty icon="📣" title="Belum ada tamu" hint="Tambahkan tamu di menu Tamu terlebih dulu." /> : shown.length === 0 ? <p className="muted text-sm">Tidak ada tamu pada filter ini.</p> : (
          <ul className="divide-y" style={{ borderColor: "var(--app-border)" }}>
            {shown.map(({ g, phone, text }) => (
              <li key={g.id} className="py-2 flex flex-wrap items-center gap-2 justify-between">
                <div className="min-w-0">
                  <p className="font-medium truncate">{g.name}</p>
                  <p className="text-xs muted">{g.optedOut ? "Tidak mau dihubungi" : phone ?? "Belum ada nomor valid"}</p>
                </div>
                <div className="flex gap-1 items-center">
                  {sent[g.id] && <span className="badge badge-ok">Terkirim</span>}
                  <button className="btn btn-sm" onClick={() => copy(text)}>Salin</button>
                  {phone && !g.optedOut ? (
                    <a className="btn btn-sm btn-primary" href={waLink(phone, text)} target="_blank" rel="noopener noreferrer" onClick={() => void mark(g.id, true)}>{sent[g.id] ? "Kirim lagi" : "Kirim"}</a>
                  ) : null}
                  {sent[g.id] && <button className="btn btn-sm" onClick={() => void mark(g.id, false)}>Batal tandai</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
