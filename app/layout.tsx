import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "JobHunter AI — Your job search, intelligently managed",
    template: "%s | JobHunter AI",
  },
  description:
    "A private AI job-hunting workspace that discovers, ranks, and safely prepares applications under your control.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "JobHunter AI — Find the right role, safely",
    description: "Private job discovery, matching, and application preparation under your control.",
    type: "website",
    images: [{ url: "/jobhunter-social-card.png", width: 1792, height: 1024, alt: "JobHunter AI — Your job search, intelligently managed." }],
  },
  twitter: { card: "summary_large_image", images: ["/jobhunter-social-card.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
