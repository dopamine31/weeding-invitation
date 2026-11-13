import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { currentEventPage } from "@/server/auth";
import { SettingsClient } from "@/components/dashboard/SettingsClient";
import { asTz, toInputDate, toInputTime } from "@/lib/tz";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const { event: e } = await currentEventPage("VIEWER");
  const tz = asTz(e.timezone);
  const [subs, pics, gifts, menus, wl] = await Promise.all([
    db.select().from(s.subEvents).where(eq(s.subEvents.eventId, e.id)).orderBy(asc(s.subEvents.sort)),
    db.select().from(s.pics).where(eq(s.pics.eventId, e.id)).orderBy(asc(s.pics.sort)),
    db.select().from(s.giftAccounts).where(eq(s.giftAccounts.eventId, e.id)),
    db.select().from(s.menuOptions).where(eq(s.menuOptions.eventId, e.id)),
    db.select().from(s.wishlistItems).where(eq(s.wishlistItems.eventId, e.id)),
  ]);
  return (
    <SettingsClient eventId={e.id} slug={e.slug} initial={{
      title: e.title, groomName: e.groomName, brideName: e.brideName, groomFull: e.groomFull, brideFull: e.brideFull, groomParents: e.groomParents, brideParents: e.brideParents,
      timezone: tz, language: e.language === "en" ? "en" : "id", wishPolicy: e.wishPolicy === "MANUAL" ? "MANUAL" : "AUTO", noindex: e.noindex, expiresAt: e.expiresAt ? toInputDate(e.expiresAt, tz) : "",
      retentionDays: e.retentionDays, status: e.status as "DRAFT", templateSlug: e.templateSlug,
      subEvents: subs.map((x) => ({ id: x.id, name: x.name, date: toInputDate(x.startsAt, tz), time: toInputTime(x.startsAt, tz), endTime: x.endsAt ? toInputTime(x.endsAt, tz) : "", venue: x.venue, address: x.address, mapsUrl: x.mapsUrl, dressCode: x.dressCode, streamingUrl: x.streamingUrl })),
      pics: pics.map((p) => ({ name: p.name, phone: p.phone, role: p.role })),
      gifts: gifts.map((g) => ({ type: g.type as "BANK", provider: g.provider, accountNumber: g.accountNumber, accountName: g.accountName })),
      menus: menus.map((m) => ({ id: m.id, name: m.name })), wishlist: wl.map((w) => ({ id: w.id, name: w.name })),
    }} />
  );
}
