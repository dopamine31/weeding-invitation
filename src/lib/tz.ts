export type Tz = "WIB" | "WITA" | "WIT";
export const TZ_OFFSET: Record<Tz, number> = { WIB: 7, WITA: 8, WIT: 9 };
export const TZ_IANA: Record<Tz, string> = { WIB: "Asia/Jakarta", WITA: "Asia/Makassar", WIT: "Asia/Jayapura" };

export function asTz(v: string): Tz {
  return v === "WITA" || v === "WIT" ? v : "WIB";
}

/** Convert local wall-clock date/time in an Indonesian zone to a UTC Date. */
export function localToUtc(date: string, time: string, tz: Tz): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, d, hh - TZ_OFFSET[tz], mm));
}

export function localHour(date: Date, tz: Tz): number {
  return new Date(date.getTime() + TZ_OFFSET[tz] * 3600_000).getUTCHours();
}

export function formatDate(date: Date, tz: Tz, locale = "id-ID", opts?: Intl.DateTimeFormatOptions): string {
  const custom = !!opts && ("month" in opts || "year" in opts || "day" in opts || "weekday" in opts);
  return new Intl.DateTimeFormat(locale, custom ? { timeZone: TZ_IANA[tz], ...opts } : { timeZone: TZ_IANA[tz], dateStyle: "full", ...opts }).format(date);
}

export function formatTime(date: Date, tz: Tz): string {
  return `${new Intl.DateTimeFormat("id-ID", { timeZone: TZ_IANA[tz], hour: "2-digit", minute: "2-digit", hour12: false }).format(date).replace(".", ":")} ${tz}`;
}

export function toInputDate(date: Date, tz: Tz): string {
  return new Date(date.getTime() + TZ_OFFSET[tz] * 3600_000).toISOString().slice(0, 10);
}
export function toInputTime(date: Date, tz: Tz): string {
  return new Date(date.getTime() + TZ_OFFSET[tz] * 3600_000).toISOString().slice(11, 16);
}
