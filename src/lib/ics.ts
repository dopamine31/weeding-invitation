const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export interface IcsEvent {
  uid: string;
  title: string;
  start: Date;
  end?: Date | null;
  location?: string;
  description?: string;
}

export function buildIcs(events: IcsEvent[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//WeddingOS//ID", "CALSCALE:GREGORIAN"];
  for (const e of events) {
    const end = e.end ?? new Date(e.start.getTime() + 3 * 3600_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@weddingos`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(e.start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${esc(e.title)}`,
      `LOCATION:${esc(e.location ?? "")}`,
      `DESCRIPTION:${esc(e.description ?? "")}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function googleCalendarUrl(e: IcsEvent): string {
  const end = e.end ?? new Date(e.start.getTime() + 3 * 3600_000);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${fmt(e.start)}/${fmt(end)}`,
    location: e.location ?? "",
    details: e.description ?? "",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
