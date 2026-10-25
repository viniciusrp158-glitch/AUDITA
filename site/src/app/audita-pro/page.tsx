import type { Metadata } from "next";
import { Cabecalho } from "@/components/cabecalho";
import { ChamadaContato } from "@/components/pagina";
import { PaginaProduto } from "@/components/produto";
import { Rodape } from "@/components/rodape";
import { EMPRESA } from "@/content/empresa";
import { PRO } from "@/content/plataformas";

export const metadata: Metadata = {
  title: "Audita PRO",
  description: "Audita PRO, uma solução AUDITA: planejamento, execução e relatórios de auditorias de SSMA e SGI, com acompanhamento da empresa em tempo real.",
  alternates: { canonical: "/audita-pro/" },
};

export default function AuditaPro() {
  return (
    <>
      <Cabecalho ativo="Plataformas" />
      <main>
        <PaginaProduto
          p={{
            nome: "Audita PRO",
            cor: "var(--pro)",
            corTexto: "var(--pro-text)",
            logo: "pro-negativa",
            login: EMPRESA.proLogin,
            textoBase:
              "Audita PRO é a plataforma digital da AUDITA para organizar e apoiar a execução de auditorias e a gestão dos registros associados. Integra planejamento, critérios, evidências, constatações e relatórios, com foco em rastreabilidade, padronização e clareza das informações.",
            chamada: { rotulo: "Quero conhecer", mensagem: "Olá! Quero conhecer o Audita PRO." },
            contratacao:
              "O Audita PRO é a plataforma em que a AUDITA conduz as auditorias contratadas: a sua empresa acompanha cada etapa pelo próprio painel. Ele também é usado por empresas contratantes. Fale com a AUDITA para conhecer a plataforma e montar a proposta.",
            limites: [
              "O Audita PRO apoia, organiza e dá rastreabilidade às auditorias, mas não emite certificação nem garante conformidade. O selo do emblema faz parte da marca: não é certificado ISO, acreditação nem autorização para atividade certificadora.",
              "A confirmação de ciência dentro do sistema não é assinatura com validade jurídica: a assinatura é feita pelo GOV.br e a cópia assinada é anexada à auditoria.",
            ],
            dados: PRO,
          }}
        />
        <ChamadaContato mensagem="Olá! Quero conhecer o Audita PRO." />
      </main>
      <Rodape />
    </>
  );
}
