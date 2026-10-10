import type { Metadata } from "next";
import { getThemeCookie } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AUDITA", template: "%s · AUDITA" },
  description: "AUDITA | SSMA & SGI — sistema administrativo interno",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = await getThemeCookie();
  return (
    <html lang="pt-BR" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
