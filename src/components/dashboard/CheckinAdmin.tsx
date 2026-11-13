"use client";

import { useState } from "react";
import { resetStaffPin } from "@/app/actions/dashboard";
import { useToast } from "./ui";

export function CheckinAdmin({ eventId, staffUrl, tvUrl, hasPin, tvAllowed }: { eventId: string; staffUrl: string; tvUrl: string; hasPin: boolean; tvAllowed: boolean }) {
  const [pin, setPin] = useState<string | null>(null);
  const [toast, show] = useToast();
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); show("Tersalin"); } catch { show("Gagal menyalin"); } };
  return (
    <div className="space-y-4">
      {toast}
      <h1 className="font-display text-2xl">Check-in & TV Mode</h1>
      <section className="card space-y-2">
        <h2 className="font-semibold">Scanner staf (PWA offline)</h2>
        <p className="text-sm muted">Bagikan tautan dan PIN ke staf gerbang. Staf membuka tautan di HP/tablet, memasukkan PIN, lalu menambahkan ke layar utama. Daftar tamu diunduh ke perangkat sehingga scan tetap jalan tanpa sinyal.</p>
        <div className="flex gap-2 flex-wrap items-center"><code className="text-xs break-all">{staffUrl}</code><button className="btn btn-sm" onClick={() => copy(staffUrl)}>Salin</button><a className="btn btn-sm" href={staffUrl} target="_blank" rel="noreferrer">Buka</a></div>
        <div className="flex gap-2 items-center flex-wrap">
          <button className="btn btn-primary btn-sm" onClick={async () => { if (hasPin && !confirm("PIN lama akan tidak berlaku. Lanjut?")) return; const r = await resetStaffPin(eventId); if (r.ok) setPin(r.data.pin); else show(r.error); }}>{hasPin ? "Reset PIN" : "Buat PIN staf"}</button>
          {pin && <span className="badge badge-ok text-base" role="status">PIN: {pin} (catat sekarang)</span>}
          {!pin && hasPin && <span className="muted text-sm">PIN sudah dibuat (disimpan sebagai hash).</span>}
        </div>
      </section>
      <section className="card space-y-2">
        <h2 className="font-semibold">TV Mode & Live Guestbook</h2>
        {tvAllowed ? (
          <>
            <p className="text-sm muted">Buka di laptop/proyektor. Menampilkan slideshow, ucapan yang disetujui, sambutan saat tamu check-in, dan QR undangan.</p>
            <div className="flex gap-2 flex-wrap items-center"><code className="text-xs break-all">{tvUrl}</code><button className="btn btn-sm" onClick={() => copy(tvUrl)}>Salin</button><a className="btn btn-sm btn-primary" href={tvUrl} target="_blank" rel="noreferrer">Buka TV Mode</a></div>
          </>
        ) : <p className="text-sm">TV Mode tersedia di paket Premium ke atas. <a className="underline" href="/dashboard/billing">Upgrade</a></p>}
      </section>
    </div>
  );
}
