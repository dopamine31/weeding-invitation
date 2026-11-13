export const KNOWN_VARS = [
  "nama",
  "link",
  "pic_nama",
  "pic_wa",
  "nama_mempelai",
  "tanggal",
  "lokasi",
  "meja",
] as const;

export type TemplateVars = Partial<Record<(typeof KNOWN_VARS)[number], string>>;

export function extractVars(template: string): string[] {
  const out = new Set<string>();
  for (const m of template.matchAll(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g)) if (m[1]) out.add(m[1]);
  return [...out];
}

export function validateTemplate(template: string): { ok: boolean; unknown: string[]; length: number } {
  const unknown = extractVars(template).filter((v) => !(KNOWN_VARS as readonly string[]).includes(v));
  return { ok: unknown.length === 0 && template.trim().length > 0, unknown, length: template.length };
}

/** Resolve `{a|b|c}` groups (supports nesting) using the supplied rng. */
export function resolveSpintax(template: string, rng: () => number = Math.random): string {
  let out = template;
  const re = /\{([^{}]*\|[^{}]*)\}/;
  for (let i = 0; i < 200 && re.test(out); i++) {
    out = out.replace(re, (_m, inner: string) => {
      const options = inner.split("|");
      return options[Math.min(options.length - 1, Math.floor(rng() * options.length))] ?? "";
    });
  }
  return out;
}

export function renderTemplate(template: string, vars: TemplateVars, rng: () => number = Math.random): string {
  const spun = resolveSpintax(template, rng);
  return spun.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, key: string) => {
    if (!(KNOWN_VARS as readonly string[]).includes(key)) return m;
    return vars[key as keyof TemplateVars] ?? "";
  });
}

/** Deterministic rng for tests / previews. */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
