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
    icon: [
      {
        url: "/entofield-favicon-v3.png",
        sizes: "64x64",
        type: "image/png",
      },
      {
        url: "/entofield-app-icon-v3-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/entofield-app-icon-v3-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcut: "/entofield-favicon-v3.png",
    apple: [
      {
        url: "/entofield-apple-touch-icon-v3.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
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
