import { ImageResponse } from "next/og";
import { findEventBySlug } from "@/server/invitation";
import { getTemplate } from "@/templates";

export const dynamic = "force-dynamic";
export const alt = "Undangan Pernikahan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ev = await findEventBySlug(slug);
  const t = getTemplate(ev?.templateSlug ?? "elegant-ivory");
  const names = ev ? `${ev.groomName} & ${ev.brideName}` : "WeddingOS";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.colors.bg, color: t.colors.text, border: `18px solid ${t.colors.accent}` }}>
        <div style={{ fontSize: 28, letterSpacing: 10, color: t.colors.accentText, textTransform: "uppercase" }}>The Wedding of</div>
        <div style={{ fontSize: 120, marginTop: 24, textAlign: "center" }}>{names}</div>
        <div style={{ width: 220, height: 3, background: t.colors.accent, marginTop: 30 }} />
        <div style={{ fontSize: 30, marginTop: 28, color: t.colors.muted }}>{t.name}</div>
      </div>
    ),
    size,
  );
}
