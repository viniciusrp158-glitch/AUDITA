import type { Metadata } from "next";
import { Cabecalho } from "@/components/cabecalho";
import { ChamadaContato } from "@/components/pagina";
import { PaginaProduto } from "@/components/produto";
import { Rodape } from "@/components/rodape";
import { EMPRESA } from "@/content/empresa";
import { HUB } from "@/content/plataformas";

/** SEO do material da sessão do HUB (S8, 10/11/2026): título, descrição, Open Graph próprio e JSON-LD. */
export const metadata: Metadata = {
  title: { absolute: "Audita HUB · Gestão de SST e Meio Ambiente em um só lugar | AUDITA" },
  description:
    "Audita HUB: indicadores de SSMA, riscos do PGR por GHE e a gestão completa de Segurança do Trabalho e Meio Ambiente em uma plataforma, no computador e no celular.",
  alternates: { canonical: "/audita-hub/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "AUDITA | SSMA & SGI",
    url: "/audita-hub/",
    title: "Audita HUB · A rotina de SSMA em dia, em um só lugar",
    description: "Indicadores, riscos do PGR e a gestão completa de SST e Meio Ambiente, no computador e no celular.",
    images: [{ url: "/images/plataformas/hub-og.jpg", width: 1200, height: 630, alt: "Audita HUB" }],
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Audita HUB",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://audita.seg.br/audita-hub/",
  image: "https://audita.seg.br/images/plataformas/hub-og.jpg",
  description:
    "Plataforma de gestão de Segurança do Trabalho e Meio Ambiente: indicadores, riscos do PGR por GHE, EPIs, inspeções, ações, ocorrências, documentos, CIPA, brigada, capacitações, ordens de serviço, licenças e resíduos.",
  publisher: { "@type": "Organization", name: "AUDITA", url: "https://audita.seg.br" },
  inLanguage: "pt-BR",
};

/** O HUB ainda não foi liberado comercialmente (nota 2 do material): a chamada é "Solicitar demonstração", sem preço. */
export default function AuditaHub() {
  return (
    <>
      <Cabecalho ativo="Plataformas" />
      <main>
        <PaginaProduto
          p={{
            nome: "Audita HUB",
            cor: "var(--hub)",
            corTexto: "var(--green-text)",
            logo: "hub-negativa",
            login: EMPRESA.hubLogin,
            textoBase:
              "Audita HUB é uma solução da AUDITA para centralizar e acompanhar atividades de Segurança, Saúde e Meio Ambiente. A plataforma foi concebida para apoiar empresas na organização de informações, documentos, prazos e registros de sua rotina preventiva, oferecendo maior visibilidade sobre a gestão.",
            chamada: { rotulo: "Solicitar demonstração", mensagem: "Olá! Quero uma demonstração do Audita HUB." },
            contratacao:
              "O Audita HUB funciona por assinatura, com os módulos de que a sua empresa precisar. Fale com a AUDITA e solicite uma demonstração.",
            limites: [
              "O Audita HUB é uma licença de software: apoia a organização da rotina, mas não assume a responsabilidade técnica da empresa nem garante conformidade.",
            ],
            dados: HUB,
          }}
        />
        <ChamadaContato mensagem="Olá! Quero uma demonstração do Audita HUB." />
      </main>
      <Rodape />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
    </>
  );
}
