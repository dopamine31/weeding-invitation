"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { anonymizeNow, deleteEventPermanently, saveEventSettings, type SettingsInput } from "@/app/actions/dashboard";
import { TEMPLATES } from "@/templates";
import { useToast } from "./ui";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}

type Sub = SettingsInput["subEvents"][number];
const emptySub = (): Sub => ({ name: "Akad Nikah", date: "", time: "08:00", endTime: "", venue: "", address: "", mapsUrl: "", dressCode: "", streamingUrl: "" });

export function SettingsClient({ eventId, slug, initial }: { eventId: string; slug: string; initial: SettingsInput }) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [f, setF] = useState<SettingsInput>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmSlug, setConfirmSlug] = useState("");
  const set = <K extends keyof SettingsInput>(k: K, v: SettingsInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const upd = <K extends "subEvents" | "pics" | "gifts" | "menus" | "wishlist">(k: K, i: number, patch: Partial<SettingsInput[K][number]>) => setF((p) => ({ ...p, [k]: (p[k] as object[]).map((x, j) => (j === i ? { ...x, ...patch } : x)) }) as SettingsInput);
  const del = (k: "subEvents" | "pics" | "gifts" | "menus" | "wishlist", i: number) => setF((p) => ({ ...p, [k]: (p[k] as object[]).filter((_, j) => j !== i) }) as SettingsInput);

  const save = async () => {
    setBusy(true);
    setErr("");
    const r = await saveEventSettings(eventId, f);
    setBusy(false);
    if (r.ok) { show("Pengaturan tersimpan"); router.refresh(); } else setErr(r.error + (r.fieldErrors ? ` (${Object.keys(r.fieldErrors).join(", ")})` : ""));
  };

  return (
    <div className="space-y-4">
      {toast}
      <div className="flex flex-wrap justify-between items-center gap-2"><h1 className="font-display text-2xl">Pengaturan</h1><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Menyimpan…" : "Simpan semua"}</button></div>
      <p role="alert" aria-live="polite" className="text-sm" style={{ color: "var(--app-danger)" }}>{err}</p>

      <section className="card grid sm:grid-cols-2 gap-x-3" aria-label="Informasi">
        <h2 className="font-semibold sm:col-span-2">Informasi pernikahan</h2>
        <Field label="Judul undangan"><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Template"><select className="input" value={f.templateSlug} onChange={(e) => set("templateSlug", e.target.value)}>{TEMPLATES.map((t) => <option key={t.slug} value={t.slug}>{t.name} ({t.tier})</option>)}</select></Field>
        <Field label="Panggilan pria"><input className="input" value={f.groomName} onChange={(e) => set("groomName", e.target.value)} /></Field>
        <Field label="Panggilan wanita"><input className="input" value={f.brideName} onChange={(e) => set("brideName", e.target.value)} /></Field>
        <Field label="Nama lengkap pria"><input className="input" value={f.groomFull} onChange={(e) => set("groomFull", e.target.value)} /></Field>
        <Field label="Nama lengkap wanita"><input className="input" value={f.brideFull} onChange={(e) => set("brideFull", e.target.value)} /></Field>
        <Field label="Orang tua pria"><input className="input" value={f.groomParents} onChange={(e) => set("groomParents", e.target.value)} /></Field>
        <Field label="Orang tua wanita"><input className="input" value={f.brideParents} onChange={(e) => set("brideParents", e.target.value)} /></Field>
        <Field label="Zona waktu"><select className="input" value={f.timezone} onChange={(e) => set("timezone", e.target.value as "WIB")}><option>WIB</option><option>WITA</option><option>WIT</option></select></Field>
        <Field label="Bahasa undangan"><select className="input" value={f.language} onChange={(e) => set("language", e.target.value as "id")}><option value="id">Indonesia</option><option value="en">English</option></select></Field>
      </section>

      <section className="card space-y-3" aria-label="Acara">
        <div className="flex justify-between"><h2 className="font-semibold">Rangkaian acara</h2><button className="btn btn-sm" onClick={() => set("subEvents", [...f.subEvents, emptySub()])}>+ Acara</button></div>
        {f.subEvents.map((x, i) => (
          <div key={i} className="grid sm:grid-cols-3 gap-x-3 border-t pt-2" style={{ borderColor: "var(--app-border)" }}>
            <Field label="Nama acara"><input className="input" value={x.name} onChange={(e) => upd("subEvents", i, { name: e.target.value })} /></Field>
            <Field label="Tanggal"><input type="date" className="input" value={x.date} onChange={(e) => upd("subEvents", i, { date: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Mulai"><input type="time" className="input" value={x.time} onChange={(e) => upd("subEvents", i, { time: e.target.value })} /></Field><Field label="Selesai"><input type="time" className="input" value={x.endTime} onChange={(e) => upd("subEvents", i, { endTime: e.target.value })} /></Field></div>
            <Field label="Lokasi"><input className="input" value={x.venue} onChange={(e) => upd("subEvents", i, { venue: e.target.value })} /></Field>
            <Field label="Alamat"><input className="input" value={x.address} onChange={(e) => upd("subEvents", i, { address: e.target.value })} /></Field>
            <Field label="Link Google Maps"><input className="input" placeholder="https://…" value={x.mapsUrl} onChange={(e) => upd("subEvents", i, { mapsUrl: e.target.value })} /></Field>
            <Field label="Dress code"><input className="input" value={x.dressCode} onChange={(e) => upd("subEvents", i, { dressCode: e.target.value })} /></Field>
            <Field label="Link live streaming"><input className="input" placeholder="https://youtube.com/…" value={x.streamingUrl} onChange={(e) => upd("subEvents", i, { streamingUrl: e.target.value })} /></Field>
            <div className="flex items-end"><button className="btn btn-sm btn-danger" onClick={() => confirm("Hapus acara ini beserta RSVP-nya?") && del("subEvents", i)}>Hapus acara</button></div>
          </div>
        ))}
      </section>

      <section className="card space-y-2" aria-label="PIC">
        <div className="flex justify-between"><h2 className="font-semibold">PIC (tombol WhatsApp)</h2><button className="btn btn-sm" onClick={() => set("pics", [...f.pics, { name: "", phone: "", role: "" }])}>+ PIC</button></div>
        {f.pics.map((p, i) => (<div key={i} className="grid sm:grid-cols-4 gap-2 items-end"><Field label="Nama"><input className="input" value={p.name} onChange={(e) => upd("pics", i, { name: e.target.value })} /></Field><Field label="WhatsApp"><input className="input" value={p.phone} onChange={(e) => upd("pics", i, { phone: e.target.value })} /></Field><Field label="Peran"><input className="input" value={p.role} onChange={(e) => upd("pics", i, { role: e.target.value })} /></Field><button className="btn btn-sm btn-danger" onClick={() => del("pics", i)}>Hapus</button></div>))}
      </section>

      <section className="card space-y-2" aria-label="Hadiah">
        <div className="flex justify-between"><h2 className="font-semibold">Amplop digital</h2><button className="btn btn-sm" onClick={() => set("gifts", [...f.gifts, { type: "BANK", provider: "", accountNumber: "", accountName: "" }])}>+ Rekening</button></div>
        {f.gifts.map((g, i) => (<div key={i} className="grid sm:grid-cols-5 gap-2 items-end"><Field label="Tipe"><select className="input" value={g.type} onChange={(e) => upd("gifts", i, { type: e.target.value as "BANK" })}><option>BANK</option><option>EWALLET</option><option>QRIS</option></select></Field><Field label="Bank/E-wallet"><input className="input" value={g.provider} onChange={(e) => upd("gifts", i, { provider: e.target.value })} /></Field><Field label="No. rekening"><input className="input" value={g.accountNumber} onChange={(e) => upd("gifts", i, { accountNumber: e.target.value })} /></Field><Field label="Atas nama"><input className="input" value={g.accountName} onChange={(e) => upd("gifts", i, { accountName: e.target.value })} /></Field><button className="btn btn-sm btn-danger" onClick={() => del("gifts", i)}>Hapus</button></div>))}
        <div className="flex justify-between pt-2"><h3 className="font-medium">Wishlist kado</h3><button className="btn btn-sm" onClick={() => set("wishlist", [...f.wishlist, { name: "" }])}>+ Item</button></div>
        {f.wishlist.map((w, i) => (<div key={i} className="flex gap-2"><input aria-label="Item wishlist" className="input" value={w.name} onChange={(e) => upd("wishlist", i, { name: e.target.value })} /><button className="btn btn-sm btn-danger" onClick={() => del("wishlist", i)}>✕</button></div>))}
        <div className="flex justify-between pt-2"><h3 className="font-medium">Pilihan menu katering</h3><button className="btn btn-sm" onClick={() => set("menus", [...f.menus, { name: "" }])}>+ Menu</button></div>
        {f.menus.map((m, i) => (<div key={i} className="flex gap-2"><input aria-label="Nama menu" className="input" value={m.name} onChange={(e) => upd("menus", i, { name: e.target.value })} /><button className="btn btn-sm btn-danger" onClick={() => del("menus", i)}>✕</button></div>))}
      </section>

      <section className="card grid sm:grid-cols-2 gap-x-3" aria-label="Proteksi dan privasi">
        <h2 className="font-semibold sm:col-span-2">Publikasi, proteksi & privasi</h2>
        <Field label="Status"><select className="input" value={f.status} onChange={(e) => set("status", e.target.value as "DRAFT")}><option value="DRAFT">Draft (tersembunyi)</option><option value="PUBLISHED">Terbit</option><option value="ARCHIVED">Arsip pasca-acara</option></select></Field>
        <Field label="Moderasi ucapan"><select className="input" value={f.wishPolicy} onChange={(e) => set("wishPolicy", e.target.value as "AUTO")}><option value="AUTO">Otomatis setujui yang bersih</option><option value="MANUAL">Semua perlu persetujuan manual</option></select></Field>
        <Field label="Kata sandi undangan (kosongkan = tanpa sandi; isi untuk mengganti)"><input type="password" className="input" autoComplete="new-password" placeholder="••••••" onChange={(e) => set("password", e.target.value)} /></Field>
        <div className="flex items-end"><button className="btn btn-sm" onClick={() => set("password", "")}>Hapus kata sandi</button></div>
        <Field label="Masa aktif sampai"><input type="date" className="input" value={f.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} /></Field>
        <Field label="Retensi data tamu (hari pasca-acara, lalu dianonimkan)"><input type="number" min={1} className="input" value={f.retentionDays} onChange={(e) => set("retentionDays", Number(e.target.value))} /></Field>
        <label className="flex gap-2 items-center mt-3 sm:col-span-2"><input type="checkbox" checked={f.noindex} onChange={(e) => set("noindex", e.target.checked)} /> Sembunyikan dari mesin pencari (noindex)</label>
      </section>

      <section className="card space-y-2" style={{ borderColor: "var(--app-danger)" }} aria-label="Zona bahaya">
        <h2 className="font-semibold">Hak data pribadi (UU PDP)</h2>
        <div className="flex flex-wrap gap-2">
          <a className="btn" href={`/api/export/all.json?eventId=${eventId}`}>Ekspor semua data</a>
          <button className="btn" onClick={async () => { if (!confirm("Anonimkan semua data pribadi tamu sekarang? Tidak bisa dibatalkan.")) return; const r = await anonymizeNow(eventId); show(r.ok ? `${r.data.count} tamu dianonimkan` : r.error); router.refresh(); }}>Anonimkan data tamu sekarang</button>
        </div>
        <label className="label" htmlFor="dc">Hapus permanen undangan & seluruh data tamu. Ketik <b>{slug}</b> untuk konfirmasi:</label>
        <div className="flex gap-2"><input id="dc" className="input" value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} /><button className="btn btn-danger" disabled={confirmSlug !== slug} onClick={async () => { const r = await deleteEventPermanently(eventId, confirmSlug); if (r.ok) router.push("/onboarding"); else show(r.error); }}>Hapus permanen</button></div>
      </section>
    </div>
  );
}
