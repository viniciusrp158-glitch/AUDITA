import type { Metadata } from "next";
import { BookOpenCheck, CalendarRange, ClipboardList, FileSearch, FileText, FolderCheck, GraduationCap, TriangleAlert } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { ChamadaContato } from "@/components/pagina";
import { PaginaProduto } from "@/components/produto";
import { Rodape } from "@/components/rodape";
import { EMPRESA } from "@/content/empresa";

export const metadata: Metadata = {
  title: "Audita PRO",
  description: "Audita PRO, uma solução AUDITA: plataforma para planejar e executar auditorias, com evidências, constatações e relatórios.",
};

/** Funcionalidades do briefing (4.6). A lista final depende da versão homologada: confirmar com o Diretor (Etapa 5). */
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
            paraQuem:
              "Para pequenas e médias empresas que planejam e executam auditorias e precisam manter evidências, constatações, documentos técnicos e treinamentos organizados em um só lugar.",
            resolve: [
              { titulo: "Planejamento e critérios no mesmo lugar", texto: "Plano de auditoria e checklist definidos antes da execução." },
              { titulo: "Evidências e constatações rastreáveis", texto: "Cada constatação ligada às evidências que a sustentam." },
              { titulo: "Relatórios padronizados e claros", texto: "Relatório diário (RDA) e relatório final com o mesmo padrão." },
            ],
            funcionalidades: [
              { nome: "Plano de auditoria", Icone: CalendarRange },
              { nome: "Checklist", Icone: ClipboardList },
              { nome: "Evidências", Icone: FileSearch },
              { nome: "Não conformidades", Icone: TriangleAlert },
              { nome: "Relatório diário (RDA)", Icone: FileText },
              { nome: "Relatório final", Icone: FolderCheck },
              { nome: "Documentos técnicos", Icone: BookOpenCheck },
              { nome: "Gestão de treinamentos", Icone: GraduationCap },
            ],
            contratacao:
              "O Audita PRO é a plataforma usada pela AUDITA na entrega dos seus serviços e pode ser contratado pela sua empresa. Fale com a AUDITA para conhecer a plataforma e montar a proposta.",
            limite:
              "O Audita PRO é uma plataforma de operação e não emite certificação. O selo do emblema faz parte da marca: não é certificado ISO, acreditação nem autorização para atividade certificadora.",
            telas: [
              { codigo: "IMG-24", descricao: "hero azul com mockup grande do sistema (prints reais a enviar)" },
              { codigo: "IMG-06", descricao: "mockup do Audita PRO em notebook (prints reais a enviar)" },
            ],
          }}
        />
        <ChamadaContato mensagem="Olá! Quero conhecer o Audita PRO." />
      </main>
      <Rodape />
    </>
  );
}
