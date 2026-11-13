import Papa from "papaparse";
import { normalizePhone } from "./phone";

export type Field = "name" | "phone" | "email" | "group" | "category" | "maxPax" | "notes";
export const FIELDS: { key: Field; label: string; required?: boolean }[] = [
  { key: "name", label: "Nama", required: true },
  { key: "phone", label: "Telepon / WhatsApp" },
  { key: "email", label: "Email" },
  { key: "group", label: "Grup" },
  { key: "category", label: "Kategori" },
  { key: "maxPax", label: "Maks. Pax" },
  { key: "notes", label: "Catatan" },
];

const SYNONYMS: Record<Field, string[]> = {
  name: ["nama", "name", "nama tamu", "guest", "guest name", "tamu", "full name"],
  phone: ["telepon", "telp", "phone", "hp", "no hp", "nomor hp", "whatsapp", "wa", "no wa", "mobile", "nomor telepon"],
  email: ["email", "e-mail", "surel"],
  group: ["grup", "group", "kelompok", "keluarga"],
  category: ["kategori", "category", "tipe", "type"],
  maxPax: ["pax", "max pax", "maxpax", "jumlah", "jumlah tamu", "maks pax", "qty"],
  notes: ["catatan", "notes", "note", "keterangan", "memo"],
};

export type Mapping = Partial<Record<Field, number>>;

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

export function parseTable(text: string): ParsedTable {
  const clean = text.replace(/^\uFEFF/, "");
  const res = Papa.parse<string[]>(clean, { skipEmptyLines: "greedy", delimitersToGuess: [",", ";", "\t", "|"] });
  const data = res.data.filter((r) => Array.isArray(r));
  const headers = (data[0] ?? []).map((h) => String(h ?? "").trim());
  return { headers, rows: data.slice(1).map((r) => r.map((c) => String(c ?? "").trim())), delimiter: res.meta.delimiter };
}

export function suggestMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<number>();
  (Object.keys(SYNONYMS) as Field[]).forEach((field) => {
    const idx = headers.findIndex((h, i) => !used.has(i) && SYNONYMS[field].includes(h.trim().toLowerCase()));
    if (idx >= 0) {
      mapping[field] = idx;
      used.add(idx);
    }
  });
  return mapping;
}

export function normName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(bapak|bpk|ibu|bu|mr|mrs|ms|dr|drs|ir|hj|h|kak|mas|mbak|sdr|sdri)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = ` ${s} `;
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

function dice(a: Map<string, number>, b: Map<string, number>): number {
  let inter = 0;
  let sa = 0;
  let sb = 0;
  for (const v of a.values()) sa += v;
  for (const v of b.values()) sb += v;
  for (const [k, v] of a) inter += Math.min(v, b.get(k) ?? 0);
  return sa + sb === 0 ? 0 : (2 * inter) / (sa + sb);
}

export function similarity(a: string, b: string): number {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return dice(bigrams(na), bigrams(nb));
}

export interface RowResult {
  index: number;
  data: { name: string; phone: string | null; email: string | null; group: string; category: string; maxPax: number; notes: string };
  errors: string[];
  duplicate?: { reason: "phone" | "name"; score: number; of: string; source: "existing" | "file" };
}

export function validateRows(rows: string[][], mapping: Mapping): RowResult[] {
  const get = (r: string[], f: Field) => (mapping[f] === undefined ? "" : (r[mapping[f] as number] ?? "").trim());
  return rows.map((r, i) => {
    const errors: string[] = [];
    const name = get(r, "name");
    if (!name) errors.push("Nama kosong");
    if (name.length > 120) errors.push("Nama terlalu panjang");
    const rawPhone = get(r, "phone");
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) errors.push(`Telepon tidak valid: ${rawPhone}`);
    const email = get(r, "email");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push(`Email tidak valid: ${email}`);
    const paxRaw = get(r, "maxPax");
    let maxPax = 2;
    if (paxRaw) {
      const n = Number.parseInt(paxRaw, 10);
      if (!Number.isFinite(n) || n < 1 || n > 20) errors.push(`Pax tidak valid: ${paxRaw}`);
      else maxPax = n;
    }
    const catRaw = get(r, "category").toUpperCase();
    const category = ["VIP", "FAMILY", "REGULAR"].includes(catRaw) ? catRaw : "REGULAR";
    return {
      index: i + 2,
      data: { name, phone, email: email || null, group: get(r, "group"), category, maxPax, notes: get(r, "notes") },
      errors,
    };
  });
}

export interface ExistingGuest {
  id: string;
  name: string;
  phone: string | null;
}

/** Marks duplicates by identical phone (existing + in-file) and fuzzy name similarity (>= threshold). */
export function detectDuplicates(results: RowResult[], existing: ExistingGuest[], threshold = 0.8): RowResult[] {
  const byPhone = new Map<string, string>();
  for (const e of existing) if (e.phone) byPhone.set(e.phone, e.name);
  const blocks = new Map<string, { name: string; map: Map<string, number>; norm: string; source: "existing" | "file" }[]>();
  const addBlock = (name: string, source: "existing" | "file") => {
    const norm = normName(name);
    if (!norm) return;
    const k = norm[0] as string;
    const arr = blocks.get(k) ?? [];
    arr.push({ name, norm, map: bigrams(norm), source });
    blocks.set(k, arr);
  };
  for (const e of existing) addBlock(e.name, "existing");
  const seenPhones = new Map<string, string>();
  for (const r of results) {
    if (r.errors.length) continue;
    const p = r.data.phone;
    if (p && byPhone.has(p)) {
      r.duplicate = { reason: "phone", score: 1, of: byPhone.get(p) as string, source: "existing" };
    } else if (p && seenPhones.has(p)) {
      r.duplicate = { reason: "phone", score: 1, of: seenPhones.get(p) as string, source: "file" };
    } else {
      const norm = normName(r.data.name);
      const cands = blocks.get(norm[0] ?? "") ?? [];
      const m = bigrams(norm);
      let best: { name: string; score: number; source: "existing" | "file" } | null = null;
      for (const c of cands) {
        if (Math.abs(c.norm.length - norm.length) > 4) continue;
        const score = c.norm === norm ? 1 : dice(m, c.map);
        if (score >= threshold && (!best || score > best.score)) best = { name: c.name, score, source: c.source };
      }
      if (best) r.duplicate = { reason: "name", score: Math.round(best.score * 100) / 100, of: best.name, source: best.source };
    }
    if (p) seenPhones.set(p, r.data.name);
    addBlock(r.data.name, "file");
  }
  return results;
}

export function failedRowsCsv(results: RowResult[]): string {
  const bad = results.filter((r) => r.errors.length);
  return Papa.unparse(
    bad.map((r) => ({ baris: r.index, nama: r.data.name, telepon: r.data.phone ?? "", error: r.errors.join("; ") })),
  );
}

export const CSV_TEMPLATE = "nama,telepon,email,grup,kategori,pax,catatan\nBudi Santoso,081234567890,budi@example.com,Keluarga,VIP,2,Paman\nSiti Aminah,+6281298765432,,Kantor,REGULAR,1,\n";
