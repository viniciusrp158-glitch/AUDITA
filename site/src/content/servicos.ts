/**
 * Serviços por família (Anexo A do briefing, seções 1.1 a 1.5; liberados pelo Vinicius em 23/10/2026).
 * `descricao` respeita a coluna "Limite" do anexo, obrigatória no texto público. Para tirar um serviço do site,
 * troque `publicado` para false. A seção 1.7 (laudos, PCMSO, certificação acreditada) não entra no site.
 */
export type Servico = { codigo: string; nome: string; descricao: string; publicado: boolean };

export type Familia = {
  slug: string;
  nome: string;
  pilar: "Segurança e Saúde do Trabalho" | "Meio Ambiente" | "Sistemas de Gestão (SGI)";
  resumo: string;
  aviso?: string;
  servicos: Servico[];
  extra?: { titulo: string; itens: string[]; nota: string };
};

export const FAMILIAS: Familia[] = [
  {
    slug: "gestao-recorrente-de-sst",
    nome: "Gestão recorrente de SST",
    pilar: "Segurança e Saúde do Trabalho",
    resumo: "Suporte periódico em rotinas de SST, sem assumir obrigações do empregador nem substituir SESMT legalmente exigido.",
    servicos: [
      { codigo: "SST-001", nome: "Consultoria recorrente de SST para pequenas empresas", descricao: "Visitas, orientação, registros e acompanhamento. Não substitui SESMT dimensionado.", publicado: true },
      { codigo: "SST-002", nome: "Inspeções periódicas de SST", descricao: "Inspeção, apontamentos e relatório de inspeção. Não é laudo.", publicado: true },
      { codigo: "SST-004", nome: "Apoio ao controle e entrega de EPIs", descricao: "Registros de entrega, conservação e substituição.", publicado: true },
      { codigo: "SST-006", nome: "Organização administrativa das rotinas da CIPA", descricao: "Agenda, atas, ações e acompanhamento, preservadas as competências da comissão.", publicado: true },
      { codigo: "SST-007", nome: "Apoio à organização da brigada de emergência", descricao: "Reuniões, documentos e exercícios. Não é formação de brigadista.", publicado: true },
      { codigo: "SST-008", nome: "Apoio ao acompanhamento de planos de emergência", descricao: "Organização, registros e simulados.", publicado: true },
      { codigo: "SST-010", nome: "Acompanhamento de indicadores e planos de ação", descricao: "Consolidação e monitoramento dos controles da empresa.", publicado: true },
    ],
  },
  {
    slug: "documentos-e-procedimentos",
    nome: "Documentos e procedimentos",
    pilar: "Segurança e Saúde do Trabalho",
    resumo: "Ordens de serviço, procedimentos, relatórios de inspeção, PGR/GRO, APR e triagem ergonômica.",
    servicos: [
      { codigo: "SST-005", nome: "Ordens de serviço e procedimentos operacionais de SST", descricao: "Elaboração de ordens de serviço e procedimentos. Sem projetos ou laudos especializados.", publicado: true },
      { codigo: "SST-009", nome: "Relatório técnico de inspeções com registro fotográfico", descricao: "Relatório de constatações com fotos. Não é laudo.", publicado: true },
      { codigo: "DOC-001", nome: "Apoio à estruturação e manutenção do PGR/GRO", descricao: "Inventário de riscos e plano de ação. A responsabilidade pelo programa é da organização.", publicado: true },
      { codigo: "DOC-002", nome: "APR — Análise Preliminar de Riscos", descricao: "Análise de riscos por tarefa ou atividade.", publicado: true },
      { codigo: "DOC-003", nome: "Avaliação ergonômica preliminar (triagem)", descricao: "Triagem ergonômica. Não é AET aprofundada.", publicado: true },
    ],
  },
  {
    slug: "treinamentos-in-company",
    nome: "Treinamentos in company",
    pilar: "Segurança e Saúde do Trabalho",
    resumo: "Treinamentos por turma na sua empresa, DDS, campanhas e ações educativas de SST.",
    servicos: [
      { codigo: "SST-003", nome: "DDS, campanhas e conscientização de SST", descricao: "Diálogos de segurança, campanhas e ações educativas. Não substituem treinamentos obrigatórios.", publicado: true },
      { codigo: "TRN-001", nome: "Integração e orientações introdutórias de SST", descricao: "Conteúdo definido conforme o contexto da empresa.", publicado: true },
      { codigo: "TRN-002", nome: "Treinamento sobre uso de EPI (NR-6)", descricao: "Uso, guarda e conservação de EPI, conforme a NR-6.", publicado: true },
      { codigo: "TRN-003", nome: "Treinamento de CIPA (NR-5)", descricao: "Conforme os requisitos da empresa.", publicado: true },
      { codigo: "TRN-004", nome: "Brigada e combate a incêndios", descricao: "Conteúdo sujeito às regras do Corpo de Bombeiros de São Paulo.", publicado: true },
    ],
    extra: {
      titulo: "Treinamentos por norma",
      itens: [
        "NR-01 Integração",
        "NR-06 EPI",
        "NR-05 CIPA",
        "NR-11 Empilhadeira",
        "NR-11 Ponte rolante",
        "NR-17 Ergonomia",
        "NR-20 Curso básico",
        "NR-26 Sinalização",
        "NR-26 Produtos químicos e FDS",
        "NR-23 Prevenção de incêndios",
        "NR-33 Espaços confinados (presencial)",
        "NR-35 Trabalho em altura (presencial)",
      ],
      nota: "Treinamentos in company, por turma. A lista mostra as normas atendidas hoje.",
    },
  },
  {
    slug: "auditorias-internas-e-sgi",
    nome: "Auditorias internas e SGI",
    pilar: "Sistemas de Gestão (SGI)",
    resumo: "Auditorias internas, auditoria de fornecedores e diagnóstico preparatório para sistemas de gestão.",
    aviso: "Nenhuma oferta representa certificação acreditada. Auditoria interna e diagnóstico não são certificação.",
    servicos: [
      { codigo: "AUD-001", nome: "Auditoria interna de SST e conformidade de NR", descricao: "Auditoria interna. Não é certificação.", publicado: true },
      { codigo: "AUD-002", nome: "Auditoria interna de SGI (ISO 9001, 14001, 45001)", descricao: "Auditoria interna. Não é certificação.", publicado: true },
      { codigo: "AUD-003", nome: "Auditoria de fornecedores (segunda parte)", descricao: "Avaliação de fornecedores pela sua empresa. Não é certificação de terceira parte.", publicado: true },
      { codigo: "AUD-004", nome: "Diagnóstico preparatório para certificação SGI", descricao: "Diagnóstico e consultoria de preparação. Não é certificação.", publicado: true },
    ],
  },
  {
    slug: "meio-ambiente",
    nome: "Meio Ambiente",
    pilar: "Meio Ambiente",
    resumo: "Controle documental ambiental, prazos e apoio às rotinas de resíduos.",
    servicos: [
      { codigo: "AMB-001", nome: "Controle documental ambiental e gestão de vencimentos", descricao: "Gestão administrativa de documentos e prazos ambientais.", publicado: true },
      { codigo: "AMB-002", nome: "Apoio a registros de resíduos e rotinas ambientais", descricao: "Apoio aos registros. Não substitui responsável técnico especializado.", publicado: true },
    ],
  },
];

export function servicosPublicados(f: Familia): Servico[] {
  return f.servicos.filter((s) => s.publicado);
}

export function familia(slug: string): Familia | undefined {
  return FAMILIAS.find((f) => f.slug === slug);
}
