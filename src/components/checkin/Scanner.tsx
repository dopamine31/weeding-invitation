"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

interface Manifest {
  eventId: string; title: string; generatedAt: string;
  subEvents: { id: string; name: string }[];
  guests: { id: string; name: string; vip: boolean; notes: string; table: string | null; qr: Record<string, string>; rsvp: Record<string, { status: string; pax: number; allergy: string }> }[];
  checkedIn: { guestId: string; subEventId: string; at: string; gate: string }[];
}
interface QueuedScan { clientEventId: string; qr?: string; guestId?: string; subEventId?: string; walkInName?: string; scannedAt: number; gate: string; source: "ONLINE" | "OFFLINE_SYNC" | "MANUAL" }
interface Result { status: "OK" | "DUPLICATE" | "INVALID"; name?: string; table?: string | null; pax?: number; vip?: boolean; notes?: string; allergy?: string; reason?: string; first?: { at: string; gate: string }; offline?: boolean }

const nowMs = () => Date.now();
/* minimal IndexedDB wrapper */
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open("wos-checkin", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("kv"); r.result.createObjectStore("queue", { keyPath: "clientEventId" }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = async <T,>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await idb();
  return new Promise((res, rej) => { const q = fn(db.transaction(store, mode).objectStore(store)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function Scanner({ eventId, gateDefault }: { eventId: string; gateDefault: string }) {
  const [m, setM] = useState<Manifest | null>(null);
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [res, setRes] = useState<Result | null>(null);
  const [cam, setCam] = useState(false);
  const [torch, setTorch] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [sub, setSub] = useState("");
  const [gate, setGate] = useState(gateDefault);
  const [q, setQ] = useState("");
  const [walk, setWalk] = useState("");
  const [err, setErr] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const last = useRef({ code: "", at: 0 });
  const mRef = useRef<Manifest | null>(null);
  useEffect(() => { mRef.current = m; }, [m]);

  const beep = (ok: boolean) => {
    navigator.vibrate?.(ok ? 80 : [120, 60, 120]);
    try { const c = new AudioContext(); const o = c.createOscillator(); o.frequency.value = ok ? 880 : 220; o.connect(c.destination); o.start(); o.stop(c.currentTime + 0.12); } catch { /* audio blocked */ }
  };
  const refreshQueue = useCallback(async () => setQueued(await tx<number>("queue", "readonly", (s) => s.count())), []);

  const loadManifest = useCallback(async () => {
    try {
      const r = await fetch(`/api/checkin/${eventId}/manifest`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const mf = (await r.json()) as Manifest;
      await tx("kv", "readwrite", (s) => s.put(mf, `manifest:${eventId}`));
      setM(mf);
      setSub((s) => s || mf.subEvents[mf.subEvents.length - 1]?.id || "");
    } catch {
      const cached = await tx<Manifest | undefined>("kv", "readonly", (s) => s.get(`manifest:${eventId}`));
      if (cached) { setM(cached); setSub((s) => s || cached.subEvents[cached.subEvents.length - 1]?.id || ""); } else setErr("Tidak ada data offline. Hubungkan internet sekali untuk mengunduh daftar tamu.");
    }
  }, [eventId]);

  const flush = useCallback(async () => {
    if (!navigator.onLine) return;
    const items = await tx<QueuedScan[]>("queue", "readonly", (s) => s.getAll());
    if (!items.length) return;
    try {
      const r = await fetch(`/api/checkin/${eventId}/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scans: items.map((i) => ({ ...i, source: "OFFLINE_SYNC" })) }) });
      if (!r.ok) return;
      const out = (await r.json()) as { results: { clientEventId: string }[] };
      for (const x of out.results) await tx("queue", "readwrite", (s) => s.delete(x.clientEventId));
      await refreshQueue();
      await loadManifest();
    } catch { /* stay queued; retry on next online event */ }
  }, [eventId, refreshQueue, loadManifest]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with browser connectivity after hydration
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); void flush(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const onMsg = (e: MessageEvent) => { if (e.data === "flush-checkin") void flush(); };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    navigator.serviceWorker?.register("/sw.js").catch(() => undefined);
    void loadManifest().then(refreshQueue).then(flush);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); navigator.serviceWorker?.removeEventListener("message", onMsg); };
  }, [flush, loadManifest, refreshQueue]);

  const submit = useCallback(async (scan: QueuedScan, local: Result) => {
    if (navigator.onLine) {
      try {
        const r = await fetch(`/api/checkin/${eventId}/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scans: [scan] }) });
        if (r.ok) {
          const out = (await r.json()) as { results: (Result & { clientEventId: string })[] };
          const s = out.results[0];
          if (s) { setRes(s); beep(s.status === "OK"); void loadManifest(); return; }
        }
      } catch { /* fall through to offline queue */ }
    }
    if (local.status === "OK" || local.status === "DUPLICATE") {
      if (local.status === "OK") {
        await tx("queue", "readwrite", (s) => s.put(scan));
        await refreshQueue();
        const reg = await navigator.serviceWorker?.ready.catch(() => undefined);
        (reg as unknown as { sync?: { register: (t: string) => Promise<void> } } | undefined)?.sync?.register("checkin-sync").catch(() => undefined);
        setM((cur) => cur && scan.guestId && scan.subEventId ? { ...cur, checkedIn: [...cur.checkedIn, { guestId: scan.guestId, subEventId: scan.subEventId, at: new Date(scan.scannedAt).toISOString(), gate: scan.gate }] } : cur);
      }
    }
    setRes({ ...local, offline: true });
    beep(local.status === "OK");
  }, [eventId, loadManifest, refreshQueue]);

  const handleCode = useCallback((code: string) => {
    const now = Date.now();
    if (code === last.current.code && now - last.current.at < 2500) return;
    last.current = { code, at: now };
    const mf = mRef.current;
    if (!mf) { setRes({ status: "INVALID", reason: "Data tamu belum dimuat" }); return; }
    const g = mf.guests.find((x) => Object.values(x.qr).includes(code));
    const subId = g ? Object.keys(g.qr).find((k) => g.qr[k] === code) : undefined;
    if (!g || !subId) { setRes({ status: "INVALID", reason: "QR tidak dikenali / HMAC salah" }); beep(false); return; }
    const prior = mf.checkedIn.filter((c) => c.guestId === g.id && c.subEventId === subId).sort((a, b) => a.at.localeCompare(b.at))[0];
    const info = { name: g.name, table: g.table, pax: g.rsvp[subId]?.pax || 1, vip: g.vip, notes: g.notes, allergy: g.rsvp[subId]?.allergy ?? "" };
    const scan: QueuedScan = { clientEventId: uid(), qr: code, scannedAt: nowMs(), gate, source: navigator.onLine ? "ONLINE" : "OFFLINE_SYNC" };
    void submit(scan, prior ? { status: "DUPLICATE", ...info, first: { at: prior.at, gate: prior.gate } } : { status: "OK", ...info });
  }, [gate, submit]);

  /* camera */
  useEffect(() => {
    if (!cam) return;
    let stop = false;
    let raf = 0;
    const canvas = document.createElement("canvas");
    const Det = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    const detector = Det ? new Det({ formats: ["qr_code"] }) : null;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stop) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        const caps = (s.getVideoTracks()[0]?.getCapabilities?.() ?? {}) as { torch?: boolean };
        setCanTorch(!!caps.torch);
        const v = video.current;
        if (!v) return;
        v.srcObject = s;
        await v.play();
        let lastTick = 0;
        const loop = async (t: number) => {
          if (stop) return;
          if (t - lastTick > 120 && v.readyState >= 2) {
            lastTick = t;
            try {
              if (detector) { const f = await detector.detect(v); if (f[0]) handleCode(f[0].rawValue); }
              else {
                canvas.width = v.videoWidth; canvas.height = v.videoHeight;
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                if (ctx) { ctx.drawImage(v, 0, 0); const img = ctx.getImageData(0, 0, canvas.width, canvas.height); const c = jsQR(img.data, img.width, img.height); if (c) handleCode(c.data); }
              }
            } catch { /* frame decode failed, try next */ }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch { setErr("Kamera tidak dapat diakses. Izinkan kamera atau gunakan pencarian manual."); setCam(false); }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  }, [cam, handleCode]);

  const toggleTorch = async () => {
    const tr = stream.current?.getVideoTracks()[0];
    try { await tr?.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }); setTorch(!torch); } catch { setErr("Senter tidak didukung perangkat ini."); }
  };
  const manual = (gid: string) => {
    const g = m?.guests.find((x) => x.id === gid);
    if (!g || !sub) return;
    const prior = m?.checkedIn.filter((c) => c.guestId === g.id && c.subEventId === sub).sort((a, b) => a.at.localeCompare(b.at))[0];
    const info = { name: g.name, table: g.table, pax: g.rsvp[sub]?.pax || 1, vip: g.vip, notes: g.notes, allergy: g.rsvp[sub]?.allergy ?? "" };
    void submit({ clientEventId: uid(), guestId: g.id, subEventId: sub, scannedAt: nowMs(), gate, source: "MANUAL" }, prior ? { status: "DUPLICATE", ...info, first: { at: prior.at, gate: prior.gate } } : { status: "OK", ...info });
  };
  const addWalkIn = () => {
    if (!walk.trim()) return;
    void submit({ clientEventId: uid(), walkInName: walk.trim(), subEventId: sub || undefined, scannedAt: nowMs(), gate, source: "MANUAL" }, { status: "OK", name: walk.trim(), pax: 1, table: null });
    setWalk("");
  };

  const found = q.trim().length >= 2 ? (m?.guests.filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) ?? []) : [];
  const tone = res?.status === "OK" ? "#1f7a4d" : res?.status === "DUPLICATE" ? "#b26a00" : "#b3261e";
  return (
    <div className="max-w-lg mx-auto p-3 space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div><h1 className="font-display text-xl">{m?.title ?? "Check-in"}</h1><p className="text-xs muted">{m ? `${m.guests.length} tamu · data ${new Date(m.generatedAt).toLocaleTimeString("id-ID")}` : "Memuat…"}</p></div>
        <div className="text-right text-xs space-y-1" aria-live="polite"><span className={`badge ${online ? "badge-ok" : "badge-bad"}`}>{online ? "Online" : "Offline"}</span><br /><span className="badge">Antrian: {queued}</span></div>
      </header>
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Acara" className="input" value={sub} onChange={(e) => setSub(e.target.value)}>{m?.subEvents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input aria-label="Gate" className="input" value={gate} maxLength={30} onChange={(e) => setGate(e.target.value)} />
      </div>
      <div className="card p-2">
        {cam ? <video ref={video} playsInline muted className="w-full rounded-lg bg-black" style={{ aspectRatio: "4/3", objectFit: "cover" }} aria-label="Pemindai kamera" /> : <div className="grid place-items-center muted text-sm" style={{ aspectRatio: "4/3" }}>Kamera mati</div>}
        <div className="flex gap-2 mt-2"><button className="btn btn-primary flex-1" onClick={() => setCam((c) => !c)}>{cam ? "Matikan kamera" : "Aktifkan kamera"}</button>{cam && canTorch && <button className="btn" onClick={toggleTorch} aria-pressed={torch}>🔦</button>}{queued > 0 && online && <button className="btn" onClick={() => void flush()}>Sinkron</button>}</div>
      </div>
      <div role="status" aria-live="assertive" className="rounded-2xl p-4 text-white text-center min-h-28" style={{ background: res ? tone : "var(--app-card)", color: res ? "#fff" : "var(--app-muted)", border: res ? 0 : "1px dashed var(--app-border)" }}>
        {!res ? "Arahkan kamera ke QR tamu" : (
          <>
            <div className="text-3xl font-bold">{res.status === "OK" ? "✅ Selamat datang" : res.status === "DUPLICATE" ? "⚠️ Sudah check-in" : "❌ Tidak valid"}</div>
            {res.name && <div className="text-2xl mt-1">{res.name} {res.vip && "⭐ VIP"}</div>}
            {res.status !== "INVALID" && <div className="mt-1">Meja <b>{res.table ?? "-"}</b> · {res.pax ?? 1} pax{res.offline ? " · (offline, menunggu sinkron)" : ""}</div>}
            {res.allergy && <div className="mt-1 bg-white/20 rounded-lg p-1">⚠ Alergi: {res.allergy}</div>}
            {res.notes && <div className="mt-1 text-sm">Catatan: {res.notes}</div>}
            {res.first && <div className="mt-1 text-sm">Pertama: {new Date(res.first.at).toLocaleTimeString("id-ID")} di {res.first.gate}</div>}
            {res.reason && <div className="mt-1">{res.reason}</div>}
          </>
        )}
      </div>
      <p role="alert" className="text-sm" style={{ color: "var(--app-danger)" }}>{err}</p>
      <section className="card">
        <h2 className="font-semibold text-sm mb-1">Cari manual</h2>
        <input aria-label="Cari nama tamu" className="input" placeholder="Ketik nama…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-2 space-y-1">{found.map((g) => <li key={g.id} className="flex justify-between items-center gap-2 text-sm"><span className="truncate">{g.name} <span className="muted">· meja {g.table ?? "-"}</span></span><button className="btn btn-sm" onClick={() => manual(g.id)}>Check-in</button></li>)}</ul>
        <h2 className="font-semibold text-sm mt-3 mb-1">Tamu walk-in</h2>
        <div className="flex gap-2"><input aria-label="Nama walk-in" className="input" placeholder="Nama tamu" value={walk} onChange={(e) => setWalk(e.target.value)} maxLength={80} /><button className="btn" onClick={addWalkIn}>Tambah</button></div>
      </section>
    </div>
  );
}

export function PinForm({ eventId }: { eventId: string }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  return (
    <main className="min-h-screen grid place-items-center p-4">
      <form className="card w-full max-w-xs space-y-2" onSubmit={async (e) => { e.preventDefault(); const r = await fetch(`/api/checkin/${eventId}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) }); if (r.ok) location.reload(); else setErr(((await r.json()) as { error?: string }).error ?? "Gagal"); }}>
        <h1 className="font-display text-xl">Check-in staf</h1>
        <label className="label" htmlFor="pin">PIN dari pengantin</label>
        <input id="pin" inputMode="numeric" autoComplete="one-time-code" className="input" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} />
        <p role="alert" className="text-sm" style={{ color: "var(--app-danger)" }}>{err}</p>
        <button className="btn btn-primary w-full">Masuk</button>
      </form>
    </main>
  );
}
