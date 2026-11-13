import { currentEventPage } from "@/server/auth";
import { getStats } from "@/server/stats";
import { LiveOverview } from "@/components/dashboard/LiveOverview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ringkasan" };

export default async function Overview() {
  const { event } = await currentEventPage();
  return <LiveOverview eventId={event.id} initial={await getStats(event.id)} slug={event.slug} />;
}
