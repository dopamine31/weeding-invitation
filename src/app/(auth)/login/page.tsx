import { redirect } from "next/navigation";
import { AuthForm } from "@/components/dashboard/AuthForm";
import { getAuth } from "@/server/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const a = await getAuth().catch(() => null);
  if (a && !sp.error) redirect(a.user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard");
  const notice = sp.error === "suspended" ? "Akun ditangguhkan. Hubungi dukungan." : sp.error === "denied" ? "Akses ditolak." : undefined;
  return (
    <main className="min-h-screen grid place-items-center p-4">
      <AuthForm mode="login" demo={process.env.DEMO_MODE !== "false"} notice={notice} />
    </main>
  );
}
