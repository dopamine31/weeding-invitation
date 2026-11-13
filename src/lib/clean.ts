/** Safe guest-name handling for `?to=`: strip tags/control chars, cap at 60 chars. Rendered as text only. */
export function cleanName(v: string | string[] | undefined, fallback: string): string {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return fallback;
  const out = raw.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  return out || fallback;
}
