import type { Metadata } from "next";
import { Cabecalho } from "@/components/cabecalho";
import { ChamadaContato } from "@/components/pagina";
import { PaginaProduto } from "@/components/produto";
import { Rodape } from "@/components/rodape";
import { EMPRESA } from "@/content/empresa";
import { HUB } from "@/content/plataformas";

export const metadata: Metadata = {
  title: "Audita HUB",
  description: "Audita HUB, uma solução AUDITA: trabalhadores, EPIs, inspeções, ações, documentos, CIPA, emergências, capacitações e meio ambiente em um só lugar.",
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
    </>
  );
}
