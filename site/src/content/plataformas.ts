/**
 * Conteúdo das páginas Audita PRO e Audita HUB, do material "audita-pro-e-hub-para-o-site" enviado pelo Diretor em
 * 25/10/2026 (tirado do código e da documentação dos sistemas). Respeita as notas do material:
 * - treinamentos não fazem parte do PRO;
 * - o HUB ainda não foi liberado comercialmente: nada de "contrate agora" nem preço, só "solicite uma demonstração";
 * - ciência no sistema não é assinatura legal (PRO: assinatura via GOV.br fora do sistema; HUB: "registro de ciência");
 * - nenhum dos dois garante conformidade ou certifica; PRO e HUB não trocam dados entre si.
 * Imagens: telas reais com dados fictícios; as que mostram o nome do Diretor ficaram de fora (briefing: sem nome pessoal).
 * S8 (10/11/2026): o HUB ganhou fatos, recursos (Indicadores e PGR), suite de módulos, passos para começar e telas novas,
 * do material da sessão do HUB. Decisões do Diretor: "Documentos técnicos" no lugar de "Documentos e laudos"; manter
 * "Contrate os módulos" e "assinatura" da entrega de EPI como no material.
 */

export type Imagem = { src: string; alt: string; legenda: string; largura: number; altura: number };

export type Plataforma = {
  slug: "audita-pro" | "audita-hub";
  oQueE: string[];
  destaque: Imagem;
  perfis: { nome: string; texto: string }[];
  passos?: { nome: string; texto: string }[];
  jornadas?: { titulo: string; texto: string }[];
  modulos: { nome: string; itens: string[] }[];
  telas: Imagem[];
  celulares: Imagem[];
  diferenciais: { titulo: string; texto: string }[];
  /** Opcionais (S8, página do HUB com o material da sessão do HUB de 10/11/2026) */
  fatos?: { titulo: string; texto: string }[];
  recursos?: { kicker: string; titulo: string; texto: string; itens: string[]; telas: [Imagem, Imagem] }[];
  suite?: { titulo: string; texto: string; grupos: { nome: string; modulos: [string, string][] }[]; todos: string[] };
  comecar?: { texto: string; passos: string[] };
};


export const PRO: Plataforma = {
  slug: "audita-pro",
  oQueE: [
    "O Audita PRO é o sistema em que a AUDITA conduz e documenta auditorias de Segurança do Trabalho, Meio Ambiente, Qualidade e sistemas integrados, como ISO 45001, ISO 14001, ISO 9001 e auditorias integradas de SGI.",
    "Ele acompanha a auditoria do planejamento ao relatório final, e a empresa auditada acompanha tudo em tempo real pelo próprio painel, inclusive no celular. Plano de auditoria, relatórios diários e relatório final são montados a partir dos registros de campo e emitidos em PDF com revisões controladas.",
  ],
  destaque: {
    src: "/images/plataformas/pro-no-celular.webp",
    alt: "Dois celulares com indicadores de auditoria e a linha do tempo do Audita PRO",
    legenda: "A auditoria acompanhada em tempo real, também no celular.",
    largura: 1600,
    altura: 1000,
  },
  perfis: [
    { nome: "Administrador da AUDITA", texto: "Visão de todas as empresas, auditorias, equipes, indicadores e biblioteca de documentos." },
    { nome: "Auditor Líder", texto: "Planeja e conduz as auditorias sob sua responsabilidade, valida e emite os documentos." },
    { nome: "Auditor", texto: "Executa as etapas atribuídas e registra avaliações, evidências e constatações." },
    { nome: "Empresa auditada", texto: "Acompanha a própria auditoria: etapa, próxima atividade, linha do tempo e documentos liberados." },
  ],
  passos: [
    { nome: "Identificação e preparação", texto: "Objetivo, escopo, normas, período e equipe, com o controle do formulário de preparação." },
    { nome: "Cronograma", texto: "Atividades por dia, com local, processo, horário, auditores e requisitos. Etapa não concluída muda de dia sem perder a origem." },
    { nome: "Plano de auditoria", texto: "Validado, congelado como revisão (Rev.00) e emitido em PDF." },
    { nome: "Checklists", texto: "Por norma e edição, com várias normas na mesma auditoria e registro da versão usada." },
    { nome: "Execução em campo", texto: "Respostas por pergunta, fotos e documentos como evidência e não conformidades com plano de ação." },
    { nome: "Relatório Diário de Auditoria", texto: "O RDA nasce do que foi registrado no dia. O Auditor Líder revisa a prévia e emite o PDF." },
    { nome: "Distribuição", texto: "Documentos liberados só para quem tem autorização. A empresa recebe aviso e baixa pelo painel." },
    { nome: "Correção controlada", texto: "Documento emitido não é sobrescrito: a correção vira nova revisão com motivo, e a anterior continua disponível." },
  ],
  modulos: [
    {
      nome: "Painéis por perfil",
      itens: [
        "Quatro visões: Administrador, Auditor Líder, Auditor e empresa auditada",
        "Indicadores com variação em relação ao período anterior e gráficos por mês, etapa, organização ou tipo",
        "Cada número abre a lista exata de auditorias que ele representa; gráficos também em tabela",
        "Listas de atenção: próximas auditorias, prazos ultrapassados e relatórios aguardando validação",
      ],
    },
    {
      nome: "Auditorias",
      itens: [
        "Equipe, participantes e signatários de cada auditoria",
        "Cronograma, plano, checklist, execução e relatório diário (RDA)",
        "PDF emitido no servidor, com modelo versionado e registro de integridade de cada arquivo",
        "Confirmação de ciência pelos signatários e espaço para anexar a cópia assinada via GOV.br",
      ],
    },
    {
      nome: "Checklists e evidências",
      itens: [
        "Biblioteca por norma e edição, com seções, requisitos e perguntas versionados",
        "Auditorias integradas, com critérios de várias normas",
        "Conforme, não conforme, parcialmente conforme, não aplicável ou oportunidade de melhoria",
        "Não conformidades com plano de ação, responsável e prazo",
      ],
    },
    {
      nome: "Biblioteca de documentos",
      itens: ["Biblioteca corporativa com controle de versões e acesso por perfil", "Biblioteca de relatórios por auditoria, com busca e filtros"],
    },
    {
      nome: "Usuários e notificações",
      itens: [
        "Usuários vinculados a empresas, com perfis e permissões individuais",
        "Validação do documento de identificação antes de liberar funções restritas",
        "Avisos no sistema e por e-mail: relatório disponível, documento aguardando validação, nova atividade",
      ],
    },
  ],
  telas: [
    { src: "/images/plataformas/pro-indicadores.webp", alt: "Painel do Audita PRO com cartões de indicadores, gráfico de auditorias por mês e gráfico por etapa", legenda: "Indicadores e gráficos do painel.", largura: 1440, altura: 1044 },
    { src: "/images/plataformas/pro-empresa-auditada.webp", alt: "Painel da empresa auditada com etapa atual, próxima atividade, relatórios disponíveis, linha do tempo e progresso do cronograma", legenda: "O que a empresa auditada vê.", largura: 1440, altura: 900 },
  ],
  celulares: [
    { src: "/images/plataformas/pro-celular-indicadores.webp", alt: "Indicadores do painel do Audita PRO no celular", legenda: "Indicadores no celular", largura: 520, altura: 1125 },
    { src: "/images/plataformas/pro-celular-acompanhamento.webp", alt: "Acompanhamento da auditoria pela empresa no celular", legenda: "Acompanhamento pela empresa", largura: 520, altura: 1125 },
  ],
  diferenciais: [
    { titulo: "Uma única fonte de verdade", texto: "O relatório diário nasce dos registros feitos em campo, sem planilha paralela nem retrabalho." },
    { titulo: "Acompanhamento em tempo real", texto: "Etapa atual, próxima atividade, linha do tempo e relatórios do dia no painel da empresa, inclusive no celular." },
    { titulo: "Documento emitido não muda", texto: "Plano e RDA congelados por revisão, em PDF com registro de integridade. Correção gera nova revisão com motivo." },
    { titulo: "Rastreabilidade completa", texto: "Quem fez, quando e o que mudou em cada alteração, transferência de etapa, emissão e confirmação." },
    { titulo: "Checklists para auditorias integradas", texto: "Critérios de várias normas na mesma auditoria, com biblioteca versionada e evidências ligadas a cada pergunta." },
    { titulo: "Indicadores honestos", texto: "Falta de dados nunca vira zero e nenhum percentual é inventado. Sem base de cálculo, o sistema diz isso." },
    { titulo: "Sigilo por empresa", texto: "Cada empresa só acessa as próprias auditorias. A autorização é conferida no servidor, e os arquivos ficam em armazenamento privado." },
    { titulo: "Documentos prontos", texto: "Plano e relatórios diários gerados pelo sistema, no padrão visual da AUDITA, prontos para distribuir." },
  ],
};

export const HUB: Plataforma = {
  slug: "audita-hub",
  oQueE: [
    "O Audita HUB é a plataforma em que a empresa organiza a própria rotina de Segurança, Saúde e Meio Ambiente. Ele reúne em um só lugar o que normalmente fica espalhado em planilhas, pastas e cadernos.",
    "Trabalhadores, entrega de EPIs, inspeções, ações corretivas, documentos com vencimento, ordens de serviço, CIPA, brigada e emergências, capacitações, licenças ambientais e resíduos, com um painel e um calendário que enxergam todos os prazos de uma vez. A empresa escolhe os módulos de que precisa e quais aparecem para a equipe.",
  ],
  destaque: {
    src: "/images/plataformas/hub-computador-e-celular.webp",
    alt: "Painel do Audita HUB no computador e no celular",
    legenda: "Painel no computador e no celular.",
    largura: 2000,
    altura: 1240,
  },
  perfis: [
    { nome: "Administrador da empresa", texto: "Gerencia usuários, unidades e configurações." },
    { nome: "Responsável SST/SSMA", texto: "Opera os módulos da empresa ou das unidades atribuídas." },
    { nome: "Gestor ou supervisor", texto: "Consulta e trata o que for atribuído nas suas unidades." },
    { nome: "Trabalhador", texto: "Vê os próprios registros (EPIs, ordens de serviço, capacitações) e registra a ciência pelo celular." },
    { nome: "Leitura autorizada", texto: "Consulta, sem editar, nas unidades concedidas." },
  ],
  jornadas: [
    { titulo: "A sua equipe faz a gestão", texto: "A empresa usa o Audita HUB e conduz a própria rotina de SST e Meio Ambiente na plataforma." },
    { titulo: "O HUB junto com a consultoria AUDITA", texto: "A empresa usa o HUB com o acompanhamento dos serviços da AUDITA. A consultoria é um serviço separado." },
  ],
  modulos: [
    { nome: "Painel", itens: ["Indicadores em tempo real: trabalhadores, entregas de EPI, inspeções, desvios, ações e documentos", "Cada indicador explica em uma frase o que está sendo contado"] },
    { nome: "Empresa e trabalhadores", itens: ["Unidades, setores e cargos, com acesso por unidade", "Cadastro com matrícula, sem exigir CPF, e histórico de transferências"] },
    { nome: "EPIs", itens: ["Catálogo com CA e validade, vida útil e prazo de troca", "Estoque por local e entregas, trocas, devoluções e descartes registrados", "Registro de ciência do trabalhador e comprovante de entrega em PDF", "Alertas de CA vencendo, troca prevista e ciência pendente"] },
    { nome: "Inspeções", itens: ["Checklists escritos pela empresa, com versões", "Execução no celular, com observação e foto", "Item não conforme vira ação com um clique"] },
    { nome: "Ações", itens: ["Pendências de todas as origens em um só painel", "Responsável, prioridade, prazo e evidência", "Conclusão com verificação de eficácia e histórico completo"] },
    { nome: "Documentos", itens: ["PGR, PCMSO, LTCAT, AVCB, planos e outros documentos de referência da empresa", "Revisões preservadas e alerta de vencimento", "Situação automática: vigente, a vencer, vencido"] },
    { nome: "Ordens de serviço", itens: ["Modelos por cargo ou atividade, com revisão técnica antes da emissão", "Emissão ao trabalhador com registro de ciência"] },
    { nome: "CIPA", itens: ["Mandatos, membros, reuniões, presenças, atas e ações deliberadas"] },
    { nome: "Brigada e emergências", itens: ["Membros, planos de emergência com revisões e contatos", "Simulados com achados e ações de melhoria"] },
    { nome: "Capacitações", itens: ["Matriz de capacitação por cargo e registros com certificado", "Situação de cada trabalhador: em dia, vencido ou pendente"] },
    { nome: "Meio ambiente", itens: ["Licenças ambientais com validade e lembrete de renovação", "Condicionantes com prazo e responsável", "Destinação de resíduos com MTR e certificado"] },
    { nome: "Prazos, relatórios e avisos", itens: ["Calendário com os prazos de todos os módulos", "Relatório consolidado e exportação em CSV", "Avisos no sistema e por e-mail"] },
  ],
  telas: [
    { src: "/images/plataformas/hub-painel.webp", alt: "Dashboard com índice de gestão SSMA, alertas e gráficos", legenda: "Dashboard com os indicadores da empresa.", largura: 1920, altura: 1200 },
    { src: "/images/plataformas/hub-inspecao.webp", alt: "Inspeção em andamento com itens do checklist", legenda: "Inspeção com checklist próprio.", largura: 1920, altura: 1200 },
    { src: "/images/plataformas/hub-epi-entregas.webp", alt: "Entregas de EPI com troca prevista", legenda: "Entregas de EPI.", largura: 1920, altura: 1200 },
    { src: "/images/plataformas/hub-kanban.webp", alt: "Ações em quadro Kanban por situação", legenda: "Ações no Kanban.", largura: 1920, altura: 1200 },
    { src: "/images/plataformas/hub-calendario.webp", alt: "Calendário com os prazos de todos os módulos", legenda: "Calendário de prazos.", largura: 1920, altura: 1200 },
    { src: "/images/plataformas/hub-documentos.webp", alt: "Documentos com revisão e alerta de vencimento", legenda: "Documentos e vencimentos.", largura: 1920, altura: 1200 },
  ],
  celulares: [
    { src: "/images/plataformas/hub-celular-painel.webp", alt: "Painel no celular", legenda: "Painel: o que vence e o que está atrasado", largura: 780, altura: 1688 },
    { src: "/images/plataformas/hub-celular-inspecao.webp", alt: "Inspeção em campo no celular", legenda: "Inspeção em campo, item por item, com foto", largura: 780, altura: 1688 },
    { src: "/images/plataformas/hub-celular-ambiente.webp", alt: "Licenças ambientais no celular", legenda: "Meio Ambiente: licenças e condicionantes", largura: 780, altura: 1688 },
    { src: "/images/plataformas/hub-celular-minhas-entregas.webp", alt: "Entregas de EPI no acesso do trabalhador", legenda: "Acesso do trabalhador: entregas de EPI e assinatura", largura: 780, altura: 1688 },
  ],
  diferenciais: [
    { titulo: "Tudo de SSMA em um só lugar", texto: "Módulos integrados no lugar de planilhas soltas, com um painel e um calendário que enxergam todos os prazos." },
    { titulo: "Do desvio à solução", texto: "O item não conforme vira ação com responsável, prazo e evidência, e a verificação de eficácia fecha o ciclo." },
    { titulo: "Feito para o campo", texto: "Inspeções, fotos, ações e prazos no celular. O trabalhador registra o recebimento de EPI e a leitura da OS pelo próprio acesso." },
    { titulo: "Histórico que não se apaga", texto: "Registros são inativados ou substituídos com motivo, e as revisões anteriores de documentos continuam disponíveis." },
    { titulo: "Sem presunções normativas", texto: "O HUB não inventa prazos nem periodicidades: cada prazo vem do documento informado ou da norma citada no item." },
    { titulo: "Indicadores que se explicam", texto: "Cada número do painel diz o que conta e nunca mostra zero quando o dado não está disponível." },
    { titulo: "Acesso sob medida", texto: "Perfis por função, acesso por unidade, módulos escolhidos pela empresa e sigilo total entre empresas." },
    { titulo: "Proteção de dados", texto: "CPF não é exigido, os arquivos ficam em armazenamento privado e há rotina de anonimização de trabalhador." },
    { titulo: "Acessível", texto: "Telas testadas contra os critérios WCAG 2.1 (A e AA), no computador e no celular. Situações sempre com texto, nunca só com cor." },
  ],
  fatos: [
    { titulo: "14 módulos", texto: "de SST e Meio Ambiente integrados" },
    { titulo: "Computador e celular", texto: "sem instalar nada" },
    { titulo: "Avisos de prazo", texto: "antes de vencer, no sistema e por e-mail" },
    { titulo: "Dados protegidos", texto: "cada empresa vê só os seus" },
  ],
  recursos: [
    {
      kicker: "Indicadores",
      titulo: "Abra o HUB e saiba exatamente onde agir",
      texto: "O Dashboard reúne os números de todos os módulos em uma tela, e cada indicador explica em uma frase o que está contando.",
      itens: [
        "Índice de gestão SSMA de 0 a 100, com a composição aberta",
        "Ações vencidas, desvios sem ação, documentos a vencer e alertas de EPI",
        "Inspeções e desvios por semana, ações por status e suas tarefas",
        "Filtro por unidade e período, metas da empresa e relatório consolidado",
      ],
      telas: [
        { src: "/images/plataformas/hub-painel.webp", alt: "Dashboard com índice de gestão SSMA, alertas e gráficos", legenda: "", largura: 1920, altura: 1200 },
        { src: "/images/plataformas/hub-relatorio.webp", alt: "Relatório consolidado da empresa", legenda: "", largura: 1920, altura: 1200 },
      ],
    },
    {
      kicker: "PGR",
      titulo: "Os riscos do PGR organizados e ligados à rotina",
      texto: "Monte o inventário de riscos por Grupo Homogêneo de Exposição, com a matriz de risco da empresa, e deixe que o HUB leve isso para o dia a dia.",
      itens: [
        "GHE com setores, cargos e trabalhadores vinculados",
        "Probabilidade × severidade com o nível de risco calculado",
        "Medidas existentes e propostas para cada risco",
        "EPIs e capacitações exigidos por GHE, cobrados nas entregas e na matriz de treinamentos",
      ],
      telas: [
        { src: "/images/plataformas/hub-pgr-matriz.webp", alt: "Matriz de risco do PGR", legenda: "", largura: 1920, altura: 1200 },
        { src: "/images/plataformas/hub-pgr.webp", alt: "Lista de GHE com riscos e maior nível", legenda: "", largura: 1920, altura: 1200 },
      ],
    },
  ],
  suite: {
    titulo: "Toda a rotina de SST e Meio Ambiente, conectada",
    texto: "Contrate os módulos de que a empresa precisa. Um conversa com o outro: o desvio vira ação, o prazo vai para o calendário, o GHE define o EPI.",
    grupos: [
      {
        nome: "Segurança e Saúde do Trabalho",
        modulos: [
          ["EPIs e uniformes", "Estoque, entregas, assinatura e ficha em PDF"],
          ["Inspeções", "Checklists próprios, no celular, com fotos"],
          ["Ações e Kanban", "Responsável, prazo, evidência e eficácia"],
          ["Ocorrências", "5 porquês, Ishikawa, 5W2H e CAT"],
          ["Documentos técnicos", "Revisões e alerta de vencimento"],
          ["Ordens de serviço", "Emissão e ciência do trabalhador"],
          ["CIPA", "Eleição com urna, reuniões e atas"],
          ["Brigada e emergências", "Planos, contatos e simulados"],
          ["Capacitações", "Matriz por cargo e vencimentos"],
          ["Trabalhadores", "Cadastro, lotação e histórico"],
        ],
      },
      {
        nome: "Meio Ambiente",
        modulos: [
          ["Licenças e condicionantes", "Validade, renovação, prazo e responsável"],
          ["Resíduos", "Saídas, inventário e notas fiscais"],
          ["LAIA", "Aspectos e impactos ambientais"],
          ["Indicadores ambientais", "Geração e custos por período"],
        ],
      },
    ],
    todos: ["Calendário de prazos", "Avisos e notificações", "PDF e CSV", "Trilha de auditoria", "Perfis e acesso por unidade", "Tema claro e escuro"],
  },
  comecar: {
    texto: "Assinatura com os módulos de que você precisa, usada pela sua equipe ou junto com a consultoria AUDITA.",
    passos: ["Demonstração", "Configuração dos módulos e acessos", "Equipe usando no dia a dia"],
  },
};
