export type Lang = "id" | "en";

const dict = {
  id: {
    guest: "Tamu Undangan", dear: "Kepada Yth.", open: "Buka Undangan", tapHint: "Ketuk untuk membuka", wedding: "The Wedding of",
    couple: "Mempelai", sonOf: "Putra dari", daughterOf: "Putri dari", date: "Save the Date", days: "Hari", hours: "Jam", minutes: "Menit", seconds: "Detik",
    addCal: "Simpan ke Kalender", googleCal: "Google Calendar", events: "Rangkaian Acara", maps: "Buka Maps", waze: "Waze", story: "Kisah Kami",
    gallery: "Galeri", live: "Live Streaming", watch: "Tonton Siaran", dress: "Dress Code", customary: "Pantangan Adat", gift: "Amplop Digital",
    copy: "Salin", copied: "Tersalin", wishlist: "Wishlist Kado", claim: "Tandai sudah dibeli", claimed: "Sudah dibeli", rsvp: "Konfirmasi Kehadiran",
    yourName: "Nama", attend: "Hadir", decline: "Tidak hadir", maybe: "Belum pasti", pax: "Jumlah tamu", menu: "Pilihan menu", allergy: "Alergi / diet (opsional)",
    send: "Kirim", thanksRsvp: "Terima kasih, konfirmasi Anda tercatat.", ticket: "Tiket QR Anda", wish: "Ucapan & Doa", wishPh: "Tulis ucapan Anda…",
    wishSent: "Terima kasih! Ucapan Anda terkirim.", wishPending: "Ucapan Anda menunggu persetujuan.", seating: "Cari Meja Anda", seatPh: "Ketik nama (min. 3 huruf)",
    seatAt: "duduk di Meja", noResult: "Tidak ditemukan", contact: "Hubungi", mute: "Matikan musik", unmute: "Nyalakan musik", archived: "Terima kasih atas doa dan kehadiran Anda.",
    expired: "Undangan ini telah berakhir.", locked: "Undangan ini dilindungi kata sandi.", password: "Kata sandi", unlock: "Buka", preview: "Mode pratinjau, formulir dinonaktifkan.",
    waText: "Halo, saya {name}. Saya ingin bertanya tentang acara {event}.", name: "Nama", message: "Pesan", reply: "Balasan", pinned: "Disematkan",
  },
  en: {
    guest: "Dear Guest", dear: "Dear", open: "Open Invitation", tapHint: "Tap to open", wedding: "The Wedding of",
    couple: "The Couple", sonOf: "Son of", daughterOf: "Daughter of", date: "Save the Date", days: "Days", hours: "Hours", minutes: "Minutes", seconds: "Seconds",
    addCal: "Add to Calendar", googleCal: "Google Calendar", events: "Schedule", maps: "Open Maps", waze: "Waze", story: "Our Story",
    gallery: "Gallery", live: "Live Stream", watch: "Watch Live", dress: "Dress Code", customary: "Customary Notes", gift: "Digital Gift",
    copy: "Copy", copied: "Copied", wishlist: "Gift Wishlist", claim: "Mark as bought", claimed: "Bought", rsvp: "RSVP",
    yourName: "Name", attend: "Attending", decline: "Declining", maybe: "Maybe", pax: "Number of guests", menu: "Menu choice", allergy: "Allergies / diet (optional)",
    send: "Send", thanksRsvp: "Thank you, your RSVP is saved.", ticket: "Your QR ticket", wish: "Wishes", wishPh: "Write your wishes…",
    wishSent: "Thank you! Your wish was sent.", wishPending: "Your wish is awaiting approval.", seating: "Find Your Table", seatPh: "Type a name (min. 3 letters)",
    seatAt: "is seated at Table", noResult: "No match", contact: "Contact", mute: "Mute music", unmute: "Play music", archived: "Thank you for your prayers and presence.",
    expired: "This invitation has ended.", locked: "This invitation is password protected.", password: "Password", unlock: "Unlock", preview: "Preview mode, forms are disabled.",
    waText: "Hi, I'm {name}. I have a question about {event}.", name: "Name", message: "Message", reply: "Reply", pinned: "Pinned",
  },
} as const;

export type DictKey = keyof (typeof dict)["id"];
export type Labels = Record<DictKey, string>;
export function dictFor(lang: string): Labels {
  return dict[lang === "en" ? "en" : "id"] as Labels;
}
export function makeT(lang: string): (k: DictKey) => string {
  const d = dict[lang === "en" ? "en" : "id"];
  return (k) => d[k];
}
