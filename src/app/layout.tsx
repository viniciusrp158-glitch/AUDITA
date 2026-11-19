import type { Metadata, Viewport } from "next";
import { withBase } from "@/lib/base-path";
import { getThemeCookie } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AUDITA", template: "%s · AUDITA" },
  description: "AUDITA | SSMA & SGI — sistema administrativo interno",
  robots: { index: false, follow: false },
  // Celular: instalável na tela inicial (manifest.ts) e em tela cheia no iPhone
  appleWebApp: { capable: true, title: "AUDITA", statusBarStyle: "default" },
  icons: { apple: withBase("/brand/apple-icon-180.png") },
};

export const viewport: Viewport = {
  themeColor: "#031b35",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = await getThemeCookie();
  return (
    <html lang="pt-BR" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
