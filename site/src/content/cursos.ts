/**
 * Catálogo dos cursos EAD (Anexo A, seção 2). Só aparecem no site os cursos com `publicado: true`, que devem ser
 * os mesmos publicados na plataforma em /treinamentos (hoje, apenas o L01).
 */
export type Curso = { codigo: string; titulo: string; horas: number; area: "Segurança" | "Saúde" | "Meio Ambiente" | "SGI"; publicado: boolean };

export const CURSOS: Curso[] = [
  { codigo: "L01", titulo: "Segurança do Trabalho: Primeiros Passos para um Ambiente Seguro", horas: 4, area: "Segurança", publicado: true },
  { codigo: "L02", titulo: "Fundamentos de EPI e Proteção Coletiva", horas: 4, area: "Segurança", publicado: false },
  { codigo: "L03", titulo: "Ergonomia no Trabalho: Mais Conforto, Saúde e Produtividade", horas: 4, area: "Saúde", publicado: false },
  { codigo: "L04", titulo: "Sinalização de Segurança: Aprenda a Identificar Riscos e Prevenir Acidentes", horas: 2, area: "Segurança", publicado: false },
  { codigo: "L05", titulo: "Produtos Químicos: Aprenda a Interpretar Rótulos e Fichas de Segurança (FDS)", horas: 4, area: "Segurança", publicado: false },
  { codigo: "L06", titulo: "Prevenção de Incêndios: Como Agir em Situações de Emergência", horas: 4, area: "Segurança", publicado: false },
  { codigo: "L07", titulo: "PGR na Prática: Introdução à Gestão de Riscos Ocupacionais", horas: 8, area: "Segurança", publicado: false },
  { codigo: "L08", titulo: "Análise de Riscos (APR): Aprenda a Identificar Perigos e Prevenir Acidentes", horas: 6, area: "Segurança", publicado: false },
  { codigo: "L09", titulo: "Investigação de Acidentes: Como Identificar Causas e Evitar Recorrências", horas: 8, area: "Segurança", publicado: false },
  { codigo: "L10", titulo: "Inspeções de Segurança na Prática: Da Identificação de Riscos ao Plano de Ação", horas: 6, area: "Segurança", publicado: false },
  { codigo: "L11", titulo: "Higiene Ocupacional: Conheça os Riscos Físicos, Químicos e Biológicos", horas: 6, area: "Saúde", publicado: false },
  { codigo: "L14", titulo: "Saúde Mental no Trabalho: Entenda os Riscos Psicossociais", horas: 6, area: "Saúde", publicado: false },
  { codigo: "L15", titulo: "PCMSO e ASO Descomplicados: O que Gestores Precisam Saber", horas: 4, area: "Saúde", publicado: false },
  { codigo: "L16", titulo: "Liderança em Segurança: Como Engajar Equipes e Prevenir Acidentes", horas: 4, area: "Segurança", publicado: false },
  { codigo: "L17", titulo: "DDS e SIPAT na Prática: Como Criar Campanhas de Segurança que Engajam", horas: 4, area: "Segurança", publicado: false },
  { codigo: "L18", titulo: "Indicadores de Segurança do Trabalho: Como Medir e Melhorar Resultados", horas: 6, area: "SGI", publicado: false },
  { codigo: "L19", titulo: "Sustentabilidade no Trabalho: Pequenas Ações, Grandes Resultados", horas: 4, area: "Meio Ambiente", publicado: false },
  { codigo: "L20", titulo: "Coleta Seletiva na Prática: Como Separar e Destinar Resíduos Corretamente", horas: 4, area: "Meio Ambiente", publicado: false },
  { codigo: "L21", titulo: "Gestão de Resíduos: Entenda o PGRS e as Boas Práticas Ambientais", horas: 8, area: "Meio Ambiente", publicado: false },
  { codigo: "L22", titulo: "Economia Circular: Como Reduzir Desperdícios e Aproveitar Recursos", horas: 4, area: "Meio Ambiente", publicado: false },
  { codigo: "L23", titulo: "Água e Energia: Como Reduzir Desperdícios e Economizar Recursos", horas: 3, area: "Meio Ambiente", publicado: false },
  { codigo: "L24", titulo: "Impactos Ambientais: Como Identificar, Prevenir e Reduzir a Poluição", horas: 4, area: "Meio Ambiente", publicado: false },
  { codigo: "L25", titulo: "MTR na Prática: Entenda o Controle e a Rastreabilidade de Resíduos", horas: 6, area: "Meio Ambiente", publicado: false },
  { codigo: "L26", titulo: "Licenciamento Ambiental: Como Entender e Controlar Condicionantes", horas: 6, area: "Meio Ambiente", publicado: false },
  { codigo: "L27", titulo: "ISO 14001 e ISO 45001: Primeiros Passos na Gestão Ambiental e de Segurança", horas: 8, area: "SGI", publicado: false },
  { codigo: "L28", titulo: "Não Conformidades e Ações Corretivas: Como Resolver Problemas no SGI", horas: 6, area: "SGI", publicado: false },
];

export const cursosPublicados = () => CURSOS.filter((c) => c.publicado);

export const AVISO_CURSO_LIVRE =
  "Cursos livres de capacitação, EAD, com certificado de conclusão (mínimo de 7 acertos em 10). Não substituem capacitação obrigatória de NR, autorização ou registro profissional.";
