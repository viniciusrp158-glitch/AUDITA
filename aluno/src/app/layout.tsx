import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Treinamentos AUDITA", template: "%s · Treinamentos AUDITA" },
  description: "Área do aluno dos treinamentos da AUDITA | SSMA & SGI",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
