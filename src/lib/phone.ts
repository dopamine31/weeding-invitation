/** Normalise Indonesian (and foreign) phone numbers to E.164. Returns null when invalid. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const original = String(raw).trim();
  if (!original) return null;
  const hadPlus = original.startsWith("+");
  let digits = original.replace(/\D/g, "");
  if (!digits) return null;
  if (!hadPlus && digits.startsWith("00")) digits = digits.slice(2);
  let rest: string;
  if (digits.startsWith("62")) {
    rest = digits.slice(2);
    if (rest.startsWith("0")) rest = rest.slice(1);
  } else if (hadPlus || original.startsWith("00")) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  } else if (digits.startsWith("0")) {
    rest = digits.slice(1);
  } else if (digits.startsWith("8")) {
    rest = digits;
  } else {
    return null;
  }
  if (!/^8\d{7,11}$/.test(rest)) return null;
  return `+62${rest}`;
}

export function waLink(phone: string, text?: string): string {
  const n = phone.replace(/\D/g, "");
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
