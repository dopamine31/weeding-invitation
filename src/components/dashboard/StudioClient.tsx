"use client";

import { useState } from "react";
import Link from "next/link";
import { saveInvitationConfig, setEventStatus } from "@/app/actions/dashboard";
import { FONT_CHOICES, SECTION_LABELS, contrastRatio, type FontKey, type InvitationConfig } from "@/lib/invitation-config";
import { useToast } from "./ui";

type ColorKey = "bg" | "surface" | "text" | "muted" | "accent" | "accentText";
const COLOR_LABELS: Record<ColorKey, string> = { bg: "Latar", surface: "Permukaan", text: "Teks", muted: "Teks sekunder", accent: "Aksen", accentText: "Teks aksen" };

export function StudioClient({ eventId, slug, initial, tplColors, status }: { eventId: string; slug: string; initial: InvitationConfig; tplColors: Record<ColorKey, string>; status: string }) {
  const [cfg, setCfg] = useState<InvitationConfig>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [device, setDevice] = useState(390);
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, show] = useToast();
  const dirty = JSON.stringify(cfg) !== saved;
  const colors = { ...tplColors, ...cfg.theme } as Record<ColorKey, string>;
  const setTheme = (p: Partial<InvitationConfig["theme"]>) => setCfg((c) => ({ ...c, theme: { ...c.theme, ...p } }));
  const setText = (p: Partial<InvitationConfig["texts"]>) => setCfg((c) => ({ ...c, texts: { ...c.texts, ...p } }));
  const move = (i: number, d: number) => setCfg((c) => { const a = [...c.sections]; const j = i + d; if (j < 0 || j >= a.length) return c; [a[i], a[j]] = [a[j] as (typeof a)[number], a[i] as (typeof a)[number]]; return { ...c, sections: a }; });
  const save = async () => {
    setBusy(true);
    const r = await saveInvitationConfig(eventId, cfg);
    setBusy(false);
    show(r.ok ? "Tersimpan & diterapkan ke undangan" : r.error);
    if (r.ok) { setSaved(JSON.stringify(cfg)); setNonce((n) => n + 1); }
  };
  const cr = (a: string, b: string) => contrastRatio(a, b);
  const badge = (r: number) => <span className={`badge ${r >= 4.5 ? "badge-ok" : "badge-bad"}`}>{r.toFixed(1)}:1 {r >= 4.5 ? "AA" : "rendah"}</span>;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[400px_1fr]">
      {toast}
      <aside className="p-4 space-y-4 overflow-auto lg:h-screen border-r" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center justify-between gap-2"><Link href="/dashboard" className="btn btn-sm">← Dashboard</Link><div className="flex gap-2"><button className="btn btn-sm btn-primary" disabled={!dirty || busy} onClick={save}>{busy ? "…" : dirty ? "Simpan" : "Tersimpan"}</button></div></div>
        <h1 className="font-display text-xl">Studio</h1>
        <div className="flex gap-2 items-center"><span className={`badge ${status === "PUBLISHED" ? "badge-ok" : ""}`}>{status}</span><button className="btn btn-sm" onClick={async () => { const next = status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"; const r = await setEventStatus(eventId, next); show(r.ok ? `Status ${next}. Muat ulang halaman untuk melihat.` : r.error); }}>{status === "PUBLISHED" ? "Tarik ke draft" : "Terbitkan"}</button></div>

        <details open className="card"><summary className="font-semibold cursor-pointer">Tema & warna</summary>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {(Object.keys(COLOR_LABELS) as ColorKey[]).map((k) => (
              <label key={k} className="text-xs">{COLOR_LABELS[k]}<div className="flex gap-1"><input type="color" aria-label={COLOR_LABELS[k]} value={colors[k]} onChange={(e) => setTheme({ [k]: e.target.value })} style={{ width: 40, height: 36 }} /><input className="input" value={colors[k]} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && setTheme({ [k]: e.target.value })} /></div></label>
            ))}
          </div>
          <p className="text-xs mt-2 flex flex-wrap gap-2 items-center">Kontras teks/latar {badge(cr(colors.text, colors.bg))} sekunder {badge(cr(colors.muted, colors.bg))} aksen-teks {badge(cr(colors.accentText, colors.bg))}</p>
          <label className="label" htmlFor="font">Font judul</label>
          <select id="font" className="input" value={cfg.theme.displayFont ?? ""} onChange={(e) => setTheme({ displayFont: (e.target.value || undefined) as FontKey | undefined })}><option value="">Bawaan template</option>{(Object.keys(FONT_CHOICES) as FontKey[]).map((k) => <option key={k} value={k}>{FONT_CHOICES[k].label}</option>)}</select>
          <label className="label" htmlFor="rad">Radius sudut {cfg.theme.radius ?? "bawaan"}</label>
          <input id="rad" type="range" min={0} max={40} value={cfg.theme.radius ?? 4} onChange={(e) => setTheme({ radius: Number(e.target.value) })} className="w-full" />
          <button className="btn btn-sm mt-2" onClick={() => setCfg((c) => ({ ...c, theme: {} }))}>Reset ke template</button>
          <label className="flex gap-2 items-center mt-3 text-sm"><input type="checkbox" checked={cfg.texts.music === "ambient"} onChange={(e) => setText({ music: e.target.checked ? "ambient" : "off" })} /> Musik latar ambient (dibangkitkan WebAudio)</label>
        </details>

        <details open className="card"><summary className="font-semibold cursor-pointer">Section (urutan & tampil)</summary>
          <ul className="mt-2 space-y-1">
            {cfg.sections.map((s, i) => (
              <li key={s.type} className="flex items-center gap-1 text-sm"><input type="checkbox" aria-label={`Tampilkan ${SECTION_LABELS[s.type]}`} checked={s.visible} onChange={(e) => setCfg((c) => ({ ...c, sections: c.sections.map((x, j) => (j === i ? { ...x, visible: e.target.checked } : x)) }))} /><span className="flex-1">{SECTION_LABELS[s.type]}</span><button className="btn btn-sm" aria-label="Naik" onClick={() => move(i, -1)} disabled={i === 0}>↑</button><button className="btn btn-sm" aria-label="Turun" onClick={() => move(i, 1)} disabled={i === cfg.sections.length - 1}>↓</button></li>
            ))}
          </ul>
        </details>

        <details className="card"><summary className="font-semibold cursor-pointer">Teks</summary>
          <label className="label" htmlFor="gr">Sambutan</label><textarea id="gr" className="input" rows={3} maxLength={600} value={cfg.texts.greeting} onChange={(e) => setText({ greeting: e.target.value })} />
          <label className="label" htmlFor="qt">Kutipan / ayat</label><textarea id="qt" className="input" rows={3} maxLength={400} value={cfg.texts.quote} onChange={(e) => setText({ quote: e.target.value })} />
          <label className="label" htmlFor="qs">Sumber kutipan</label><input id="qs" className="input" value={cfg.texts.quoteSource} onChange={(e) => setText({ quoteSource: e.target.value })} />
          <label className="label" htmlFor="th">Ucapan terima kasih</label><input id="th" className="input" value={cfg.texts.thanks} onChange={(e) => setText({ thanks: e.target.value })} />
          <label className="label" htmlFor="dn">Catatan dress code</label><input id="dn" className="input" value={cfg.texts.dressNote} onChange={(e) => setText({ dressNote: e.target.value })} />
          <label className="label" htmlFor="dc">Palet dress code (hex, pisah koma)</label><input id="dc" className="input" defaultValue={cfg.texts.dressColors.join(", ")} onBlur={(e) => setText({ dressColors: e.target.value.split(",").map((x) => x.trim()).filter((x) => /^#[0-9a-fA-F]{6}$/.test(x)).slice(0, 6) })} />
          <label className="label" htmlFor="cu">Pantangan adat (satu per baris)</label><textarea id="cu" className="input" rows={3} defaultValue={cfg.texts.customary.join("\n")} onBlur={(e) => setText({ customary: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 10) })} />
        </details>

        <details className="card"><summary className="font-semibold cursor-pointer">Love story ({cfg.texts.loveStory.length})</summary>
          {cfg.texts.loveStory.map((x, i) => (
            <div key={i} className="border-t mt-2 pt-2 space-y-1" style={{ borderColor: "var(--app-border)" }}>
              <div className="grid grid-cols-3 gap-1"><input aria-label="Tahun" className="input" value={x.date} onChange={(e) => setText({ loveStory: cfg.texts.loveStory.map((y, j) => (j === i ? { ...y, date: e.target.value } : y)) })} /><input aria-label="Judul" className="input col-span-2" value={x.title} onChange={(e) => setText({ loveStory: cfg.texts.loveStory.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)) })} /></div>
              <textarea aria-label="Cerita" className="input" rows={2} value={x.text} onChange={(e) => setText({ loveStory: cfg.texts.loveStory.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) })} />
              <button className="btn btn-sm btn-danger" onClick={() => setText({ loveStory: cfg.texts.loveStory.filter((_, j) => j !== i) })}>Hapus</button>
            </div>
          ))}
          <button className="btn btn-sm mt-2" disabled={cfg.texts.loveStory.length >= 8} onClick={() => setText({ loveStory: [...cfg.texts.loveStory, { date: "", title: "", text: "" }] })}>+ Momen</button>
        </details>
        <p className="text-xs muted">Catatan: Studio ini adalah editor tema & konten berbasis section (bukan kanvas bebas drag/resize). Lihat docs/DECISIONS.md.</p>
      </aside>
      <main className="p-4 bg-[var(--app-bg)]">
        <div className="flex gap-2 mb-3 items-center flex-wrap">
          {([[390, "Mobile"], [768, "Tablet"], [1200, "Desktop"]] as const).map(([w, l]) => <button key={w} className={`btn btn-sm ${device === w ? "btn-primary" : ""}`} onClick={() => setDevice(w)}>{l}</button>)}
          <button className="btn btn-sm" onClick={() => setNonce((n) => n + 1)}>Muat ulang pratinjau</button>
          <a className="btn btn-sm" href={`/i/${slug}`} target="_blank" rel="noreferrer">Buka undangan ↗</a>
          {dirty && <span className="badge badge-bad">Belum disimpan, pratinjau menampilkan versi tersimpan</span>}
        </div>
        <div className="mx-auto rounded-2xl overflow-hidden border shadow-lg" style={{ width: Math.min(device, 1200), maxWidth: "100%", height: "calc(100vh - 110px)", borderColor: "var(--app-border)" }}>
          <iframe key={nonce} title="Pratinjau undangan" src={`/i/${slug}?preview=1`} className="w-full h-full bg-white" />
        </div>
      </main>
    </div>
  );
}
