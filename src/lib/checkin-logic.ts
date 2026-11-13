export interface ScanLike {
  clientEventId: string;
  scannedAt: Date;
  gate: string;
}

/** Earliest scan wins; ties broken by clientEventId for determinism. */
export function pickWinner<T extends ScanLike>(scans: T[]): T | undefined {
  return [...scans].sort(
    (a, b) => a.scannedAt.getTime() - b.scannedAt.getTime() || a.clientEventId.localeCompare(b.clientEventId),
  )[0];
}

/** Clamp an untrusted device timestamp into a plausible window around server time. */
export function validateDeviceTime(deviceMs: number, serverNow: Date, maxSkewMs = 5 * 60_000, maxAgeMs = 7 * 86_400_000): Date {
  if (!Number.isFinite(deviceMs)) return serverNow;
  if (deviceMs > serverNow.getTime() + maxSkewMs) return serverNow;
  if (deviceMs < serverNow.getTime() - maxAgeMs) return serverNow;
  return new Date(deviceMs);
}

export type ScanOutcome = { status: "OK" } | { status: "DUPLICATE"; first: ScanLike };

/** Decide outcome for an incoming scan versus already stored scans for the same guest & sub-event. */
export function resolveScan(existing: ScanLike[], incoming: ScanLike): ScanOutcome {
  const dupSame = existing.find((e) => e.clientEventId === incoming.clientEventId);
  if (dupSame) return pickWinner(existing)?.clientEventId === incoming.clientEventId ? { status: "OK" } : { status: "DUPLICATE", first: pickWinner(existing) as ScanLike };
  const winner = pickWinner([...existing, incoming]) as ScanLike;
  return winner.clientEventId === incoming.clientEventId ? { status: "OK" } : { status: "DUPLICATE", first: winner };
}
