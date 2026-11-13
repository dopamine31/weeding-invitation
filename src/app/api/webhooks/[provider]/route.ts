import { NextResponse, type NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { safeEqual } from "@/lib/crypto";
import { handleOptOut } from "@/server/blast";
import { settlePayment, verifyMidtransSignature } from "@/server/payments";
import { normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  if (provider === "midtrans") {
    const ok = verifyMidtransSignature(String(body.order_id), String(body.status_code), String(body.gross_amount), String(body.signature_key));
    if (!ok) return NextResponse.json({ error: "bad_signature" }, { status: 401 });
    const st = String(body.transaction_status);
    if (st === "settlement" || st === "capture") await settlePayment(String(body.order_id), true);
    else if (["deny", "cancel", "expire", "failure"].includes(st)) await settlePayment(String(body.order_id), false);
    return NextResponse.json({ ok: true });
  }

  if (provider === "whatsapp") {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret || !safeEqual(req.headers.get("x-webhook-secret") ?? "", secret)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (body.type === "status") {
      const map: Record<string, string> = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };
      const st = map[String(body.status).toLowerCase()];
      if (st) await db.update(s.blastMessages).set({ status: st, updatedAt: new Date() }).where(eq(s.blastMessages.providerMessageId, String(body.providerMessageId)));
    } else if (body.type === "incoming") {
      const phone = normalizePhone(String(body.from ?? ""));
      if (phone) await handleOptOut(phone, String(body.text ?? ""));
    }
    return NextResponse.json({ ok: true });
  }
  void inArray;
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
