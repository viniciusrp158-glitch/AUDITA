import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

// Títulos em Montserrat, como no site institucional (o texto continua em Inter)
const display = Montserrat({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Audita Academy", template: "%s · Audita Academy" },
  description: "Audita Academy, a plataforma de treinamentos da AUDITA | SSMA & SGI.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}
