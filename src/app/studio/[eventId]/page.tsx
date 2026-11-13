import { notFound, redirect } from "next/navigation";
import { requireEventAccess, AccessError } from "@/server/auth";
import { StudioClient } from "@/components/dashboard/StudioClient";
import { migrateConfig } from "@/lib/invitation-config";
import { getTemplate } from "@/templates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio" };

export default async function StudioPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) notFound();
  const access = await requireEventAccess(eventId, "EDITOR").catch((e) => { if (e instanceof AccessError) redirect("/login"); throw e; });
  const t = getTemplate(access.event.templateSlug);
  return <StudioClient eventId={eventId} slug={access.event.slug} status={access.event.status} initial={migrateConfig(access.event.config)} tplColors={{ bg: t.colors.bg, surface: t.colors.surface, text: t.colors.text, muted: t.colors.muted, accent: t.colors.accent, accentText: t.colors.accentText }} />;
}
