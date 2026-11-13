import { localHour, type Tz, TZ_OFFSET } from "./tz";

export interface BlastSettings {
  minDelaySec: number;
  maxDelaySec: number;
  longBreakEvery: number;
  longBreakSec: number;
  dailyCap: number;
  windowStart: number; // local hour, inclusive
  windowEnd: number; // local hour, exclusive
  ignoreWindow: boolean;
}

export const DEFAULT_SETTINGS: BlastSettings = {
  minDelaySec: 12,
  maxDelaySec: 30,
  longBreakEvery: 20,
  longBreakSec: 180,
  dailyCap: 200,
  windowStart: 8,
  windowEnd: 21,
  ignoreWindow: false,
};

export const DEMO_SETTINGS: BlastSettings = { ...DEFAULT_SETTINGS, minDelaySec: 1, maxDelaySec: 2, longBreakEvery: 50, longBreakSec: 5, ignoreWindow: true };

export const MAX_ATTEMPTS = 3;

export function randomDelayMs(s: BlastSettings, rng: () => number = Math.random): number {
  const min = Math.min(s.minDelaySec, s.maxDelaySec);
  const max = Math.max(s.minDelaySec, s.maxDelaySec);
  return Math.round((min + rng() * (max - min)) * 1000);
}

export function inWindow(at: Date, tz: Tz, s: BlastSettings): boolean {
  if (s.ignoreWindow) return true;
  const h = localHour(at, tz);
  return h >= s.windowStart && h < s.windowEnd;
}

/** Next instant (>= at) inside the send window. */
export function nextWindowStart(at: Date, tz: Tz, s: BlastSettings): Date {
  if (inWindow(at, tz, s)) return at;
  const off = TZ_OFFSET[tz] * 3600_000;
  const local = new Date(at.getTime() + off);
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  let start = day + s.windowStart * 3600_000 - off;
  if (start <= at.getTime()) start += 86_400_000;
  return new Date(start);
}

export function backoffMs(attempt: number): number {
  return 30_000 * 2 ** Math.max(0, attempt - 1);
}

export function idempotencyKey(campaignId: string, guestId: string): string {
  return `${campaignId}:${guestId}`;
}

/** Plan send times for `count` messages honouring delays, long breaks, window and daily cap. */
export function planSchedule(count: number, s: BlastSettings, tz: Tz, startAt: Date, rng: () => number = Math.random): Date[] {
  const out: Date[] = [];
  let cursor = nextWindowStart(startAt, tz, s);
  let sentToday = 0;
  let dayKey = Math.floor((cursor.getTime() + TZ_OFFSET[tz] * 3600_000) / 86_400_000);
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      cursor = new Date(cursor.getTime() + randomDelayMs(s, rng));
      if (s.longBreakEvery > 0 && i % s.longBreakEvery === 0) cursor = new Date(cursor.getTime() + s.longBreakSec * 1000);
    }
    cursor = nextWindowStart(cursor, tz, s);
    let k = Math.floor((cursor.getTime() + TZ_OFFSET[tz] * 3600_000) / 86_400_000);
    if (k !== dayKey) {
      dayKey = k;
      sentToday = 0;
    }
    if (sentToday >= s.dailyCap) {
      const tomorrow = new Date((dayKey + 1) * 86_400_000 - TZ_OFFSET[tz] * 3600_000);
      cursor = nextWindowStart(tomorrow, tz, s);
      k = Math.floor((cursor.getTime() + TZ_OFFSET[tz] * 3600_000) / 86_400_000);
      dayKey = k;
      sentToday = 0;
    }
    sentToday++;
    out.push(cursor);
  }
  return out;
}
