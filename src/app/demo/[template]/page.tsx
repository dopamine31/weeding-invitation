import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Invitation } from "@/components/invitation/Invitation";
import { sampleInvData } from "@/server/invitation";
import { TEMPLATES } from "@/templates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pratinjau Template", robots: { index: false } };

export default async function DemoTemplate({ params, searchParams }: { params: Promise<{ template: string }>; searchParams: Promise<{ to?: string; lang?: string }> }) {
  const { template } = await params;
  const sp = await searchParams;
  if (!TEMPLATES.some((t) => t.slug === template)) notFound();
  const data = sampleInvData(template);
  if (sp.lang === "en") data.event.language = "en";
  return <Invitation data={data} toName={(sp.to ?? "").slice(0, 60) || (sp.lang === "en" ? "Dear Guest" : "Tamu Undangan")} readOnly />;
}
