import Link from "next/link";
import { notFound } from "next/navigation";
import { PhonePreview } from "@/components/marketing/PhonePreview";
import { TEMPLATES } from "@/templates";

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }));
}

export default async function TemplateDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = TEMPLATES.find((x) => x.slug === slug);
  if (!t) notFound();
  return (
    <main className="max-w-5xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-10 items-start">
      <PhonePreview initial={t.slug} />
      <div className="space-y-4">
        <Link href="/templates" className="text-sm underline">← Semua template</Link>
        <h1 className="font-display text-4xl">{t.name}</h1>
        <p className="muted">{t.tagline}</p>
        <dl className="card text-sm space-y-2">
          <div><dt className="muted">Animasi khas</dt><dd>{t.motion}</dd></div>
          <div><dt className="muted">Ornamen</dt><dd>{t.ornaments}</dd></div>
          <div><dt className="muted">Palet</dt><dd className="flex gap-2 mt-1">{[t.colors.bg, t.colors.surface, t.colors.text, t.colors.accent, t.colors.accent2].map((c) => <span key={c} title={c} role="img" aria-label={c} className="inline-block w-8 h-8 rounded-full border" style={{ background: c, borderColor: "var(--app-border)" }} />)}</dd></div>
          <div><dt className="muted">Paket</dt><dd>{t.tier === "free" ? "Tersedia di Free" : "Premium ke atas"}</dd></div>
        </dl>
        <Link href="/register" className="btn btn-primary" style={{ minHeight: 48 }}>Pakai template ini</Link>
      </div>
    </main>
  );
}
