import { describe, expect, it } from "vitest";
import { moderate, countProfanity, sanitizeText, moderateWithFallback } from "@/lib/moderation";

type Case = [string, string, "AUTO" | "MANUAL", string];
// [label, text, policy, expected decision]
const cases: Case[] = [
  ["clean id", "Selamat menempuh hidup baru, semoga sakinah mawaddah warahmah", "AUTO", "APPROVED"],
  ["clean en", "Congratulations to the happy couple! Wishing you a lifetime of love", "AUTO", "APPROVED"],
  ["clean short", "Selamat ya!", "AUTO", "APPROVED"],
  ["clean emoji", "Happy wedding 🎉🎉", "AUTO", "APPROVED"],
  ["clean diacritics", "Félicitations à vous deux", "AUTO", "APPROVED"],
  ["clean pantai (contains tai)", "Kita ketemu di pantai ya setelah acara", "AUTO", "APPROVED"],
  ["clean assam", "Masakan asam manis enak sekali", "AUTO", "APPROVED"],
  ["clean classic", "Classic wedding, class act", "AUTO", "APPROVED"],
  ["clean sialang", "Semoga langgeng sampai kakek nenek", "AUTO", "APPROVED"],
  ["clean babi-like word babian? no", "Bahagia selalu untuk kalian berdua", "AUTO", "APPROVED"],
  ["clean manual policy", "Selamat berbahagia", "MANUAL", "PENDING"],
  ["profanity id", "dasar anjing lu", "AUTO", "FLAGGED"],
  ["profanity en", "this is shit", "AUTO", "FLAGGED"],
  ["profanity regional", "asu kowe", "AUTO", "FLAGGED"],
  ["profanity jancok", "jancok tenan", "AUTO", "FLAGGED"],
  ["repeated letters", "anjiiiiing", "AUTO", "FLAGGED"],
  ["leet speak", "k0nt0l", "AUTO", "FLAGGED"],
  ["leet speak 2", "b4ngs4t", "AUTO", "FLAGGED"],
  ["leet symbols", "sh!t", "AUTO", "FLAGGED"],
  ["spaced letters", "a n j i n g", "AUTO", "FLAGGED"],
  ["dotted letters", "k.o.n.t.o.l", "AUTO", "FLAGGED"],
  ["mask wildcard", "f*ck", "AUTO", "FLAGGED"],
  ["uppercase", "BANGSAT", "AUTO", "FLAGGED"],
  ["mixed case", "BaJiNgAn", "AUTO", "FLAGGED"],
  ["glued long word", "lukontolan", "AUTO", "FLAGGED"],
  ["double profanity rejected", "anjing bangsat", "AUTO", "REJECTED"],
  ["en double rejected", "fuck you bitch", "AUTO", "REJECTED"],
  ["profanity + url rejected", "bangsat https://spam.example.com", "AUTO", "REJECTED"],
  ["url", "Klik https://promo.example.com untuk hadiah", "AUTO", "FLAGGED"],
  ["www url", "kunjungi www.judi.com", "AUTO", "FLAGGED"],
  ["bare domain", "cek situs saya halo.xyz", "AUTO", "FLAGGED"],
  ["phone +62", "hubungi +62 812 3456 7890", "AUTO", "PENDING"],
  ["phone 08", "wa 081234567890 ya", "AUTO", "PENDING"],
  ["repetition", "promo promo promo promo promo", "AUTO", "PENDING"],
  ["caps", "SELAMAT MENEMPUH HIDUP BARU SEMOGA BAHAGIA", "AUTO", "PENDING"],
  ["url+phone flagged", "wa 081234567890 https://x.example.com", "AUTO", "FLAGGED"],
  ["empty", "   ", "AUTO", "REJECTED"],
  ["single char", "a", "AUTO", "REJECTED"],
  ["html stripped clean", "<b>Selamat</b> berbahagia", "AUTO", "APPROVED"],
  ["script tag clean text", "<script>alert(1)</script>Selamat", "AUTO", "APPROVED"],
  ["english profanity bastard", "you bastard", "AUTO", "FLAGGED"],
  ["sunda anying", "anying maneh", "AUTO", "FLAGGED"],
  ["goblok", "goblok banget", "AUTO", "FLAGGED"],
  ["sialan", "sialan kamu", "AUTO", "FLAGGED"],
];

describe("moderation", () => {
  it("has at least 40 cases", () => expect(cases.length).toBeGreaterThanOrEqual(40));
  it.each(cases)("%s", (_label, text, policy, expected) => {
    expect(moderate(text, policy).decision).toBe(expected);
  });

  it("counts multiple profanities", () => expect(countProfanity("anjing dan bangsat")).toBe(2));
  it("sanitizes html and control chars", () => {
    expect(sanitizeText("<img src=x onerror=alert(1)>hi\u0000 there")).toBe("hi there");
    expect(sanitizeText("x".repeat(900)).length).toBe(500);
  });

  it("falls back to rules when LLM provider throws", async () => {
    const res = await moderateWithFallback("Selamat", "AUTO", { moderate: async () => { throw new Error("down"); } });
    expect(res.decision).toBe("APPROVED");
  });
  it("falls back to rules on timeout", async () => {
    const res = await moderateWithFallback("Selamat", "AUTO", { moderate: () => new Promise(() => undefined) }, 20);
    expect(res.decision).toBe("APPROVED");
  });
  it("uses stricter LLM verdict when available", async () => {
    const res = await moderateWithFallback("Selamat", "AUTO", { moderate: async () => ({ decision: "FLAGGED", score: 60, reasons: ["llm"] }) });
    expect(res.decision).toBe("FLAGGED");
  });
});
