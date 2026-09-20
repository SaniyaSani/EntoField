import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EntoField — field notes to specimen labels",
  description:
    "An offline-first field notebook for collected biological specimens.",
  manifest: "/manifest.webmanifest",
  applicationName: "EntoField",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EntoField",
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/icon-192.png",
    shortcut: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
