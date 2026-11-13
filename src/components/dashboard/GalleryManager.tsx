"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteGalleryPhoto, moveGalleryPhoto, uploadGalleryPhoto } from "@/app/actions/media";
import { Empty, useToast } from "./ui";

async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")?.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.85));
    return blob ? new File([blob], "foto.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function GalleryManager({ eventId, photos, limit }: { eventId: string; photos: { id: string }[]; limit: number }) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [, start] = useTransition();
  const [busy, setBusy] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files);
    let okCount = 0;
    for (let i = 0; i < list.length; i++) {
      setBusy(`Mengunggah ${i + 1} dari ${list.length}…`);
      const small = await shrink(list[i]!);
      const fd = new FormData();
      fd.set("file", small);
      const r = await uploadGalleryPhoto(eventId, fd);
      if (r.ok) okCount++;
      else { show(r.error); break; }
    }
    setBusy("");
    if (input.current) input.current.value = "";
    if (okCount) show(`${okCount} foto berhasil diunggah`);
    start(() => router.refresh());
  };
  const remove = async (id: string) => {
    if (!confirm("Hapus foto ini?")) return;
    const r = await deleteGalleryPhoto(eventId, id);
    show(r.ok ? "Foto dihapus" : r.error);
    start(() => router.refresh());
  };
  const move = async (id: string, dir: -1 | 1) => {
    const r = await moveGalleryPhoto(eventId, id, dir);
    if (!r.ok) show(r.error);
    start(() => router.refresh());
  };

  return (
    <div className="space-y-4">
      {toast}
      <h1 className="font-display text-2xl">Galeri Foto</h1>
      <div className="card space-y-2">
        <p className="text-sm muted">Foto di sini tampil di bagian Galeri pada undangan. Foto otomatis dikecilkan agar cepat dibuka di HP tamu. Format JPEG, PNG, atau WebP. Maksimal {limit} foto ({photos.length} terpakai).</p>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="input" aria-label="Pilih foto" disabled={!!busy || photos.length >= limit} onChange={(e) => void upload(e.target.files)} />
        {busy && <p className="text-sm" role="status">{busy}</p>}
      </div>
      <div className="card">
        {photos.length === 0 ? <Empty icon="🖼️" title="Belum ada foto" hint="Selama kosong, undangan menampilkan ilustrasi contoh." /> : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((p, i) => (
              <li key={p.id} className="space-y-1">
                <div className="aspect-square overflow-hidden rounded-xl" style={{ background: "var(--app-border)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/media/${p.id}`} alt={`Foto ${i + 1}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div className="flex gap-1 justify-between">
                  <button className="btn btn-sm" disabled={i === 0} onClick={() => void move(p.id, -1)} aria-label="Geser ke kiri">←</button>
                  <button className="btn btn-sm" disabled={i === photos.length - 1} onClick={() => void move(p.id, 1)} aria-label="Geser ke kanan">→</button>
                  <button className="btn btn-sm btn-danger" onClick={() => void remove(p.id)}>Hapus</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
