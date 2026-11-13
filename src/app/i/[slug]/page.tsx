import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { Invitation } from "@/components/invitation/Invitation";
import { findEventBySlug, loadInvData } from "@/server/invitation";
import { ensureDemo, DEMO_SLUG } from "@/server/seed";
import { getAuth } from "@/server/auth";
import { canAccessWorkspace } from "@/lib/tenant";
import { hashPin } from "@/lib/crypto";
import { dictFor } from "@/lib/i18n";
import { unlockInvitation } from "./actions";
import { cleanName } from "@/lib/clean";

export const dynamic = "force-dynamic";
const nowMs = () => Date.now();

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ev = await findEventBySlug(slug);
  if (!ev) return { title: "Undangan tidak ditemukan", robots: { index: false } };
  return {
    title: ev.title,
    description: `Anda diundang ke pernikahan ${ev.groomName} & ${ev.brideName}.`,
    robots: ev.noindex || ev.status !== "PUBLISHED" ? { index: false, follow: false } : undefined,
    openGraph: { title: ev.title, description: `Pernikahan ${ev.groomName} & ${ev.brideName}`, type: "website" },
  };
}

export default async function InvitationPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  let ev = await findEventBySlug(slug);
  if (!ev && slug === DEMO_SLUG) {
    await ensureDemo();
    ev = await findEventBySlug(slug);
  }
  if (!ev) notFound();
  const L = dictFor(ev.language);

  let previewAllowed = false;
  if (sp.preview === "1") {
    const a = await getAuth();
    previewAllowed = !!a && canAccessWorkspace({ role: a.user.role, memberships: a.memberships }, ev.workspaceId, "VIEWER");
  }
  if (ev.status === "DRAFT" && !previewAllowed) notFound();

  const msg = (text: string) => (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui", textAlign: "center" }}><p>{text}</p></main>
  );
  if (ev.expiresAt && ev.expiresAt.getTime() < nowMs() && !previewAllowed) return msg(L.expired);

  if (ev.password && !previewAllowed) {
    const ok = (await cookies()).get(`inv_${slug}`)?.value === hashPin(`unlock:${slug}`);
    if (!ok) {
      return (
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui" }}>
          <form action={unlockInvitation.bind(null, slug)} style={{ display: "grid", gap: 12, maxWidth: 320, width: "100%" }}>
            <p>{L.locked}</p>
            <label>{L.password}<input name="password" type="password" required style={{ width: "100%", padding: 10, border: "1px solid #999", borderRadius: 6 }} /></label>
            <button style={{ padding: 12, borderRadius: 6, background: "#111", color: "#fff" }}>{L.unlock}</button>
          </form>
        </main>
      );
    }
  }

  const token = typeof sp.g === "string" ? sp.g.slice(0, 80) : null;
  const data = await loadInvData(ev, token);
  const toName = cleanName(sp.to, data.guest?.name ?? L.guest);

  if (data.guest && !previewAllowed) {
    const [recent] = await db.select({ id: s.linkOpens.id }).from(s.linkOpens).where(and(eq(s.linkOpens.guestId, data.guest.id), gt(s.linkOpens.openedAt, new Date(nowMs() - 30 * 60_000)))).orderBy(desc(s.linkOpens.openedAt)).limit(1);
    if (!recent) await db.insert(s.linkOpens).values({ eventId: ev.id, guestId: data.guest.id });
  }

  const archived = ev.status === "ARCHIVED";
  const first = data.subEvents[0];
  const jsonLd = first
    ? {
        "@context": "https://schema.org", "@type": "Event", name: ev.title, startDate: first.startsAt, endDate: first.endsAt ?? undefined,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", location: { "@type": "Place", name: first.venue, address: first.address },
      }
    : null;
  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <Invitation data={data} toName={toName} archived={archived} />
    </>
  );
}
