import { PROFANITY } from "./moderation-words";

export type Decision = "APPROVED" | "PENDING" | "FLAGGED" | "REJECTED";
export type Policy = "AUTO" | "MANUAL";
export interface ModerationResult {
  decision: Decision;
  score: number;
  reasons: string[];
}

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i", "|": "i" };

export function collapse(s: string): string {
  return s.replace(/(.)\1+/g, "$1");
}

/** Lowercase, strip diacritics, undo leet-speak. Keeps `*` (mask wildcard) and spaces. */
export function normalizeText(input: string): string {
  const base = input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return [...base].map((c) => LEET[c] ?? c).join("");
}

const COLLAPSED = new Map<string, string>();
for (const w of PROFANITY) COLLAPSED.set(collapse(w), w);
const COLLAPSED_SET = new Set(COLLAPSED.keys());

function tokenIsProfane(tok: string): boolean {
  if (!tok) return false;
  const c = collapse(tok.replace(/[^a-z*]/g, ""));
  if (!c) return false;
  if (COLLAPSED_SET.has(c)) return true;
  if (c.includes("*")) {
    const re = new RegExp(`^${c.replace(/\*/g, "[a-z]?")}$`);
    for (const w of COLLAPSED_SET) if (w.length >= 4 && re.test(w)) return true;
  }
  return false;
}

export function countProfanity(text: string): number {
  const norm = normalizeText(text);
  let count = 0;
  // 1. word tokens
  const tokens = norm.split(/[^a-z*]+/).filter(Boolean);
  const used = new Set<number>();
  tokens.forEach((t, i) => {
    if (tokenIsProfane(t)) {
      count++;
      used.add(i);
    }
  });
  // 2. letters separated by symbols/spaces: "a n j i n g", "k.o.n.t.o.l"
  const spaced = norm.match(/(?:\b[a-z*][\s._\-*,]+){3,}[a-z*]\b/g) ?? [];
  for (const run of spaced) {
    const joined = run.replace(/[^a-z*]/g, "");
    if (tokenIsProfane(joined)) count++;
  }
  // 3. long words glued inside other text ("lukontolan"), only for words >= 5 letters
  const squashed = collapse(norm.replace(/[^a-z]/g, ""));
  if (count === 0) {
    for (const w of COLLAPSED_SET) {
      if (w.length >= 6 && squashed.includes(w)) {
        count++;
        break;
      }
    }
  }
  return count;
}

export function detectSpam(text: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|id|xyz|io|me|co|link|ly)\b)/i.test(text)) {
    score += 45;
    reasons.push("url");
  }
  if (/(\+?62|0)\s*8[\d\s\-.]{7,12}\d/.test(text)) {
    score += 35;
    reasons.push("phone");
  }
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  if ([...freq.values()].some((n) => n >= 4 && words.length >= 4)) {
    score += 25;
    reasons.push("repetition");
  }
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 12 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.7) {
    score += 15;
    reasons.push("caps");
  }
  return { score, reasons };
}

export function sanitizeText(input: string, max = 500): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
}

export function moderate(rawText: string, policy: Policy = "AUTO"): ModerationResult {
  const text = sanitizeText(rawText);
  const reasons: string[] = [];
  let score = 0;
  if (text.length < 2) return { decision: "REJECTED", score: 100, reasons: ["empty"] };
  const prof = countProfanity(text);
  if (prof > 0) {
    score += 70 + (prof - 1) * 25;
    reasons.push(`profanity:${prof}`);
  }
  const spam = detectSpam(text);
  score += spam.score;
  reasons.push(...spam.reasons);
  score = Math.min(100, score);
  let decision: Decision;
  if (score >= 90) decision = "REJECTED";
  else if (score >= 40) decision = "FLAGGED";
  else if (score > 0 || policy === "MANUAL") decision = "PENDING";
  else decision = "APPROVED";
  return { decision, score, reasons };
}

/** Optional LLM provider with rule-based fallback on failure or timeout. */
export interface ModerationProvider {
  moderate(text: string): Promise<ModerationResult>;
}

export async function moderateWithFallback(
  text: string,
  policy: Policy,
  provider?: ModerationProvider,
  timeoutMs = 2500,
): Promise<ModerationResult> {
  const rules = moderate(text, policy);
  if (!provider || rules.decision === "REJECTED") return rules;
  try {
    const res = await Promise.race([
      provider.moderate(text),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
    ]);
    return res.score > rules.score ? res : rules;
  } catch {
    return rules;
  }
}
