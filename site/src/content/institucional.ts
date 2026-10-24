import { BadgeCheck, Building2, FileSearch, Leaf, Lightbulb, MonitorSmartphone, Scale, SlidersHorizontal, Smile, TrendingUp, Eye, HeartPulse } from "lucide-react";

/** Textos institucionais aprovados (briefing, seção 4 = AUDDOC002). Não reescrever o sentido. */

export const QUEM_SOMOS =
  "A AUDITA integra conhecimento técnico, gestão preventiva e tecnologia para oferecer soluções em Segurança, Saúde, Meio Ambiente e Sistemas de Gestão, ajudando organizações a administrar suas obrigações, prevenir riscos e aprimorar processos com mais controle, eficiência e tranquilidade.";

export const PUBLICO =
  "Público prioritário: pequenas e médias empresas, de qualquer segmento, que precisam manter suas rotinas de Segurança do Trabalho e Meio Ambiente organizadas mas não têm estrutura interna suficiente para isso.";

export const PROPOSITO =
  "Proporcionar tranquilidade às organizações, transformando a complexidade da gestão de Segurança, Saúde e Meio Ambiente em processos mais simples, preventivos, transparentes e confiáveis.";

export const MISSAO =
  "Oferecer soluções técnicas e tecnológicas em SSMA e SGI que simplifiquem a gestão, fortaleçam a prevenção de riscos e apoiem o atendimento aos requisitos legais e normativos, promovendo ambientes de trabalho mais seguros, responsáveis e eficientes.";

export const VISAO =
  "Ser reconhecida nacionalmente como referência em soluções integradas de Segurança, Saúde, Meio Ambiente e Sistemas de Gestão, conectando empresas, profissionais qualificados e tecnologias inovadoras.";

export const VALORES = [
  { nome: "Ética e responsabilidade", texto: "Integridade, respeito às atribuições profissionais e compromisso com a legislação.", Icone: Scale },
  { nome: "Segurança e valorização da vida", texto: "Prioridade à prevenção de acidentes e à proteção da saúde dos trabalhadores.", Icone: HeartPulse },
  { nome: "Conformidade e excelência técnica", texto: "Orientação com fundamentação técnica e atenção aos requisitos aplicáveis.", Icone: BadgeCheck },
  { nome: "Transparência e confiança", texto: "Comunicação clara de informações, riscos, resultados e pendências.", Icone: Eye },
  { nome: "Inovação com propósito", texto: "Tecnologia para melhorar controles, reduzir retrabalho e ampliar a eficiência.", Icone: Lightbulb },
  { nome: "Responsabilidade ambiental", texto: "Práticas que previnem impactos e promovem a sustentabilidade.", Icone: Leaf },
  { nome: "Melhoria contínua", texto: "Aprimoramento de processos, competências, serviços e soluções digitais.", Icone: TrendingUp },
];

export const DIFERENCIAIS = [
  { titulo: "Gestão orientada à tranquilidade do cliente", texto: "Acompanhamento técnico e informações acessíveis, mais previsibilidade e menos desorganização das obrigações.", Icone: Smile },
  { titulo: "Soluções adaptadas à realidade das pequenas e médias empresas", texto: "Serviços proporcionais às atividades, riscos, estrutura e necessidades de cada organização.", Icone: Building2 },
  { titulo: "Integração entre atendimento técnico e tecnologia", texto: "Plataformas próprias (PRO e HUB) para estruturar processos e organizar registros.", Icone: MonitorSmartphone },
  { titulo: "Rastreabilidade e transparência", texto: "Documentação padronizada, históricos, indicadores e acompanhamento de pendências.", Icone: FileSearch },
  { titulo: "Flexibilidade de contratação", texto: "Serviços pontuais, consultoria recorrente e soluções digitais por assinatura.", Icone: SlidersHorizontal },
];

export const NECESSIDADES = [
  "Acompanhamento técnico periódico de SST e Meio Ambiente",
  "Organização e controle documental",
  "Treinamentos e capacitações",
  "Gestão preventiva de riscos ocupacionais",
  "Rotinas de CIPA e brigada de emergência",
  "Auditorias internas, inspeções e diagnósticos",
  "Controle de prazos, obrigações e ações corretivas",
  "Ferramentas digitais para acompanhar tudo isso",
];

export const PASSOS = ["Diagnóstico", "Plano de ação", "Implantação e treinamento", "Acompanhamento e melhoria contínua"];

/** Formatos de contratação (Anexo A, seção 1.8), sem preços. */
export const FORMATOS = [
  "Consultoria mensal ou atendimento pontual",
  "Treinamentos por turma ou participante",
  "Documentos por projeto",
  "Auditorias e diagnósticos por projeto",
  "Audita HUB por assinatura mensal",
  "Audita PRO como plataforma usada na entrega dos serviços e por empresas contratantes",
];

