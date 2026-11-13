import Link from "next/link";
import { PLAN_SEED } from "@/lib/billing";

export const metadata = { title: "Harga" };

export default function Pricing() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="font-display text-4xl mb-6">Harga sederhana</h1>
      <div className="grid md:grid-cols-3 gap-4">
        {PLAN_SEED.map((p) => (
          <div key={p.id} className="card space-y-2"><b>{p.name}</b><p className="text-3xl font-semibold">{p.priceIdr ? `Rp ${p.priceIdr.toLocaleString("id-ID")}` : "Gratis"}</p>
            <ul className="text-sm muted space-y-1"><li>Hingga {p.guestLimit.toLocaleString("id-ID")} tamu</li><li>{p.blastLimit ? `${p.blastLimit.toLocaleString("id-ID")} pesan blast WhatsApp` : "Tanpa blast WhatsApp"}</li><li>{p.tvMode ? "TV Mode & Live Guestbook" : "Tanpa TV Mode"}</li><li>{p.premiumTemplates ? "Semua template premium" : "3 template Free"}</li></ul>
            <Link href="/register" className="btn btn-primary w-full">Mulai</Link></div>
        ))}
      </div>
    </main>
  );
}
