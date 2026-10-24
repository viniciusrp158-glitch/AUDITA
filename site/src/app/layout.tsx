import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import { Animacoes } from "@/components/animacoes";
import { Flutuantes } from "@/components/flutuantes";
import { VLibras } from "@/components/vlibras";
import { EMPRESA } from "@/content/empresa";
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

/** Dados estruturados (briefing 10.6): Organization + LocalBusiness com os dados oficiais. */
const DADOS_ESTRUTURADOS = {
  "@context": "https://schema.org",
  "@type": ["Organization", "LocalBusiness"],
  name: EMPRESA.assinatura,
  url: "https://audita.seg.br",
  logo: "https://audita.seg.br/images/marca/audita-positiva.webp",
  slogan: EMPRESA.slogan,
  taxID: EMPRESA.cnpj,
  telephone: "+55-15-99689-1049",
  email: EMPRESA.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: "Rua Oswaldo de Barros, 219 – Hebert de Souza",
    addressLocality: "Sorocaba",
    addressRegion: "SP",
    postalCode: "18079-026",
    addressCountry: "BR",
  },
  areaServed: "Estado de São Paulo",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(DADOS_ESTRUTURADOS) }} />
        {children}
        <Flutuantes />
        <Animacoes />
        <VLibras />
      </body>
    </html>
  );
}
