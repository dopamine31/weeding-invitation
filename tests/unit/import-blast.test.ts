import { describe, expect, it } from "vitest";
import { detectDuplicates, parseTable, similarity, suggestMapping, validateRows, failedRowsCsv } from "@/lib/import";
import { DEFAULT_SETTINGS, DEMO_SETTINGS, backoffMs, idempotencyKey, inWindow, nextWindowStart, planSchedule, randomDelayMs, MAX_ATTEMPTS } from "@/lib/throttle";
import { seededRng } from "@/lib/spintax";

describe("import parsing & mapping", () => {
  it("detects delimiter and header mapping (semicolon)", () => {
    const t = parseTable("Nama Tamu;No HP;Grup\nBudi;0812 111 2222;Kantor\nSiti;0813 333 4444;Keluarga\n");
    expect(t.delimiter).toBe(";");
    expect(t.rows).toHaveLength(2);
    expect(suggestMapping(t.headers)).toEqual({ name: 0, phone: 1, group: 2 });
  });
  it("validates rows and normalises phones", () => {
    const rows = [["Budi", "0812-1112-2233", "b@x.com", "2"], ["", "0812", "bad", "99"]];
    const r = validateRows(rows, { name: 0, phone: 1, email: 2, maxPax: 3 });
    expect(r[0]?.errors).toEqual([]);
    expect(r[0]?.data.phone).toBe("+6281211122233");
    expect(r[1]?.errors.length).toBe(4);
    expect(failedRowsCsv(r)).toContain("Nama kosong");
  });
  it("detects phone and fuzzy-name duplicates", () => {
    const rows = [
      ["Budi Santoso", "081211122233"],
      ["Bpk. Budi Santoso", ""],
      ["Budi Santoso", "081299988877"],
      ["Siti Aminah", "081200000001"],
      ["Siti Aminah", "081200000001"],
      ["Rudi Hartono", ""],
    ];
    const res = detectDuplicates(validateRows(rows, { name: 0, phone: 1 }), [{ id: "1", name: "Rudi Hartono", phone: null }, { id: "2", name: "Siti Aminah", phone: "+6281200000001" }]);
    expect(res[0]?.duplicate).toBeUndefined();
    expect(res[1]?.duplicate).toMatchObject({ reason: "name", source: "file" });
    expect(res[2]?.duplicate).toMatchObject({ reason: "name", source: "file" });
    expect(res[3]?.duplicate).toMatchObject({ reason: "phone", source: "existing" });
    expect(res[4]?.duplicate).toMatchObject({ reason: "phone", source: "existing" });
    expect(res[5]?.duplicate).toMatchObject({ reason: "name", source: "existing", score: 1 });
  });
  it("similarity scores", () => {
    expect(similarity("Budi Santoso", "budi santoso")).toBe(1);
    expect(similarity("Budi Santoso", "Budi Santosa")).toBeGreaterThan(0.8);
    expect(similarity("Budi Santoso", "Wulan Sari")).toBeLessThan(0.5);
  });
  it("handles 5000 rows in well under 30s", () => {
    const first = ["Andi", "Budi", "Citra", "Dewi", "Eko", "Fajar", "Gita", "Hadi", "Indra", "Joko"];
    const last = ["Santoso", "Wijaya", "Pratama", "Lestari", "Kusuma", "Saputra", "Hartono", "Nugroho", "Rahayu", "Siregar"];
    const rows: string[][] = [];
    for (let i = 0; i < 5000; i++) rows.push([`${first[i % 10]} ${last[Math.floor(i / 10) % 10]} ${i}`, `08${String(1200000000 + i)}`]);
    rows.push(["Andi Santoso 0", "081200000000"]); // phone dup
    const t0 = Date.now();
    const res = detectDuplicates(validateRows(rows, { name: 0, phone: 1 }), []);
    const ms = Date.now() - t0;
    expect(res).toHaveLength(5001);
    expect(res[5000]?.duplicate?.reason).toBe("phone");
    expect(ms).toBeLessThan(30_000);
  });
});

describe("blast throttling", () => {
  const rng = seededRng(42);
  it("delays stay within bounds", () => {
    for (let i = 0; i < 200; i++) {
      const d = randomDelayMs(DEFAULT_SETTINGS, rng);
      expect(d).toBeGreaterThanOrEqual(12_000);
      expect(d).toBeLessThanOrEqual(30_000);
    }
  });
  it("respects the send window (WIB)", () => {
    expect(inWindow(new Date("2025-06-14T03:00:00Z"), "WIB", DEFAULT_SETTINGS)).toBe(true); // 10:00
    expect(inWindow(new Date("2025-06-14T16:00:00Z"), "WIB", DEFAULT_SETTINGS)).toBe(false); // 23:00
    expect(nextWindowStart(new Date("2025-06-14T16:00:00Z"), "WIB", DEFAULT_SETTINGS).toISOString()).toBe("2025-06-15T01:00:00.000Z"); // 08:00 next day
    expect(nextWindowStart(new Date("2025-06-14T20:00:00Z"), "WIB", DEFAULT_SETTINGS).toISOString()).toBe("2025-06-15T01:00:00.000Z");
  });
  it("schedules monotonically, inside window, honouring the daily cap", () => {
    const s = { ...DEFAULT_SETTINGS, dailyCap: 10, longBreakEvery: 0 };
    const times = planSchedule(35, s, "WIB", new Date("2025-06-14T01:00:00Z"), seededRng(7));
    for (let i = 1; i < times.length; i++) expect((times[i] as Date).getTime()).toBeGreaterThan((times[i - 1] as Date).getTime());
    for (const t of times) expect(inWindow(t, "WIB", s)).toBe(true);
    const perDay = new Map<string, number>();
    for (const t of times) {
      const k = new Date(t.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
    }
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(10);
    expect(perDay.size).toBeGreaterThanOrEqual(4);
  });
  it("simulates 200 messages in demo mode quickly", () => {
    const times = planSchedule(200, DEMO_SETTINGS, "WIB", new Date("2025-06-14T16:00:00Z"), seededRng(3));
    expect(times).toHaveLength(200);
    expect((times[199] as Date).getTime() - (times[0] as Date).getTime()).toBeLessThan(15 * 60_000);
  });
  it("uses exponential backoff, max 3 attempts, stable idempotency keys", () => {
    expect([backoffMs(1), backoffMs(2), backoffMs(3)]).toEqual([30000, 60000, 120000]);
    expect(MAX_ATTEMPTS).toBe(3);
    expect(idempotencyKey("c1", "g1")).toBe(idempotencyKey("c1", "g1"));
    expect(idempotencyKey("c1", "g1")).not.toBe(idempotencyKey("c1", "g2"));
  });
});
