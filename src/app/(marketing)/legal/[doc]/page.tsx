import { notFound } from "next/navigation";

const DOCS: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: "Syarat & Ketentuan",
    body: [
      "WeddingOS menyediakan layanan pembuatan dan pengelolaan undangan pernikahan digital. Dengan menggunakan layanan ini Anda menyetujui syarat berikut.",
      "Anda bertanggung jawab atas keakuratan konten undangan dan atas izin tamu untuk dihubungi (termasuk pengiriman pesan WhatsApp massal). Penggunaan gateway tidak resmi memiliki risiko pemblokiran nomor yang ditanggung pengguna.",
      "Dilarang menggunakan layanan untuk spam, konten melanggar hukum, atau pelanggaran hak cipta. Kami dapat menangguhkan akun yang melanggar.",
      "Pembayaran paket bersifat final kecuali ditentukan lain oleh hukum. Fitur dibatasi sesuai paket yang aktif.",
      "Dokumen ini adalah templat awal dan perlu ditinjau konsultan hukum sebelum peluncuran komersial.",
    ],
  },
  privacy: {
    title: "Kebijakan Privasi (UU PDP)",
    body: [
      "Kami memproses data pengantin (akun, detail acara) dan data tamu (nama, telepon, email opsional, RSVP, alergi, ucapan) hanya untuk menyelenggarakan undangan.",
      "Pengantin bertindak sebagai pengendali data tamu; WeddingOS sebagai prosesor. Persetujuan tamu dicatat saat RSVP dan impor.",
      "Hak Anda: akses dan ekspor seluruh data, koreksi, penghapusan permanen, serta anonimisasi otomatis setelah masa retensi yang dapat diatur (bawaan 90 hari pasca-acara).",
      "Nomor telepon tidak dicatat dalam log aplikasi. Token tamu dibuat acak dan hanya berlaku untuk satu undangan.",
      "Dokumen ini adalah templat awal dan perlu ditinjau konsultan hukum sebelum peluncuran komersial. Kontak privasi: privacy@weddingos.example.",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = DOCS[doc];
  if (!d) notFound();
  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-4">
      <h1 className="font-display text-4xl">{d.title}</h1>
      {d.body.map((p, i) => <p key={i} className="muted leading-relaxed">{p}</p>)}
    </main>
  );
}
