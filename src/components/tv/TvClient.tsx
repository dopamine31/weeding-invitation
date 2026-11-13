"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArtPhoto } from "@/components/invitation/Ornaments";

interface Wish { id: string; name: string; message: string; pinned: boolean }
interface Payload { wishes: Wish[]; arrivals: { id: string; name: string }[] }
interface Theme { bg: string; text: string; accent: string; muted: string }

export function TvClient({ eventId, tvKey, title, inviteUrl, targetIso, theme }: { eventId: string; tvKey: string; title: string; inviteUrl: string; targetIso: string | null; theme: Theme }) {
  const [data, setData] = useState<Payload>({ wishes: [], arrivals: [] });
  const [live, setLive] = useState(false);
  const [i, setI] = useState(0);
  const [welcome, setWelcome] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [now, setNow] = useState(0);
  const [panel, setPanel] = useState(false);
  const [cfg, setCfg] = useState({ interval: 8, wishes: true, gallery: true, countdown: true, qr: true });
  const seen = useRef(new Set<string>());
  const first = useRef(true);

  useEffect(() => { void QRCode.toDataURL(inviteUrl, { margin: 1, width: 260 }).then(setQr); }, [inviteUrl]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let retry = 1000;
    let timer: number | undefined;
    const connect = () => {
      es = new EventSource(`/api/tv/${eventId}/stream?key=${encodeURIComponent(tvKey)}`);
      es.onopen = () => { setLive(true); retry = 1000; };
      es.onmessage = (e) => {
        const p = JSON.parse(e.data) as Payload;
        setData(p);
        for (const a of p.arrivals) {
          if (!seen.current.has(a.id)) { seen.current.add(a.id); if (!first.current) { setWelcome(a.name); window.setTimeout(() => setWelcome(null), 6000); } }
        }
        first.current = false;
      };
      es.onerror = () => { setLive(false); es?.close(); timer = window.setTimeout(connect, retry); retry = Math.min(retry * 2, 20000); };
    };
    connect();
    return () => { es?.close(); window.clearTimeout(timer); };
  }, [eventId, tvKey]);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const req = async () => { try { lock = await (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null; } catch { /* not allowed */ } };
    void req();
    const vis = () => document.visibilityState === "visible" && void req();
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); void lock?.release(); };
  }, []);

  const slides = useMemo(() => {
    const out: { kind: "wish" | "photo"; w?: Wish; n?: number }[] = [];
    const w = cfg.wishes ? data.wishes : [];
    const photos = cfg.gallery ? [1, 2, 3, 4] : [];
    const max = Math.max(w.length, photos.length);
    for (let k = 0; k < max; k++) { if (w[k]) out.push({ kind: "wish", w: w[k] }); if (photos[k % (photos.length || 1)] && photos.length && k < photos.length) out.push({ kind: "photo", n: photos[k] }); }
    return out;
  }, [data.wishes, cfg.wishes, cfg.gallery]);
  useEffect(() => { const t = setInterval(() => setI((x) => x + 1), cfg.interval * 1000); return () => clearInterval(t); }, [cfg.interval]);
  const slide = slides.length ? slides[i % slides.length] : undefined;
  const left = targetIso && now ? Math.max(0, new Date(targetIso).getTime() - now) : 0;

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: theme.bg, color: theme.text, cursor: "none" }} onDoubleClick={() => setPanel((p) => !p)}>
      <style>{`@keyframes tvin{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}} @media (prefers-reduced-motion: reduce){.tvs{animation:none!important}}`}</style>
      <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start">
        <h1 className="font-display text-4xl" style={{ color: theme.accent }}>{title}</h1>
        <span className="text-sm" style={{ color: theme.muted }} aria-live="polite">{live ? "● Live" : "Menyambung…"}</span>
      </header>
      <main className="absolute inset-0 grid place-items-center px-24">
        {slide?.kind === "wish" && slide.w && (
          <figure key={slide.w.id + i} className="tvs text-center max-w-4xl" style={{ animation: "tvin 1s ease both" }}>
            <blockquote className="font-display text-5xl leading-tight">“{slide.w.message}”</blockquote>
            <figcaption className="mt-6 text-2xl" style={{ color: theme.accent }}>{slide.w.pinned ? "📌 " : ""}{slide.w.name}</figcaption>
          </figure>
        )}
        {slide?.kind === "photo" && <div key={`p${i}`} className="tvs h-[70vh] aspect-[4/5] rounded-2xl overflow-hidden" style={{ animation: "tvin 1s ease both" }}><ArtPhoto seed={(slide.n ?? 1) + 2} /></div>}
        {!slide && <p className="font-display text-4xl" style={{ color: theme.muted }}>Kirim ucapan Anda lewat QR di bawah</p>}
      </main>
      <footer className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
        {cfg.countdown && targetIso ? <div className="font-display text-3xl tabular-nums" style={{ color: theme.accent }}>{Math.floor(left / 86400000)}h {String(Math.floor(left / 3600000) % 24).padStart(2, "0")}:{String(Math.floor(left / 60000) % 60).padStart(2, "0")}:{String(Math.floor(left / 1000) % 60).padStart(2, "0")}</div> : <span />}
        {cfg.qr && qr && (<div className="text-center text-sm" style={{ color: theme.muted }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={qr} alt="QR undangan" width={130} height={130} className="bg-white p-2 rounded-lg mb-1" />Kirim ucapan</div>)}
      </footer>
      {welcome && <div role="status" aria-live="assertive" className="absolute inset-0 grid place-items-center" style={{ background: "rgba(0,0,0,.65)" }}><div className="text-center tvs" style={{ animation: "tvin .6s ease both" }}><p className="text-3xl" style={{ color: theme.accent }}>Selamat datang</p><p className="font-display text-7xl mt-3 text-white">{welcome}</p></div></div>}
      {panel && (
        <div className="absolute top-20 right-6 card space-y-2" style={{ cursor: "default", background: "var(--app-card)", color: "var(--app-fg)" }}>
          <b>Pengaturan TV</b>
          <label className="block text-sm">Interval {cfg.interval} dtk<input type="range" min={4} max={20} value={cfg.interval} onChange={(e) => setCfg({ ...cfg, interval: Number(e.target.value) })} className="w-full" /></label>
          {(["wishes", "gallery", "countdown", "qr"] as const).map((k) => <label key={k} className="flex gap-2 text-sm"><input type="checkbox" checked={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.checked })} /> {k === "wishes" ? "Ucapan" : k === "gallery" ? "Foto" : k === "countdown" ? "Countdown" : "QR"}</label>)}
          <button className="btn btn-sm" onClick={() => setPanel(false)}>Tutup (klik 2× layar)</button>
        </div>
      )}
    </div>
  );
}
