import { NextResponse } from "next/server";

export async function GET(_req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  return NextResponse.json(
    {
      name: "WeddingOS Check-in", short_name: "Check-in", start_url: `/checkin/${eventId}`, scope: `/checkin/${eventId}`, display: "standalone",
      background_color: "#111113", theme_color: "#8a6d2f",
      icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
