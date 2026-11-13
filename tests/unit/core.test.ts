import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";
import { renderTemplate, resolveSpintax, validateTemplate, seededRng } from "@/lib/spintax";
import { signQr, verifyQr } from "@/lib/qr";
import { pickWinner, resolveScan, validateDeviceTime } from "@/lib/checkin-logic";
import { computeKpi, monthlyValue, mrrSeries, type SubLike } from "@/lib/billing";
import { canAccessWorkspace } from "@/lib/tenant";
import { localToUtc } from "@/lib/tz";
import { buildIcs } from "@/lib/ics";
import { rateLimit } from "@/lib/rate-limit";
import { hashPassword, verifyPassword } from "@/lib/crypto";

describe("phone", () => {
  it.each([
    ["081234567890", "+6281234567890"],
    ["0812-3456-7890", "+6281234567890"],
    ["+62 812 3456 7890", "+6281234567890"],
    ["6281234567890", "+6281234567890"],
    ["81234567890", "+6281234567890"],
    ["62081234567890", "+6281234567890"],
    ["+60123456789", "+60123456789"],
    ["(0812) 345-67890", "+6281234567890"],
  ])("normalises %s", (inp, out) => expect(normalizePhone(inp)).toBe(out));
  it.each(["", "abc", "0212345", "12345", "0812", null, undefined])("rejects %s", (v) => expect(normalizePhone(v as string)).toBeNull());
});

describe("spintax & template vars", () => {
  it("resolves variants deterministically", () => {
    const a = resolveSpintax("{Halo|Hai|Selamat siang} Budi", seededRng(1));
    const b = resolveSpintax("{Halo|Hai|Selamat siang} Budi", seededRng(1));
    expect(a).toBe(b);
    expect(["Halo Budi", "Hai Budi", "Selamat siang Budi"]).toContain(a);
  });
  it("supports nesting", () => expect(["A x", "B y", "B z"]).toContain(resolveSpintax("{A x|B {y|z}}", seededRng(5))));
  it("substitutes variables and keeps unknown", () => {
    expect(renderTemplate("Halo {{nama}}, {{foo}} {{link}}", { nama: "Siti", link: "http://x" })).toBe("Halo Siti, {{foo}} http://x");
  });
  it("does not treat variables as spintax", () => expect(renderTemplate("{{nama}}", { nama: "A|B" })).toBe("A|B"));
  it("validates unknown variables", () => {
    expect(validateTemplate("Hi {{nama}} {{bogus}}").unknown).toEqual(["bogus"]);
    expect(validateTemplate("Hi {{nama}}").ok).toBe(true);
    expect(validateTemplate("   ").ok).toBe(false);
  });
});

describe("QR HMAC", () => {
  const g = "11111111-1111-4111-8111-111111111111";
  const s = "22222222-2222-4222-8222-222222222222";
  it("round-trips", () => {
    const p = signQr(g, s, "secret");
    expect(p.startsWith("WOS1.")).toBe(true);
    expect(verifyQr(p, "secret")).toEqual({ guestId: g, subEventId: s });
  });
  it("rejects wrong secret, tampering and malformed", () => {
    const p = signQr(g, s, "secret");
    expect(verifyQr(p, "other")).toBeNull();
    expect(verifyQr(p.replace(g, "33333333-3333-4333-8333-333333333333"), "secret")).toBeNull();
    expect(verifyQr(p.slice(0, -2) + "xx", "secret")).toBeNull();
    expect(verifyQr("garbage", "secret")).toBeNull();
    expect(verifyQr(`WOS2.${g}.${s}.abc`, "secret")).toBeNull();
  });
});

describe("check-in conflict resolution", () => {
  const t = (s: string) => new Date(s);
  it("earliest scan wins", () => {
    const a = { clientEventId: "a", scannedAt: t("2025-01-01T10:00:05Z"), gate: "G1" };
    const b = { clientEventId: "b", scannedAt: t("2025-01-01T10:00:01Z"), gate: "G2" };
    expect(pickWinner([a, b])?.clientEventId).toBe("b");
    expect(resolveScan([a], b).status).toBe("OK");
    const r = resolveScan([b], a);
    expect(r.status).toBe("DUPLICATE");
    if (r.status === "DUPLICATE") expect(r.first.gate).toBe("G2");
  });
  it("is idempotent for the same clientEventId", () => {
    const a = { clientEventId: "a", scannedAt: t("2025-01-01T10:00:00Z"), gate: "G1" };
    expect(resolveScan([a], a).status).toBe("OK");
  });
  it("clamps bad device clocks", () => {
    const now = new Date("2025-01-01T10:00:00Z");
    expect(validateDeviceTime(now.getTime() + 3600_000, now)).toEqual(now);
    expect(validateDeviceTime(now.getTime() - 30 * 86_400_000, now)).toEqual(now);
    expect(validateDeviceTime(now.getTime() - 60_000, now).getTime()).toBe(now.getTime() - 60_000);
    expect(validateDeviceTime(Number.NaN, now)).toEqual(now);
  });
});

describe("MRR", () => {
  const d = (s: string) => new Date(s);
  const subs: SubLike[] = [
    { planId: "premium", status: "ACTIVE", amountIdr: 299000, interval: "MONTH", startedAt: d("2025-01-10"), canceledAt: null },
    { planId: "exclusive", status: "ACTIVE", amountIdr: 9600000, interval: "YEAR", startedAt: d("2025-02-10"), canceledAt: null },
    { planId: "premium", status: "CANCELED", amountIdr: 299000, interval: "MONTH", startedAt: d("2025-01-05"), canceledAt: d("2025-03-05") },
    { planId: "premium", status: "ACTIVE", amountIdr: 299000, interval: "ONCE", startedAt: d("2025-01-01"), canceledAt: null },
  ];
  it("normalises intervals", () => {
    expect(monthlyValue(subs[1] as SubLike)).toBe(800000);
    expect(monthlyValue(subs[3] as SubLike)).toBe(0);
  });
  it("matches a manual calculation", () => {
    // at 2025-02-15: monthly 299000 + canceled-not-yet 299000 + yearly 800000 = 1,398,000
    const k = computeKpi(subs, d("2025-02-15"));
    expect(k.mrr).toBe(1398000);
    expect(k.arr).toBe(1398000 * 12);
    expect(k.payers).toBe(3);
    expect(k.arpu).toBe(466000);
    // after cancellation (2025-04-01): 299000 + 800000
    expect(computeKpi(subs, d("2025-04-01")).mrr).toBe(1099000);
  });
  it("builds a series", () => {
    const s = mrrSeries(subs, 3, d("2025-04-15"));
    expect(s.map((x) => x.month)).toEqual(["2025-02", "2025-03", "2025-04"]);
    expect(s[0]?.mrr).toBe(1398000);
    expect(s[2]?.mrr).toBe(1099000);
  });
});

describe("tenant isolation", () => {
  const user = { role: "USER", memberships: [{ workspaceId: "ws1", role: "EDITOR" }] };
  it("allows own workspace within role", () => {
    expect(canAccessWorkspace(user, "ws1", "VIEWER")).toBe(true);
    expect(canAccessWorkspace(user, "ws1", "EDITOR")).toBe(true);
  });
  it("denies higher role and other workspaces", () => {
    expect(canAccessWorkspace(user, "ws1", "OWNER")).toBe(false);
    expect(canAccessWorkspace(user, "ws2", "VIEWER")).toBe(false);
    expect(canAccessWorkspace({ role: "USER", memberships: [] }, "ws1", "VIEWER")).toBe(false);
  });
  it("super admin bypasses", () => expect(canAccessWorkspace({ role: "SUPER_ADMIN", memberships: [] }, "ws9", "OWNER")).toBe(true));
});

describe("time zones, ics, rate limit, passwords", () => {
  it("converts WIB/WITA/WIT to UTC", () => {
    expect(localToUtc("2025-06-14", "10:00", "WIB").toISOString()).toBe("2025-06-14T03:00:00.000Z");
    expect(localToUtc("2025-06-14", "10:00", "WITA").toISOString()).toBe("2025-06-14T02:00:00.000Z");
    expect(localToUtc("2025-06-14", "10:00", "WIT").toISOString()).toBe("2025-06-14T01:00:00.000Z");
  });
  it("builds valid ICS", () => {
    const ics = buildIcs([{ uid: "1", title: "Akad, Raka", start: new Date("2025-06-14T03:00:00Z") }]);
    expect(ics).toContain("DTSTART:20250614T030000Z");
    expect(ics).toContain("SUMMARY:Akad\\, Raka");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });
  it("rate limits", () => {
    const k = `t${Math.random()}`;
    expect(rateLimit(k, 2, 1000, 0).ok).toBe(true);
    expect(rateLimit(k, 2, 1000, 10).ok).toBe(true);
    expect(rateLimit(k, 2, 1000, 20).ok).toBe(false);
    expect(rateLimit(k, 2, 1000, 2000).ok).toBe(true);
  });
  it("hashes passwords", () => {
    const h = hashPassword("rahasia123");
    expect(verifyPassword("rahasia123", h)).toBe(true);
    expect(verifyPassword("salah", h)).toBe(false);
  });
});
