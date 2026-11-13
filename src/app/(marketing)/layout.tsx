import Link from "next/link";
import type { ReactNode } from "react";
import { fontVariables } from "@/components/invitation/fonts";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={fontVariables}>
      <header className="sticky top-0 z-30 backdrop-blur border-b" style={{ borderColor: "var(--app-border)", background: "color-mix(in srgb, var(--app-bg) 85%, transparent)" }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="font-display text-xl">WeddingOS</Link>
          <nav aria-label="Navigasi" className="flex items-center gap-1 text-sm">
            <Link className="btn btn-sm" style={{ border: 0, background: "transparent" }} href="/templates">Template</Link>
            <Link className="btn btn-sm hidden sm:inline-flex" style={{ border: 0, background: "transparent" }} href="/pricing">Harga</Link>
            <Link className="btn btn-sm" href="/login">Masuk</Link>
            <Link className="btn btn-sm btn-primary" href="/register">Mulai gratis</Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t mt-16 py-8 text-sm muted" style={{ borderColor: "var(--app-border)" }}>
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap justify-between gap-3"><span>© {new Date().getFullYear()} WeddingOS</span><span className="flex gap-4"><Link href="/legal/terms">Syarat</Link><Link href="/legal/privacy">Privasi</Link><Link href="/pricing">Harga</Link></span></div>
      </footer>
    </div>
  );
}
