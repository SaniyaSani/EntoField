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
  icons: {
    icon: "/entofield-icon-v3.png",
    shortcut: "/entofield-icon-v3.png",
    apple: "/entofield-icon-v3.png",
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
