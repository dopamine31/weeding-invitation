import { hmacB64, safeEqual } from "./crypto";

/** QR payload format: WOS1.<guestId>.<subEventId>.<hmac> */
export function signQr(guestId: string, subEventId: string, secret?: string): string {
  const sig = hmacB64(`WOS1.${guestId}.${subEventId}`, secret).slice(0, 22);
  return `WOS1.${guestId}.${subEventId}.${sig}`;
}

export function verifyQr(payload: string, secret?: string): { guestId: string; subEventId: string } | null {
  const parts = payload.trim().split(".");
  if (parts.length !== 4 || parts[0] !== "WOS1") return null;
  const [, guestId, subEventId, sig] = parts as [string, string, string, string];
  if (!/^[0-9a-f-]{36}$/i.test(guestId) || !/^[0-9a-f-]{36}$/i.test(subEventId)) return null;
  const expected = hmacB64(`WOS1.${guestId}.${subEventId}`, secret).slice(0, 22);
  if (!safeEqual(sig, expected)) return null;
  return { guestId, subEventId };
}
