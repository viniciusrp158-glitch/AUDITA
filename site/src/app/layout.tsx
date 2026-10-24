import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import { Flutuantes } from "@/components/flutuantes";
import "./globals.css";

const display = Montserrat({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://audita.seg.br"),
  title: { default: "AUDITA | SSMA & SGI", template: "%s · AUDITA | SSMA & SGI" },
  description: "Soluções em Segurança, Saúde, Meio Ambiente e Sistemas de Gestão para pequenas e médias empresas.",
  // Prévia: fora dos buscadores até a publicação autorizada pelo Vinicius (briefing, Etapa 7)
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        <Flutuantes />
      </body>
    </html>
  );
}
