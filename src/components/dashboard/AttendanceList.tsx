"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSelfiePhoto } from "@/app/actions/media";

export interface AttendanceRow {
  id: string;
  name: string;
  rsvp: string;
  checkedInAt: string | null;
  selfieId: string | null;
}

const RSVP_LABEL: Record<string, string> = { attending: "Hadir", maybe: "Belum pasti", declined: "Tidak hadir", none: "-" };

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

export function AttendanceList({ eventId, rows }: { eventId: string; rows: AttendanceRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const hadir = rows.filter((r) => r.rsvp === "attending").length;
  const checked = rows.filter((r) => r.checkedInAt).length;
  const photos = rows.filter((r) => r.selfieId).length;

  const remove = (id: string) => {
    if (!confirm("Hapus foto selfie ini? Catatan check-in tamu tetap ada.")) return;
    setMsg("");
    start(async () => {
      const r = await deleteSelfiePhoto(eventId, id);
      if (!r.ok) setMsg(r.error);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Kehadiran</h1>
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg border border-white/10 px-3 py-2">RSVP Hadir: <b>{hadir}</b></span>
        <span className="rounded-lg border border-white/10 px-3 py-2">Sudah check-in: <b>{checked}</b></span>
        <span className="rounded-lg border border-white/10 px-3 py-2">Foto selfie: <b>{photos}</b></span>
      </div>
      {msg && <p role="alert" className="text-sm text-red-400">{msg}</p>}
      {rows.length === 0 ? (
        <p className="text-sm opacity-70">Belum ada tamu yang hadir atau check-in.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id} className="flex gap-3 rounded-xl border border-white/10 p-3">
              {r.selfieId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/${r.selfieId}`} alt={`Selfie ${r.name}`} width={72} height={72} loading="lazy" className="h-[72px] w-[72px] rounded-lg object-cover" />
              ) : (
                <div className="grid h-[72px] w-[72px] place-items-center rounded-lg bg-white/5 text-xs opacity-60">No foto</div>
              )}
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-medium">{r.name}</div>
                <div className="opacity-70">RSVP: {RSVP_LABEL[r.rsvp] ?? "-"}</div>
                <div className="opacity-70">{r.checkedInAt ? `Check-in ${fmt(r.checkedInAt)}` : "Belum check-in"}</div>
                {r.selfieId && (
                  <button type="button" disabled={pending} onClick={() => remove(r.selfieId as string)} className="mt-1 rounded-md border border-red-400/50 px-2 py-0.5 text-xs text-red-300 disabled:opacity-50">
                    Hapus foto
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
