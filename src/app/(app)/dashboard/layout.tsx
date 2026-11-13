import Link from "next/link";
import type { ReactNode } from "react";
import { currentEventPage } from "@/server/auth";
import { NavLinks } from "@/components/dashboard/ui";
import { logoutAction, stopImpersonation } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { auth, event, workspace } = await currentEventPage();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-0 md:h-screen p-3 md:p-4 border-b md:border-b-0 md:border-r" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center justify-between md:block mb-2">
          <Link href="/" className="font-display text-xl">WeddingOS</Link>
          <form action={logoutAction} className="md:mt-1"><button className="btn btn-sm">Keluar</button></form>
        </div>
        <p className="text-xs muted mb-2 truncate">{event.groomName} & {event.brideName} · paket {workspace?.planId}</p>
        <NavLinks eventId={event.id} />
      </aside>
      <div className="p-4 md:p-6 min-w-0">
        {auth.impersonatedBy && (
          <form action={stopImpersonation} className="card mb-4 flex items-center justify-between gap-2" style={{ borderColor: "var(--app-danger)" }}>
            <span className="text-sm">Anda sedang <b>impersonate</b> workspace ini sebagai Super Admin.</span><button className="btn btn-sm btn-danger">Berhenti</button>
          </form>
        )}
        {process.env.DEMO_MODE !== "false" && <p className="badge mb-3" role="note">Mode Demo · WhatsApp, pembayaran & email disimulasikan</p>}
        {event.status !== "PUBLISHED" && <p className="card mb-4 text-sm">Undangan berstatus <b>{event.status}</b>. Tamu belum dapat membukanya. Terbitkan di Pengaturan.</p>}
        {children}
      </div>
    </div>
  );
}
