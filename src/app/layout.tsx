import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "WeddingOS · Undangan Pernikahan Digital Premium", template: "%s · WeddingOS" },
  description: "Platform undangan pernikahan digital: 8 template premium, RSVP, blast WhatsApp, denah meja, check-in QR, dan TV mode.",
  applicationName: "WeddingOS",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#8a6d2f" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
