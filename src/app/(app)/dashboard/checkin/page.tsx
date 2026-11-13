import { currentEventPage } from "@/server/auth";
import { CheckinAdmin } from "@/components/dashboard/CheckinAdmin";
import { appUrl } from "@/server/blast";
import { planOf } from "@/server/entitlements";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check-in & TV" };

export default async function CheckinAdminPage() {
  const { event } = await currentEventPage();
  const plan = await planOf(event.workspaceId);
  return <CheckinAdmin eventId={event.id} staffUrl={`${appUrl()}/checkin/${event.id}`} tvUrl={`${appUrl()}/tv/${event.id}?key=${event.tvKey}`} hasPin={!!event.staffPinHash} tvAllowed={plan.tvMode} />;
}
