export interface SubLike {
  planId: string;
  status: string;
  amountIdr: number;
  interval: string;
  startedAt: Date;
  canceledAt: Date | null;
}

export function monthlyValue(s: Pick<SubLike, "amountIdr" | "interval">): number {
  if (s.interval === "MONTH") return s.amountIdr;
  if (s.interval === "YEAR") return Math.round(s.amountIdr / 12);
  return 0; // one-off payments carry no recurring revenue
}

export function isActiveAt(s: SubLike, at: Date): boolean {
  if (s.startedAt.getTime() > at.getTime()) return false;
  if (s.canceledAt && s.canceledAt.getTime() <= at.getTime()) return false;
  return true;
}

export function computeKpi(subs: SubLike[], at: Date = new Date()) {
  const active = subs.filter((s) => isActiveAt(s, at));
  const mrr = active.reduce((a, s) => a + monthlyValue(s), 0);
  const payers = active.filter((s) => monthlyValue(s) > 0).length;
  return { mrr, arr: mrr * 12, arpu: payers ? Math.round(mrr / payers) : 0, payers, activeSubs: active.length };
}

/** MRR at the end of each of the last `months` months (oldest first). */
export function mrrSeries(subs: SubLike[], months: number, now: Date = new Date()) {
  const out: { month: string; mrr: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1) - 1);
    const at = i === 0 ? now : end;
    out.push({ month: `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`, mrr: computeKpi(subs, at).mrr });
  }
  return out;
}

export const PLAN_SEED = [
  { id: "free", name: "Free", priceIdr: 0, guestLimit: 50, blastLimit: 0, tvMode: false, premiumTemplates: false },
  { id: "premium", name: "Premium", priceIdr: 299000, guestLimit: 500, blastLimit: 500, tvMode: true, premiumTemplates: true },
  { id: "exclusive", name: "Exclusive", priceIdr: 799000, guestLimit: 5000, blastLimit: 5000, tvMode: true, premiumTemplates: true },
];
