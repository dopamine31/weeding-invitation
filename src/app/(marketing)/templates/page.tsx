import Link from "next/link";
import { TEMPLATES } from "@/templates";

export const metadata = { title: "Galeri Template" };

export default function TemplatesPage() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="font-display text-4xl mb-2">Galeri template</h1>
      <p className="muted mb-6">Setiap template punya cover, ornamen, tata letak, dan animasi khas. Semua dapat disesuaikan di Studio.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TEMPLATES.map((t) => (
          <Link key={t.slug} href={`/templates/${t.slug}`} className="card block hover:-translate-y-1 transition-transform">
            <div className="rounded-lg aspect-[4/5] grid place-items-center p-4 text-center" style={{ background: t.colors.bg, color: t.colors.text, border: `2px solid ${t.colors.accent}` }}>
              <div style={{ fontFamily: t.fonts.display }}><div className="text-3xl">Raka &amp; Anindya</div><div className="text-xs mt-2" style={{ color: t.colors.accentText }}>{t.name}</div></div>
            </div>
            <div className="flex justify-between items-center mt-2"><b>{t.name}</b><span className={`badge ${t.tier === "free" ? "badge-ok" : ""}`}>{t.tier === "free" ? "Free" : "Premium"}</span></div>
            <p className="muted text-xs">{t.tagline}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
