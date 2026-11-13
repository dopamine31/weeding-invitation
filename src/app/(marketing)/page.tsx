import Link from "next/link";
import { PhonePreview } from "@/components/marketing/PhonePreview";
import { TEMPLATES } from "@/templates";
import { PLAN_SEED } from "@/lib/billing";

const FEATURES: [string, string, string][] = [
  ["🎨", "8 template kelas premium", "Bukan sekadar ganti warna: tiap template punya cover, ornamen SVG, dan animasi sendiri."],
  ["📲", "RSVP, ucapan & moderasi", "Form RSVP per acara, ucapan dimoderasi otomatis (ID/EN, leet-speak, spam)."],
  ["📣", "Blast WhatsApp anti-banned", "Spintax, jeda acak, batas harian, jendela kirim, retry, dan tanpa pesan ganda."],
  ["🪑", "Denah meja & pencarian tamu", "Seret & lepas, auto-assign per grup, tamu mencari mejanya sendiri."],
  ["✅", "Check-in QR offline", "PWA scanner dengan HMAC, antrian offline & sinkron otomatis tanpa duplikat."],
  ["📺", "TV Mode & katering", "Layar proyektor realtime dan ekspor Catering Matrix siap kirim vendor."],
];
const FAQ: [string, string][] = [
  ["Apakah WhatsApp blast aman dari banned?", "Cloud API resmi Meta paling aman. Gateway tidak resmi berisiko; WeddingOS menyediakan throttling dan peringatan, namun risiko tetap ada."],
  ["Apakah data tamu aman?", "Ya. Telepon tidak masuk log, ada ekspor & hapus permanen, serta retensi otomatis sesuai UU PDP."],
  ["Bisa dipakai tanpa kartu kredit?", "Paket Free selamanya gratis. Pembayaran memakai Midtrans (atau simulasi di mode demo)."],
  ["Apakah check-in berfungsi tanpa sinyal?", "Ya. Daftar tamu diunduh ke perangkat, scan masuk antrian dan disinkronkan saat online."],
];

export default function Landing() {
  return (
    <main>
      <section className="max-w-6xl mx-auto px-4 pt-12 pb-10 grid lg:grid-cols-2 gap-10 items-center">
        <div className="space-y-5">
          <p className="badge">Undangan digital · Hari-H toolkit</p>
          <h1 className="font-display text-4xl sm:text-6xl leading-[1.05]">Undangan yang terasa <em>mewah</em>, hari-H yang berjalan mulus.</h1>
          <p className="muted text-lg max-w-xl">Dari desain, sebar, RSVP, sampai check-in & TV mode, dalam satu platform untuk pengantin. Terbitkan undangan dalam 3 menit.</p>
          <div className="flex gap-3 flex-wrap"><Link href="/register" className="btn btn-primary" style={{ minHeight: 48 }}>Mulai gratis</Link><Link href="/i/raka-anindya" className="btn" style={{ minHeight: 48 }}>Lihat undangan demo</Link><Link href="/login" className="btn" style={{ minHeight: 48 }}>Masuk demo</Link></div>
        </div>
        <PhonePreview initial="elegant-ivory" switcher />
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10" aria-labelledby="tpl"><h2 id="tpl" className="font-display text-3xl mb-6">Delapan template, delapan karakter</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TEMPLATES.map((t) => (
            <Link key={t.slug} href={`/templates/${t.slug}`} className="card p-3 block hover:-translate-y-1 transition-transform">
              <div className="rounded-lg aspect-[4/5] grid place-items-center text-center p-3" style={{ background: t.colors.bg, color: t.colors.text, border: `2px solid ${t.colors.accent}` }}>
                <div><div className="text-xs tracking-[.25em] uppercase" style={{ color: t.colors.accentText }}>The Wedding of</div><div className="text-2xl my-2" style={{ fontFamily: t.fonts.display, color: t.colors.text }}>Raka &amp; Anindya</div><div className="mx-auto h-px w-12" style={{ background: t.colors.accent }} /></div>
              </div>
              <p className="font-semibold mt-2">{t.name}</p><p className="muted text-xs">{t.tagline}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10" aria-labelledby="ft"><h2 id="ft" className="font-display text-3xl mb-6">Semua yang dibutuhkan pengantin</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{FEATURES.map(([i, t, d]) => <div key={t} className="card"><div className="text-3xl" aria-hidden>{i}</div><h3 className="font-semibold mt-2">{t}</h3><p className="muted text-sm mt-1">{d}</p></div>)}</div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10" aria-labelledby="pr"><h2 id="pr" className="font-display text-3xl mb-6">Harga</h2>
        <div className="grid md:grid-cols-3 gap-4">{PLAN_SEED.map((p) => <div key={p.id} className="card"><b>{p.name}</b><p className="text-3xl font-semibold my-2">{p.priceIdr ? `Rp ${p.priceIdr.toLocaleString("id-ID")}` : "Gratis"}</p><p className="muted text-sm">Hingga {p.guestLimit.toLocaleString("id-ID")} tamu · {p.blastLimit ? `${p.blastLimit.toLocaleString("id-ID")} blast WA` : "tanpa blast"} · {p.tvMode ? "TV Mode" : "tanpa TV"}</p></div>)}</div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10" aria-labelledby="ts"><h2 id="ts" className="font-display text-3xl mb-2">Testimoni</h2><p className="muted text-xs mb-4">Contoh testimoni untuk demo (bukan ulasan pelanggan nyata).</p>
        <div className="grid md:grid-cols-3 gap-4">{[["Raka & Anindya", "Undangan jadi dalam sepuluh menit, tamu kagum dengan animasi pembukanya."], ["Bima & Citra", "Check-in offline menyelamatkan kami di gedung tanpa sinyal."], ["Fajar & Gita", "Catering matrix langsung dipakai vendor tanpa revisi."]].map(([n, t]) => <figure key={n} className="card"><blockquote className="text-sm">“{t}”</blockquote><figcaption className="muted text-xs mt-2">{n}</figcaption></figure>)}</div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-10" aria-labelledby="fq"><h2 id="fq" className="font-display text-3xl mb-4">FAQ</h2>
        {FAQ.map(([q, a]) => <details key={q} className="card mb-2"><summary className="font-medium cursor-pointer">{q}</summary><p className="muted text-sm mt-2">{a}</p></details>)}
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10 text-center"><div className="card py-10 space-y-3"><h2 className="font-display text-3xl">Siap membuat undangan Anda?</h2><Link href="/register" className="btn btn-primary" style={{ minHeight: 48 }}>Mulai gratis</Link></div></section>
    </main>
  );
}
