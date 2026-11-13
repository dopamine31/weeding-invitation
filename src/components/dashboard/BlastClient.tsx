"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { controlCampaign, createCampaign } from "@/app/actions/dashboard";
import { KNOWN_VARS, renderTemplate, seededRng, validateTemplate, type TemplateVars } from "@/lib/spintax";
import { Empty, useToast } from "./ui";

interface Camp { id: string; name: string; status: string; counts: Record<string, number> }
const DEFAULT_TPL = "{Halo|Hai|Selamat siang} {{nama}}, kami {{nama_mempelai}} mengundang Anda ke pernikahan kami pada {{tanggal}} di {{lokasi}}.\nBuka undangan: {{link}}\nInfo: {{pic_nama}} ({{pic_wa}}). Balas STOP untuk berhenti menerima pesan.";

export function BlastClient({ eventId, groups, withPhone, sample, campaigns }: { eventId: string; groups: { id: string; name: string }[]; withPhone: number; sample: TemplateVars; campaigns: Camp[] }) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [, start] = useTransition();
  const [tpl, setTpl] = useState(DEFAULT_TPL);
  const [name, setName] = useState("Undangan");
  const [seg, setSeg] = useState<{ kind: "all" | "group" | "notRsvp" | "noOpen" | "attending"; groupId?: string }>({ kind: "all" });
  const [preset, setPreset] = useState<"safe" | "demo">("demo");
  const [adv, setAdv] = useState({ minDelaySec: 12, maxDelaySec: 30, dailyCap: 200, windowStart: 8, windowEnd: 21 });
  const [seed, setSeed] = useState(1);
  const [camps, setCamps] = useState(campaigns);
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const v = validateTemplate(tpl);
  const preview = useMemo(() => renderTemplate(tpl, sample, seededRng(seed)), [tpl, sample, seed]);
  const avg = preset === "demo" ? 1.5 : (adv.minDelaySec + adv.maxDelaySec) / 2;
  const mins = Math.ceil((withPhone * avg) / 60);

  useEffect(() => {
    const running = camps.some((c) => c.status === "RUNNING");
    const id = window.setInterval(async () => {
      try {
        if (running) await fetch(`/api/events/${eventId}/tick`, { method: "POST" });
        const r = await fetch(`/api/events/${eventId}/blast`, { cache: "no-store" });
        if (r.ok) setCamps((await r.json()) as Camp[]);
      } catch { /* offline, retry next tick */ }
    }, 2500);
    return () => window.clearInterval(id);
  }, [eventId, camps]);

  const insert = (key: string) => {
    const el = ta.current;
    const pos = el?.selectionStart ?? tpl.length;
    setTpl(tpl.slice(0, pos) + `{{${key}}}` + tpl.slice(pos));
  };
  const send = async () => {
    setBusy(true);
    const r = await createCampaign(eventId, { name, template: tpl, segment: seg, preset, ...adv });
    setBusy(false);
    show(r.ok ? `${r.data.queued} pesan masuk antrian` : r.error);
    if (r.ok) start(() => router.refresh());
  };
  const total = (c: Camp) => Object.values(c.counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {toast}
      <h1 className="font-display text-2xl">Blast WhatsApp</h1>
      <div className="card text-sm" role="note" style={{ borderColor: "var(--app-accent)" }}>
        <b>Penting:</b> Cloud API resmi Meta aman namun butuh persetujuan template. Gateway tidak resmi (mis. Fonnte) berisiko nomor diblokir. Gunakan nomor khusus, spintax, jeda acak, dan hanya kirim ke tamu yang mengenal Anda. Mode saat ini: <b>{process.env.NEXT_PUBLIC_WA_MODE ?? "mock (simulasi)"}</b>.
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card space-y-1">
          <h2 className="font-semibold">Kampanye baru</h2>
          <label className="label" htmlFor="bn">Nama kampanye</label><input id="bn" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="label" htmlFor="bt">Template pesan <span className="float-right">{tpl.length} karakter</span></label>
          <textarea id="bt" ref={ta} className="input" rows={7} value={tpl} onChange={(e) => setTpl(e.target.value)} />
          <div className="flex flex-wrap gap-1">{KNOWN_VARS.map((k) => <button key={k} type="button" className="btn btn-sm" onClick={() => insert(k)}>{`{{${k}}}`}</button>)}</div>
          {!v.ok && <p role="alert" className="text-sm" style={{ color: "var(--app-danger)" }}>{v.unknown.length ? `Variabel tidak dikenal: ${v.unknown.join(", ")}` : "Template kosong"}</p>}
          <label className="label" htmlFor="bs">Segmen</label>
          <select id="bs" className="input" value={seg.kind} onChange={(e) => setSeg({ kind: e.target.value as "all" })}><option value="all">Semua tamu</option><option value="group">Per grup</option><option value="notRsvp">Belum RSVP</option><option value="noOpen">Belum membuka undangan</option><option value="attending">Yang hadir</option></select>
          {seg.kind === "group" && <select aria-label="Grup" className="input mt-1" value={seg.groupId ?? ""} onChange={(e) => setSeg({ kind: "group", groupId: e.target.value })}><option value="">Pilih grup</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>}
          <label className="label" htmlFor="bp">Kecepatan kirim</label>
          <select id="bp" className="input" value={preset} onChange={(e) => setPreset(e.target.value as "safe")}><option value="demo">Demo cepat (1-2 dtk, abaikan jendela waktu)</option><option value="safe">Aman anti-banned (kustom)</option></select>
          {preset === "safe" && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {([["minDelaySec", "Jeda min (dtk)"], ["maxDelaySec", "Jeda maks (dtk)"], ["dailyCap", "Batas harian"], ["windowStart", "Jendela mulai (jam)"], ["windowEnd", "Jendela akhir (jam)"]] as const).map(([k, l]) => <label key={k}>{l}<input type="number" className="input" value={adv[k]} onChange={(e) => setAdv({ ...adv, [k]: Number(e.target.value) })} /></label>)}
            </div>
          )}
          <p className="text-sm muted pt-2">Dry-run: {withPhone} tamu bernomor valid, estimasi durasi ±{mins} menit (belum termasuk jendela kirim & batas harian). Tamu opt-out otomatis dilewati.</p>
          <label className="text-sm flex gap-2 items-start pt-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1" /> Saya paham risiko pengiriman massal dan tamu hanya yang telah memberi izin.</label>
          <button className="btn btn-primary w-full mt-2" disabled={!v.ok || busy || !ack || (seg.kind === "group" && !seg.groupId)} onClick={send}>{busy ? "Menjadwalkan…" : "Mulai kirim"}</button>
        </section>
        <section className="space-y-4">
          <div className="card">
            <div className="flex justify-between items-center"><h2 className="font-semibold">Pratinjau (tamu contoh)</h2><button className="btn btn-sm" onClick={() => setSeed((s) => s + 1)}>Acak variasi</button></div>
            <pre className="whitespace-pre-wrap text-sm mt-2 rounded-xl p-3" style={{ background: "color-mix(in srgb, var(--app-ok) 12%, var(--app-card))" }}>{preview}</pre>
          </div>
          <div className="card">
            <h2 className="font-semibold mb-2">Kampanye</h2>
            {camps.length === 0 ? <Empty icon="📣" title="Belum ada kampanye" hint="Pesan akan dikirim bertahap dengan jeda acak untuk menjaga nomor Anda." /> : camps.map((c) => {
              const t = total(c) || 1;
              const done = (c.counts.SENT ?? 0) + (c.counts.DELIVERED ?? 0) + (c.counts.READ ?? 0) + (c.counts.FAILED ?? 0) + (c.counts.SKIPPED ?? 0);
              return (
                <div key={c.id} className="border-t py-3" style={{ borderColor: "var(--app-border)" }}>
                  <div className="flex justify-between gap-2"><b className="truncate">{c.name}</b><span className={`badge ${c.status === "DONE" ? "badge-ok" : c.status === "CANCELED" ? "badge-bad" : ""}`}>{c.status}</span></div>
                  <div className="h-2 rounded-full my-2" style={{ background: "var(--app-border)" }}><div className="h-2 rounded-full" style={{ width: `${(done / t) * 100}%`, background: "var(--app-accent)", transition: "width .5s" }} /></div>
                  <p className="text-xs muted">{Object.entries(c.counts).map(([k, n]) => `${k} ${n}`).join(" · ")}</p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {c.status === "RUNNING" && <button className="btn btn-sm" onClick={() => controlCampaign(eventId, c.id, "pause").then(() => show("Dijeda"))}>Jeda</button>}
                    {c.status === "PAUSED" && <button className="btn btn-sm" onClick={() => controlCampaign(eventId, c.id, "resume").then(() => show("Dilanjutkan"))}>Lanjut</button>}
                    {(c.status === "RUNNING" || c.status === "PAUSED") && <button className="btn btn-sm btn-danger" onClick={() => confirm("Batalkan sisa antrian?") && controlCampaign(eventId, c.id, "cancel").then(() => show("Dibatalkan"))}>Batalkan</button>}
                    {(c.counts.FAILED ?? 0) > 0 && <button className="btn btn-sm" onClick={() => controlCampaign(eventId, c.id, "resendFailed").then(() => show("Kirim ulang dijadwalkan"))}>Kirim ulang gagal ({c.counts.FAILED})</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
