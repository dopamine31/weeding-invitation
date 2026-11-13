import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { safeEqual } from "@/lib/crypto";
import { TvClient } from "@/components/tv/TvClient";
import { appUrl } from "@/server/blast";
import { planOf } from "@/server/entitlements";
import { getTemplate } from "@/templates";

export const dynamic = "force-dynamic";
export const metadata = { title: "TV Mode", robots: { index: false } };

export default async function TvPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ key?: string }> }) {
  const { eventId } = await params;
  const { key } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) notFound();
  const [ev] = await db.select().from(s.events).where(eq(s.events.id, eventId)).limit(1);
  if (!ev || !key || !safeEqual(key, ev.tvKey)) notFound();
  if (!(await planOf(ev.workspaceId)).tvMode) return <main className="min-h-screen grid place-items-center p-6 text-center"><p>TV Mode memerlukan paket Premium.</p></main>;
  const [sub] = await db.select().from(s.subEvents).where(eq(s.subEvents.eventId, ev.id)).orderBy(asc(s.subEvents.startsAt)).limit(1);
  const t = getTemplate(ev.templateSlug);
  return <TvClient eventId={ev.id} tvKey={key} title={`${ev.groomName} & ${ev.brideName}`} inviteUrl={`${appUrl()}/i/${ev.slug}#sec-wish`} targetIso={sub?.startsAt.toISOString() ?? null} theme={{ bg: t.colors.bg, text: t.colors.text, accent: t.colors.accentText, muted: t.colors.muted }} />;
}
