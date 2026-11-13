import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { currentEventPage } from "@/server/auth";
import { WishesClient } from "@/components/dashboard/WishesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ucapan" };

export default async function WishesPage() {
  const { event } = await currentEventPage();
  const rows = await db.select().from(s.wishes).where(eq(s.wishes.eventId, event.id)).orderBy(desc(s.wishes.createdAt));
  return <WishesClient eventId={event.id} rows={rows.map((w) => ({ id: w.id, name: w.name, message: w.message, status: w.status, score: w.score, reasons: (w.reasons as string[]) ?? [], pinned: w.pinned, reply: w.reply, at: w.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) }))} />;
}
