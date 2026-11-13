"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEventAction } from "@/app/actions/dashboard";
import { TEMPLATES } from "@/templates";

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36);

export function Wizard({ premiumOk }: { premiumOk: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [f, setF] = useState({ groomName: "", brideName: "", date: "", time: "10:00", timezone: "WIB" as "WIB" | "WITA" | "WIT", venue: "", address: "", templateSlug: "elegant-ivory", slug: "" });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const slug = f.slug || slugify(`${f.groomName}-${f.brideName}`);
  const valid = [f.groomName.trim() && f.brideName.trim(), f.date && f.time, true, slug.length >= 3][step];

  const submit = () => {
    setErr("");
    start(async () => {
      const r = await createEventAction({ ...f, slug });
      if (r.ok) router.push("/dashboard");
      else setErr(r.error);
    });
  };

  return (
    <div className="card max-w-2xl w-full space-y-3">
      <ol className="flex gap-2 text-xs" aria-label="Langkah">
        {["Mempelai", "Acara", "Template", "Tautan"].map((t, i) => <li key={t} className={`badge ${i === step ? "" : i < step ? "badge-ok" : ""}`} style={i > step ? { opacity: 0.5 } : undefined}>{i + 1}. {t}</li>)}
      </ol>
      {step === 0 && (
        <div>
          <label className="label" htmlFor="g">Nama mempelai pria (panggilan)</label><input id="g" className="input" value={f.groomName} onChange={(e) => set("groomName", e.target.value)} maxLength={40} />
          <label className="label" htmlFor="b">Nama mempelai wanita (panggilan)</label><input id="b" className="input" value={f.brideName} onChange={(e) => set("brideName", e.target.value)} maxLength={40} />
        </div>
      )}
      {step === 1 && (
        <div className="grid sm:grid-cols-2 gap-x-3">
          <div><label className="label" htmlFor="d">Tanggal</label><input id="d" type="date" className="input" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
          <div><label className="label" htmlFor="t">Jam</label><input id="t" type="time" className="input" value={f.time} onChange={(e) => set("time", e.target.value)} /></div>
          <div><label className="label" htmlFor="z">Zona waktu</label><select id="z" className="input" value={f.timezone} onChange={(e) => set("timezone", e.target.value as "WIB")}><option>WIB</option><option>WITA</option><option>WIT</option></select></div>
          <div><label className="label" htmlFor="v">Lokasi</label><input id="v" className="input" value={f.venue} onChange={(e) => set("venue", e.target.value)} maxLength={120} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="a">Alamat</label><input id="a" className="input" value={f.address} onChange={(e) => set("address", e.target.value)} maxLength={240} /></div>
        </div>
      )}
      {step === 2 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TEMPLATES.map((t) => {
            const locked = t.tier === "premium" && !premiumOk;
            return (
              <button key={t.slug} type="button" disabled={locked} onClick={() => set("templateSlug", t.slug)} aria-pressed={f.templateSlug === t.slug}
                className="rounded-xl border p-2 text-left disabled:opacity-40" style={{ borderColor: f.templateSlug === t.slug ? "var(--app-accent)" : "var(--app-border)", borderWidth: f.templateSlug === t.slug ? 2 : 1 }}>
                <div className="h-20 rounded-lg mb-2 grid place-items-center text-xs" style={{ background: t.colors.bg, color: t.colors.text, border: `2px solid ${t.colors.accent}` }}>Aa</div>
                <div className="text-xs font-semibold">{t.name}</div>
                <div className="text-[10px] muted">{locked ? "Premium" : t.tier === "free" ? "Free" : "Premium"}</div>
              </button>
            );
          })}
        </div>
      )}
      {step === 3 && (
        <div>
          <label className="label" htmlFor="s">Alamat undangan</label>
          <div className="flex items-center gap-1"><span className="muted text-sm">/i/</span><input id="s" className="input" value={slug} onChange={(e) => set("slug", slugify(e.target.value))} /></div>
          <p className="text-xs muted mt-2">Undangan langsung terpublikasi. Anda dapat mengubah semuanya di Pengaturan dan Studio.</p>
        </div>
      )}
      <p role="alert" aria-live="polite" className="text-sm min-h-5" style={{ color: "var(--app-danger)" }}>{err}</p>
      <div className="flex justify-between">
        <button className="btn" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending}>Kembali</button>
        {step < 3 ? <button className="btn btn-primary" disabled={!valid} onClick={() => setStep((s) => s + 1)}>Lanjut</button> : <button className="btn btn-primary" disabled={!valid || pending} onClick={submit}>{pending ? "Membuat…" : "Terbitkan undangan"}</button>}
      </div>
    </div>
  );
}
