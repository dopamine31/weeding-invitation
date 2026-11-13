import { z } from "zod";

export const SECTION_TYPES = ["couple", "date", "events", "story", "gallery", "live", "dress", "customary", "gift", "rsvp", "wish", "seating"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_LABELS: Record<SectionType, string> = {
  couple: "Mempelai & Orang Tua",
  date: "Save the Date & Countdown",
  events: "Rangkaian Acara & Peta",
  story: "Love Story",
  gallery: "Galeri Foto",
  live: "Live Streaming",
  dress: "Dress Code",
  customary: "Pantangan Adat",
  gift: "Amplop Digital & Wishlist",
  rsvp: "RSVP",
  wish: "Wedding Wish",
  seating: "Pencarian Meja",
};

export const FONT_CHOICES = {
  playfair: { label: "Playfair Display", css: "var(--f-playfair), Georgia, serif" },
  cormorant: { label: "Cormorant Garamond", css: "var(--f-cormorant), Georgia, serif" },
  dmserif: { label: "DM Serif Display", css: "var(--f-dmserif), Georgia, serif" },
  cinzel: { label: "Cinzel", css: "var(--f-cinzel), Georgia, serif" },
  lora: { label: "Lora", css: "var(--f-lora), Georgia, serif" },
  anton: { label: "Anton", css: "var(--f-anton), Impact, sans-serif" },
  amiri: { label: "Amiri", css: "var(--f-amiri), Georgia, serif" },
  cormorantsc: { label: "Cormorant SC", css: "var(--f-cormorantsc), Georgia, serif" },
} as const;
export type FontKey = keyof typeof FONT_CHOICES;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const configSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  theme: z
    .object({
      bg: hex.optional(),
      surface: hex.optional(),
      text: hex.optional(),
      muted: hex.optional(),
      accent: hex.optional(),
      accentText: hex.optional(),
      displayFont: z.enum(Object.keys(FONT_CHOICES) as [FontKey, ...FontKey[]]).optional(),
      radius: z.number().min(0).max(40).optional(),
    })
    .default({}),
  sections: z.array(z.object({ type: z.enum(SECTION_TYPES), visible: z.boolean() })).max(30).default([]),
  texts: z
    .object({
      quote: z.string().max(400).default(""),
      quoteSource: z.string().max(120).default(""),
      greeting: z.string().max(600).default(""),
      thanks: z.string().max(400).default(""),
      dressNote: z.string().max(200).default(""),
      customary: z.array(z.string().max(160)).max(10).default([]),
      dressColors: z.array(hex).max(6).default([]),
      loveStory: z.array(z.object({ date: z.string().max(30), title: z.string().max(80), text: z.string().max(400) })).max(8).default([]),
      music: z.enum(["ambient", "off"]).default("ambient"),
    })
    .default({
      quote: "",
      quoteSource: "",
      greeting: "",
      thanks: "",
      dressNote: "",
      customary: [],
      dressColors: [],
      loveStory: [],
      music: "ambient",
    }),
});

export type InvitationConfig = z.infer<typeof configSchema>;

export const DEFAULT_SECTIONS = SECTION_TYPES.map((type) => ({ type, visible: !["live", "customary"].includes(type) }));

/** Versioned migration: accepts any stored JSON and returns a valid, complete config. */
export function migrateConfig(raw: unknown): InvitationConfig {
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const withVersion = { ...obj, schemaVersion: 1 };
  const parsed = configSchema.safeParse(withVersion);
  const cfg = parsed.success ? parsed.data : configSchema.parse({ schemaVersion: 1 });
  // make sure every section type exists exactly once, preserving order
  const seen = new Set<string>();
  const sections = cfg.sections.filter((s) => (seen.has(s.type) ? false : (seen.add(s.type), true)));
  for (const d of DEFAULT_SECTIONS) if (!seen.has(d.type)) sections.push(d);
  return { ...cfg, sections };
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (h: string) => {
    const n = [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * (n[0] as number) + 0.7152 * (n[1] as number) + 0.0722 * (n[2] as number);
  };
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
