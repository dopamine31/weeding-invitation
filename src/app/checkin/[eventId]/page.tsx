import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Scanner, PinForm } from "@/components/checkin/Scanner";
import { hasStaffAccess } from "@/server/staff";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const { eventId } = await params;
  return { title: "Check-in", manifest: `/checkin/${eventId}/manifest.webmanifest`, robots: { index: false } };
}

export default async function CheckinPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) notFound();
  if (!(await hasStaffAccess(eventId))) return <PinForm eventId={eventId} />;
  return <Scanner eventId={eventId} gateDefault="Gate 1" />;
}
