"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function useToast(): [ReactNode, (m: string) => void] {
  const [msg, setMsg] = useState("");
  const t = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setMsg(""), 3500);
  }, []);
  return [msg ? <div key="toast" className="toast" role="status" aria-live="polite">{msg}</div> : <div key="toast" aria-live="polite" className="sr-only" />, show];
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h2 className="font-semibold text-lg">{title}</h2><button className="btn btn-sm" onClick={onClose} aria-label="Tutup">✕</button></div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ icon, title, hint, children }: { icon: string; title: string; hint: string; children?: ReactNode }) {
  return (
    <div className="card text-center py-10 space-y-2">
      <div className="text-4xl" aria-hidden>{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="muted text-sm max-w-sm mx-auto">{hint}</p>
      {children}
    </div>
  );
}

const NAV = [
  ["/dashboard", "Ringkasan", "📊"], ["/dashboard/guests", "Tamu", "👥"], ["/dashboard/wishes", "Ucapan", "💌"], ["/dashboard/seating", "Denah Meja", "🪑"],
  ["/dashboard/attendance", "Kehadiran", "✅"], ["/dashboard/gallery", "Galeri", "🖼️"], ["/dashboard/blast", "Blast WA", "📣"], ["/dashboard/export", "Ekspor", "📤"], ["/dashboard/settings", "Pengaturan", "⚙️"], ["/dashboard/billing", "Billing", "💳"],
] as const;

export function NavLinks({ eventId }: { eventId: string }) {
  const p = usePathname();
  return (
    <nav aria-label="Menu utama" className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1">
      {NAV.map(([href, label, icon]) => {
        const active = href === "/dashboard" ? p === href : p.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className="btn btn-sm whitespace-nowrap md:justify-start" style={active ? { background: "var(--app-accent)", color: "var(--app-accent-fg)", borderColor: "var(--app-accent)" } : { border: "0", background: "transparent" }}>
            <span aria-hidden>{icon}</span> {label}
          </Link>
        );
      })}
      <Link href={`/studio/${eventId}`} className="btn btn-sm whitespace-nowrap md:justify-start" style={{ border: 0, background: "transparent" }}><span aria-hidden>🎨</span> Studio</Link>
    </nav>
  );
}
