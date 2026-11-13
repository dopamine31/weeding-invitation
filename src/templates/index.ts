export type TemplateKey = "elegant-ivory" | "modern-minimal" | "floral-botanical" | "adat-jawa" | "islamic-green" | "rustic" | "bold-editorial" | "luxe-gold-dark";

export interface TemplateDef {
  slug: TemplateKey;
  name: string;
  tagline: string;
  tier: "free" | "premium";
  dark: boolean;
  colors: { bg: string; surface: string; text: string; muted: string; accent: string; accentText: string; accent2: string; onAccent: string };
  fonts: { display: string; body: string; accent: string; script: string };
  layout: { align: "center" | "left"; photo: "arch" | "rect" | "oval" | "polaroid" | "mihrab" | "frame"; heading: "normal" | "caps" | "huge" };
  radius: number;
  coverCta: string;
  motion: string;
  ornaments: string;
  fontKeys: string[];
}

export const TEMPLATES: TemplateDef[] = [
  {
    slug: "elegant-ivory", name: "Elegant Ivory", tagline: "Simetris, bingkai garis tipis, foto berbentuk arch.", tier: "free", dark: false,
    colors: { bg: "#FAF6EE", surface: "#F1E8D6", text: "#2B2A28", muted: "#5E5A52", accent: "#B89B5E", accentText: "#7A6230", accent2: "#E7D9BF", onAccent: "#2B2A28" },
    fonts: { display: "var(--f-playfair), Georgia, serif", body: "var(--f-inter), system-ui, sans-serif", accent: "var(--f-cormorant), Georgia, serif", script: "var(--f-cormorant), Georgia, serif" },
    layout: { align: "center", photo: "arch", heading: "normal" }, radius: 2, coverCta: "Buka Undangan",
    motion: "Amplop terbuka lembut, fade-up + blur", ornaments: "Garis ganda, sudut berpita, monogram", fontKeys: ["playfair", "cormorant"],
  },
  {
    slug: "modern-minimal", name: "Modern Minimal", tagline: "Asimetris, grid ketat, angka tanggal raksasa.", tier: "free", dark: false,
    colors: { bg: "#FFFFFF", surface: "#EDEBE7", text: "#111111", muted: "#5C5A55", accent: "#E4572E", accentText: "#B8401F", accent2: "#EDEBE7", onAccent: "#FFFFFF" },
    fonts: { display: "var(--f-dmserif), Georgia, serif", body: "var(--f-dmsans), system-ui, sans-serif", accent: "var(--f-dmsans), system-ui, sans-serif", script: "var(--f-dmserif), Georgia, serif" },
    layout: { align: "left", photo: "rect", heading: "huge" }, radius: 0, coverCta: "Buka",
    motion: "Reveal clip-path, marquee teks, geser horizontal", ornaments: "Garis rambut, kotak, titik", fontKeys: ["dmserif", "dmsans"],
  },
  {
    slug: "floral-botanical", name: "Floral Botanical", tagline: "Organik, tanaman rambat tumbuh, kelopak berjatuhan.", tier: "premium", dark: false,
    colors: { bg: "#FBF7F2", surface: "#F6E6E3", text: "#344E41", muted: "#55645A", accent: "#A3B18A", accentText: "#4A5D3A", accent2: "#F2D7D5", onAccent: "#1F3328" },
    fonts: { display: "var(--f-cormorant), Georgia, serif", body: "var(--f-jost), system-ui, sans-serif", accent: "var(--f-jost), system-ui, sans-serif", script: "var(--f-pinyon), cursive" },
    layout: { align: "center", photo: "oval", heading: "normal" }, radius: 24, coverCta: "Buka Undangan",
    motion: "Vine pathLength draw, daun parallax, kelopak jatuh", ornaments: "Bunga, dedaunan, ranting, watercolor gradient", fontKeys: ["cormorant", "jost", "pinyon"],
  },
  {
    slug: "adat-jawa", name: "Adat Jawa", tagline: "Sakral-formal, gunungan wayang, kawung & parang.", tier: "premium", dark: false,
    colors: { bg: "#F3E6C8", surface: "#E9D6A9", text: "#1C1410", muted: "#5B3A29", accent: "#C8A24A", accentText: "#7A5A12", accent2: "#5B3A29", onAccent: "#1C1410" },
    fonts: { display: "var(--f-cormorantsc), Georgia, serif", body: "var(--f-playfair), Georgia, serif", accent: "var(--f-playfair), Georgia, serif", script: "var(--f-cormorantsc), Georgia, serif" },
    layout: { align: "center", photo: "frame", heading: "caps" }, radius: 4, coverCta: "Rawuh · Buka Undangan",
    motion: "Gunungan terbelah, kawung bergerak lambat, tirai", ornaments: "Kawung, parang, gunungan, sulur, mega mendung", fontKeys: ["cormorantsc", "playfair"],
  },
  {
    slug: "islamic-green", name: "Islamic Green", tagline: "Bismillah, mihrab arch, bintang 8 titik berputar.", tier: "premium", dark: false,
    colors: { bg: "#F8FAF5", surface: "#D1E7DD", text: "#0F5132", muted: "#3F5E4E", accent: "#C9A227", accentText: "#7A6210", accent2: "#0F5132", onAccent: "#0F2A1D" },
    fonts: { display: "var(--f-amiri), Georgia, serif", body: "var(--f-inter), system-ui, sans-serif", accent: "var(--f-amiri), Georgia, serif", script: "var(--f-amiri), Georgia, serif" },
    layout: { align: "center", photo: "mihrab", heading: "normal" }, radius: 6, coverCta: "Buka Undangan",
    motion: "Mihrab membuka, bintang berputar pelan, lentera berayun", ornaments: "Arabesque, pola bintang, kubah, bulan sabit", fontKeys: ["amiri", "scheherazade"],
  },
  {
    slug: "rustic", name: "Rustic", tagline: "Hangat, polaroid miring, catatan tulisan tangan.", tier: "free", dark: false,
    colors: { bg: "#F4ECE0", surface: "#E9D9C0", text: "#3F4A3C", muted: "#5C5446", accent: "#A65E3A", accentText: "#8F4A28", accent2: "#C8A27A", onAccent: "#FFFFFF" },
    fonts: { display: "var(--f-lora), Georgia, serif", body: "var(--f-lora), Georgia, serif", accent: "var(--f-amatic), cursive", script: "var(--f-caveat), cursive" },
    layout: { align: "center", photo: "polaroid", heading: "normal" }, radius: 4, coverCta: "Buka Undangan",
    motion: "Polaroid jatuh berotasi, ayunan tali, doodle menggambar", ornaments: "Tekstur kertas, tali goni, washi tape, doodle", fontKeys: ["lora", "caveat", "amatic"],
  },
  {
    slug: "bold-editorial", name: "Bold Editorial", tagline: "Sampul majalah: masthead, issue no., ticker.", tier: "premium", dark: false,
    colors: { bg: "#F2F0EB", surface: "#FFFFFF", text: "#0A0A0A", muted: "#55524C", accent: "#E63B2E", accentText: "#C4271B", accent2: "#0A0A0A", onAccent: "#FFFFFF" },
    fonts: { display: "var(--f-anton), Impact, sans-serif", body: "var(--f-inter), system-ui, sans-serif", accent: "var(--f-playfair), Georgia, serif", script: "var(--f-playfair), Georgia, serif" },
    layout: { align: "left", photo: "rect", heading: "huge" }, radius: 0, coverCta: "Read the Issue",
    motion: "Split-reveal teks raksasa, sticky stack, ticker berjalan", ornaments: "Barcode, nomor halaman, garis tebal, label EXCLUSIVE", fontKeys: ["anton", "playfair"],
  },
  {
    slug: "luxe-gold-dark", name: "Luxe Gold Dark", tagline: "Sinematik, tirai terbuka, foil emas shimmer.", tier: "premium", dark: true,
    colors: { bg: "#0B0B0D", surface: "#14141A", text: "#EDE6D6", muted: "#B8B0A0", accent: "#D4AF37", accentText: "#E3C25A", accent2: "#F7E7A1", onAccent: "#0B0B0D" },
    fonts: { display: "var(--f-cinzel), Georgia, serif", body: "var(--f-inter), system-ui, sans-serif", accent: "var(--f-cormorant), Georgia, serif", script: "var(--f-cormorant), Georgia, serif" },
    layout: { align: "center", photo: "frame", heading: "caps" }, radius: 0, coverCta: "Buka Tirai",
    motion: "Tirai terbuka, foil shimmer, debu emas", ornaments: "Garis emas, sudut art-deco, monogram, sunburst", fontKeys: ["cinzel", "cormorant"],
  },
];

export function getTemplate(slug: string): TemplateDef {
  return TEMPLATES.find((t) => t.slug === slug) ?? (TEMPLATES[0] as TemplateDef);
}
