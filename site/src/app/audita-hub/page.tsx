import type { Metadata } from "next";
import { ClipboardList, FileText, Flame, FolderCheck, GraduationCap, HardHat, ShieldAlert, Siren, Users } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { ChamadaContato } from "@/components/pagina";
import { PaginaProduto } from "@/components/produto";
import { Rodape } from "@/components/rodape";
import { EMPRESA } from "@/content/empresa";

export const metadata: Metadata = {
  title: "Audita HUB",
  description: "Audita HUB, uma solução AUDITA: plataforma por assinatura para centralizar e acompanhar a rotina de Segurança, Saúde e Meio Ambiente.",
};

/** Funcionalidades do briefing (4.6). A lista final depende da versão homologada: confirmar com o Diretor (Etapa 5). */
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
            paraQuem:
              "Para pequenas e médias empresas que querem reunir a rotina de Segurança, Saúde e Meio Ambiente em uma plataforma, por assinatura, com informações, documentos, prazos e registros sempre à vista.",
            resolve: [
              { titulo: "Informações reunidas", texto: "Colaboradores, EPIs, documentos e ordens de serviço no mesmo lugar." },
              { titulo: "Prazos e registros à vista", texto: "Mais visibilidade sobre a rotina preventiva da empresa." },
              { titulo: "Rotinas de emergência organizadas", texto: "CIPA, brigada e planos de emergência acompanhados." },
            ],
            jornadas: [
              { titulo: "A sua equipe faz a gestão", texto: "A empresa assina o Audita HUB e conduz a própria rotina de SST e Meio Ambiente na plataforma." },
              { titulo: "O HUB junto com a consultoria AUDITA", texto: "A empresa usa o HUB com o acompanhamento dos serviços da AUDITA. A consultoria é um serviço separado da assinatura." },
            ],
            funcionalidades: [
              { nome: "Colaboradores", Icone: Users },
              { nome: "EPIs", Icone: HardHat },
              { nome: "Documentos", Icone: FolderCheck },
              { nome: "Ordens de serviço", Icone: FileText },
              { nome: "CIPA", Icone: ClipboardList },
              { nome: "Brigada de emergência", Icone: Flame },
              { nome: "Riscos ocupacionais", Icone: ShieldAlert },
              { nome: "Treinamentos", Icone: GraduationCap },
              { nome: "Planos de emergência", Icone: Siren },
            ],
            contratacao: "O Audita HUB é contratado por assinatura mensal. Fale com a AUDITA para conhecer a plataforma e escolher a forma de uso.",
            limite: "O Audita HUB é uma licença de software: apoia a organização da rotina, mas não assume a responsabilidade técnica da empresa.",
            telas: [
              { codigo: "IMG-25", descricao: "hero verde com tablet em uso no chão de fábrica (prints reais a enviar)" },
              { codigo: "IMG-07", descricao: "mockup do Audita HUB em tablet ou celular (prints reais a enviar)" },
            ],
          }}
        />
        <ChamadaContato mensagem="Olá! Quero conhecer o Audita HUB." />
      </main>
      <Rodape />
    </>
  );
}
