import { Wizard } from "@/components/dashboard/Wizard";
import { requireAuth } from "@/server/auth";
import { planOf } from "@/server/entitlements";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mulai" };

export default async function Onboarding() {
  const a = await requireAuth();
  const premiumOk = a.workspaceId ? (await planOf(a.workspaceId)).premiumTemplates : false;
  return (
    <main className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <h1 className="font-display text-3xl text-center">Halo, {a.user.name.split(" ")[0]}. Mari buat undangan Anda.</h1>
        <Wizard premiumOk={premiumOk} />
      </div>
    </main>
  );
}
