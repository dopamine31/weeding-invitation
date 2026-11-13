"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArtPhoto, Dust } from "./Ornaments";
import type { Labels } from "@/lib/i18n";
import { claimWishlist, submitRsvp, submitWish } from "@/app/i/[slug]/actions";

/* ---------- Reveal on scroll ---------- */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); } }),
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`rv ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/* ---------- Shell: cover, music, floating buttons ---------- */
export interface ShellProps {
  tpl: string;
  cover: ReactNode;
  halves: boolean;
  withDust: boolean;
  names: [string, string];
  dateLabel: string;
  toName: string;
  kicker: string;
  dear: string;
  openLabel: string;
  hint: string;
  coverCta: string;
  pics: { name: string; href: string }[];
  music: boolean;
  labels: Labels;
  children: ReactNode;
}

function startAmbient(): { ctx: AudioContext; stop: () => void } | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.05;
    master.connect(ctx.destination);
    const nodes: OscillatorNode[] = [];
    [130.81, 196.0, 261.63, 329.63].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.value = 0.25;
      lfo.frequency.value = 0.07 + i * 0.03;
      lg.gain.value = 0.2;
      lfo.connect(lg);
      lg.connect(g.gain);
      o.connect(g);
      g.connect(master);
      o.start();
      lfo.start();
      nodes.push(o, lfo);
    });
    return { ctx, stop: () => nodes.forEach((n) => n.stop()) };
  } catch {
    return null;
  }
}

export function Shell(p: ShellProps) {
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [picMenu, setPicMenu] = useState(false);
  const audio = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);
  const bg = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = gone ? "" : "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [gone]);

  const doOpen = () => {
    setOpen(true);
    if (p.music && !audio.current) {
      audio.current = startAmbient();
      setPlaying(!!audio.current);
    }
    window.setTimeout(() => { setGone(true); document.getElementById("sec-first")?.scrollIntoView({ behavior: "smooth" }); }, 1500);
  };

  const toggleMusic = async () => {
    const a = audio.current ?? (audio.current = startAmbient());
    if (!a) return;
    if (a.ctx.state === "running") { await a.ctx.suspend(); setPlaying(false); } else { await a.ctx.resume(); setPlaying(true); }
  };

  const onMove = (e: React.PointerEvent) => {
    if (!bg.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const x = (e.clientX / window.innerWidth - 0.5) * 14;
    const y = (e.clientY / window.innerHeight - 0.5) * 14;
    bg.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.04)`;
  };

  return (
    <>
      {!gone && (
        <div className={`cover ${open ? "is-open" : ""}`} data-tpl={p.tpl} onPointerMove={onMove} role="dialog" aria-label={p.openLabel}>
          {p.halves ? (
            <div className="cover-halves" aria-hidden><div className="l">{p.cover}</div><div className="r">{p.cover}</div></div>
          ) : (
            <div className="cover-bg" ref={bg} style={{ transition: "transform .3s ease-out" }}>{p.cover}</div>
          )}
          {p.withDust && <div className="cover-bg" style={{ zIndex: 1 }} aria-hidden><Dust /></div>}
          <div className="cover-content">
            <p className="cover-kicker">{p.kicker}</p>
            <h1 className="cover-names">{p.names[0]} <i>&amp;</i> {p.names[1]}</h1>
            <p className="cover-date">{p.dateLabel}</p>
            <div className="cover-guest"><small>{p.dear}</small><strong>{p.toName}</strong></div>
            <button className="cover-btn" onClick={doOpen} autoFocus>{p.coverCta}</button>
            <p className="cover-pic">{p.hint}</p>
          </div>
        </div>
      )}
      {p.children}
      {gone && p.music && (
        <button className="fab fab-music" onClick={toggleMusic} aria-label={playing ? p.labels.mute : p.labels.unmute} aria-pressed={playing}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            {playing ? <path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6" />}
          </svg>
        </button>
      )}
      {gone && p.pics.length > 0 && (
        <>
          {p.pics.length === 1 ? (
            <a className="fab fab-wa" href={(p.pics[0] as { href: string }).href} target="_blank" rel="noopener noreferrer" aria-label={`${p.labels.contact} ${(p.pics[0] as { name: string }).name}`}><WaIcon /></a>
          ) : (
            <>
              <button className="fab fab-wa" onClick={() => setPicMenu((v) => !v)} aria-expanded={picMenu} aria-label={p.labels.contact}><WaIcon /></button>
              {picMenu && <div className="pic-pop">{p.pics.map((x) => <a key={x.href} href={x.href} target="_blank" rel="noopener noreferrer">{x.name}</a>)}</div>}
            </>
          )}
        </>
      )}
    </>
  );
}

function WaIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.1.1.6-.1 1.1z" /></svg>;
}

/* ---------- Countdown ---------- */
export function Countdown({ target, labels }: { target: string; labels: Labels }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const t = new Date(target).getTime();
    const tick = () => setLeft(Math.max(0, t - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);
  const v = left ?? 0;
  const parts: [number, string][] = [[Math.floor(v / 86400000), labels.days], [Math.floor(v / 3600000) % 24, labels.hours], [Math.floor(v / 60000) % 60, labels.minutes], [Math.floor(v / 1000) % 60, labels.seconds]];
  return (
    <div className="cd" role="timer" aria-label="Countdown">
      {parts.map(([n, l]) => <div key={l}><b>{left === null ? "--" : String(n).padStart(2, "0")}</b><span>{l}</span></div>)}
    </div>
  );
}

/* ---------- Copy / claim ---------- */
export function CopyButton({ text, labels }: { text: string; labels: Labels }) {
  const [done, setDone] = useState(false);
  return (
    <button className="inv-btn inv-btn--ghost" onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked: fall back to selection prompt */ window.prompt("Salin:", text); }
      setDone(true);
      window.setTimeout(() => setDone(false), 1800);
    }} aria-live="polite">{done ? labels.copied : labels.copy}</button>
  );
}

export function ClaimButton({ slug, itemId, claimedBy, labels, readOnly, defaultName }: { slug: string; itemId: string; claimedBy: string | null; labels: Labels; readOnly: boolean; defaultName: string }) {
  const [claimed, setClaimed] = useState(!!claimedBy);
  if (claimed) return <span className="inv-p" style={{ margin: 0 }}>✓ {labels.claimed}</span>;
  return (
    <button className="inv-btn inv-btn--ghost" disabled={readOnly} onClick={async () => {
      const r = await claimWishlist({ slug, itemId, name: defaultName });
      if (r.ok) setClaimed(true);
    }}>{labels.claim}</button>
  );
}

/* ---------- RSVP ---------- */
export interface RsvpProps {
  slug: string;
  token: string | null;
  guestName: string;
  maxPax: number;
  subEvents: { id: string; name: string }[];
  menus: { id: string; name: string }[];
  existing: { subEventId: string; status: string; pax: number; menuId: string | null; allergy: string }[];
  qr: Record<string, string>;
  labels: Labels;
  readOnly: boolean;
}

export function RsvpForm(p: RsvpProps) {
  const [sub, setSub] = useState(p.subEvents[0]?.id ?? "");
  const ex = p.existing.find((e) => e.subEventId === sub);
  const [status, setStatus] = useState(ex?.status ?? "attending");
  const [pax, setPax] = useState(ex?.pax || 1);
  const [name, setName] = useState(p.token ? p.guestName : "");
  const [menu, setMenu] = useState(ex?.menuId ?? "");
  const [allergy, setAllergy] = useState(ex?.allergy ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [qr, setQr] = useState<Record<string, string>>(p.qr);
  const [token, setToken] = useState(p.token);
  const loaded = useRef(0);
  useEffect(() => { loaded.current = Date.now(); }, []);

  const pick = (id: string) => {
    setSub(id);
    const e = p.existing.find((x) => x.subEventId === id);
    if (e) { setStatus(e.status); setPax(e.pax || 1); setMenu(e.menuId ?? ""); setAllergy(e.allergy); }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg(null);
    const r = await submitRsvp({ slug: p.slug, token, name, subEventId: sub, status: status as "attending", pax, menuId: menu || null, allergy, hp: String(fd.get("website") ?? ""), elapsed: Date.now() - loaded.current });
    setBusy(false);
    if (r.ok) {
      setToken(r.data.token);
      if (r.data.qr) setQr((q) => ({ ...q, [sub]: r.data.qr as string }));
      setMsg({ ok: true, text: p.labels.thanksRsvp });
    } else setMsg({ ok: false, text: r.error });
  };

  const maxPax = Math.max(1, p.maxPax);
  return (
    <form onSubmit={onSubmit} className="inv-card" style={{ textAlign: "left" }} aria-busy={busy}>
      {p.readOnly && <p className="inv-p" role="note">{p.labels.preview}</p>}
      {!p.token && (<><label className="inv-label" htmlFor="rs-name">{p.labels.yourName}</label><input id="rs-name" className="inv-input" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></>)}
      {p.subEvents.length > 1 && (<><label className="inv-label" htmlFor="rs-sub">{p.labels.events}</label><select id="rs-sub" className="inv-input" value={sub} onChange={(e) => pick(e.target.value)}>{p.subEvents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></>)}
      <fieldset style={{ border: 0, padding: 0, margin: "14px 0 0" }}>
        <legend className="inv-label">{p.labels.rsvp}</legend>
        {(["attending", "declined", "maybe"] as const).map((s) => (
          <label key={s} style={{ display: "inline-flex", gap: 6, marginRight: 14, minHeight: 36, alignItems: "center" }}>
            <input type="radio" name="status" checked={status === s} onChange={() => setStatus(s)} /> {s === "attending" ? p.labels.attend : s === "declined" ? p.labels.decline : p.labels.maybe}
          </label>
        ))}
      </fieldset>
      {status === "attending" && (
        <>
          <label className="inv-label" htmlFor="rs-pax">{p.labels.pax}</label>
          <select id="rs-pax" className="inv-input" value={pax} onChange={(e) => setPax(Number(e.target.value))}>{Array.from({ length: maxPax }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
          {p.menus.length > 0 && (<><label className="inv-label" htmlFor="rs-menu">{p.labels.menu}</label><select id="rs-menu" className="inv-input" value={menu} onChange={(e) => setMenu(e.target.value)}><option value="">-</option>{p.menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></>)}
          <label className="inv-label" htmlFor="rs-al">{p.labels.allergy}</label>
          <input id="rs-al" className="inv-input" maxLength={160} value={allergy} onChange={(e) => setAllergy(e.target.value)} />
        </>
      )}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
      <div className="inv-row"><button className="inv-btn" disabled={busy || p.readOnly}>{busy ? "…" : p.labels.send}</button></div>
      <div aria-live="polite" role="status" style={{ marginTop: 12, textAlign: "center", color: msg?.ok ? "var(--accent-text)" : "#b3261e" }}>{msg?.text}</div>
      {status === "attending" && qr[sub] && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <p className="inv-eyebrow">{p.labels.ticket}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr[sub]} alt="QR check-in" width={200} height={200} style={{ background: "#fff", padding: 8, borderRadius: 8 }} />
          <div className="inv-row"><a className="inv-btn inv-btn--ghost" href={qr[sub]} download="tiket-qr.png">PNG</a></div>
        </div>
      )}
    </form>
  );
}

/* ---------- Wishes ---------- */
export interface WishItem { id: string; name: string; message: string; reply: string | null; pinned: boolean }

export function WishBoard({ slug, token, guestName, initial, labels, readOnly }: { slug: string; token: string | null; guestName: string; initial: WishItem[]; labels: Labels; readOnly: boolean }) {
  const [items, setItems] = useState(initial);
  const [name, setName] = useState(guestName);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const loaded = useRef(0);
  useEffect(() => { loaded.current = Date.now(); }, []);

  const refresh = useCallback(async () => {
    if (readOnly) return;
    try {
      const r = await fetch(`/api/public/${encodeURIComponent(slug)}/wishes`, { cache: "no-store" });
      if (r.ok) setItems((await r.json()) as WishItem[]);
    } catch { /* offline: keep current list */ }
  }, [slug, readOnly]);
  useEffect(() => {
    const id = window.setInterval(refresh, 10000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const r = await submitWish({ slug, token, name, message: text, hp: String(fd.get("website") ?? ""), elapsed: Date.now() - loaded.current });
    setBusy(false);
    if (r.ok) { setMsg(r.data.status === "APPROVED" ? labels.wishSent : labels.wishPending); setText(""); void refresh(); } else setMsg(r.error);
  };

  return (
    <>
      <div className="wl" aria-live="polite">
        {items.map((w) => (
          <div key={w.id}>
            <b>{w.pinned ? "📌 " : ""}{w.name}</b>
            <p>{w.message}</p>
            {w.reply && <em>↳ {w.reply}</em>}
          </div>
        ))}
      </div>
      <form onSubmit={onSubmit} className="inv-card" style={{ textAlign: "left" }}>
        <label className="inv-label" htmlFor="w-name">{labels.name}</label>
        <input id="w-name" className="inv-input" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <label className="inv-label" htmlFor="w-msg">{labels.message} <span style={{ float: "right" }}>{text.length}/300</span></label>
        <textarea id="w-msg" className="inv-input" required maxLength={300} rows={4} placeholder={labels.wishPh} value={text} onChange={(e) => setText(e.target.value)} />
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
        <div className="inv-row"><button className="inv-btn" disabled={busy || readOnly}>{labels.send}</button></div>
        <p role="status" aria-live="polite" className="inv-p" style={{ textAlign: "center", marginTop: 10 }}>{readOnly ? labels.preview : msg}</p>
      </form>
    </>
  );
}

/* ---------- Table search ---------- */
export function TableSearch({ slug, labels, readOnly }: { slug: string; labels: Labels; readOnly: boolean }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ name: string; table: string | null }[] | null>(null);
  const active = q.trim().length >= 3 && !readOnly;
  useEffect(() => {
    if (q.trim().length < 3 || readOnly) return;
    const id = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/public/${encodeURIComponent(slug)}/seat?q=${encodeURIComponent(q.trim())}`);
        setRes(r.ok ? ((await r.json()) as { name: string; table: string | null }[]) : []);
      } catch { setRes([]); }
    }, 350);
    return () => window.clearTimeout(id);
  }, [q, slug, readOnly]);
  return (
    <div className="inv-card" style={{ textAlign: "left" }}>
      <label className="inv-label" htmlFor="seat-q">{labels.seating}</label>
      <input id="seat-q" className="inv-input" placeholder={labels.seatPh} value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} disabled={readOnly} />
      <div aria-live="polite" style={{ marginTop: 12 }}>
        {active && res && res.length === 0 && <p className="inv-p">{labels.noResult}</p>}
        {active && res?.map((r, i) => <p key={i} className="inv-p" style={{ color: "var(--text)" }}><b>{r.name}</b> {r.table ? <>{labels.seatAt} <b style={{ color: "var(--accent-text)", fontSize: "1.3em" }}>{r.table}</b></> : "–"}</p>)}
      </div>
    </div>
  );
}

/* ---------- Gallery + lightbox ---------- */
export function Gallery({ count, labels, photos = [] }: { count: number; labels: Labels; photos?: { id: string }[] }) {
  const total = photos.length || count;
  const pic = (i: number, alt: string, big = false) => photos.length ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/media/${photos[i]!.id}`} alt={alt} loading={big ? "eager" : "lazy"} style={big ? { maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain" } : { width: "100%", height: "100%", objectFit: "cover" }} />
  ) : <ArtPhoto seed={i + 2} label={alt} />;
  const [idx, setIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  const startX = useRef(0);
  const go = useCallback((d: number) => { setZoom(false); setIdx((i) => (i === null ? i : (i + d + total) % total)); }, [total]);
  useEffect(() => {
    if (idx === null) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setIdx(null); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [idx, go]);
  return (
    <>
      <div className="gal">
        {Array.from({ length: total }, (_, i) => (
          <button key={i} onClick={() => setIdx(i)} aria-label={`${labels.gallery} ${i + 1}`}>{pic(i, `${labels.gallery} ${i + 1}`)}</button>
        ))}
      </div>
      {idx !== null && (
        <div className="lb" role="dialog" aria-modal="true" aria-label={labels.gallery}
          onPointerDown={(e) => { startX.current = e.clientX; }}
          onPointerUp={(e) => { const dx = e.clientX - startX.current; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); }}>
          <div style={{ transform: zoom ? "scale(1.8)" : "none", cursor: zoom ? "zoom-out" : "zoom-in" }} onClick={() => setZoom((z) => !z)}>{pic(idx, labels.gallery, true)}</div>
          <button style={{ top: 16, right: 16 }} onClick={() => setIdx(null)} aria-label="Close" autoFocus>×</button>
          <button style={{ left: 12, top: "50%" }} onClick={() => go(-1)} aria-label="Previous">‹</button>
          <button style={{ right: 12, top: "50%" }} onClick={() => go(1)} aria-label="Next">›</button>
        </div>
      )}
    </>
  );
}

/* ---------- Streaming facade ---------- */
export function StreamFacade({ url, label }: { url: string; label: string }) {
  const [on, setOn] = useState(false);
  const yt = /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([\w-]{6,})/.exec(url)?.[1];
  if (!yt) return <a className="inv-btn" href={url} target="_blank" rel="noopener noreferrer">{label}</a>;
  return on ? (
    <iframe title={label} src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1`} style={{ width: "100%", aspectRatio: "16/9", border: 0 }} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
  ) : (
    <button className="inv-btn" onClick={() => setOn(true)} style={{ width: "100%", aspectRatio: "16/9", fontSize: "1rem" }}>▶ {label}</button>
  );
}
