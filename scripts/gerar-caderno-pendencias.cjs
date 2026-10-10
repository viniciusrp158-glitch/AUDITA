/* eslint-disable @typescript-eslint/no-require-imports */
// Gera docs/Caderno_Pendencias_Sistema_AUDITA_v1.0.docx (uso: node scripts/gerar-caderno-pendencias.cjs [saída.docx]).
// Caderno de pendências do Sistema AUDITA real — gerador do .docx
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType,
  HeadingLevel, BorderStyle, LevelFormat, Header, Footer, PageNumber, PageOrientation, ImageRun, PageBreak,
  VerticalAlign, TableLayoutType,
} = require("docx");

const NAVY = "031B35", GREEN = "4A9F1A", MUTED = "66758A", LINE = "D9E2E9", INPUT = "FFF6CC", HEAD = "E8EEF4", WARN = "FDECEB";
const FONT = "Arial";
const A4 = { width: 11906, height: 16838 };
const MARGIN = 1134; // 20 mm
const W = A4.width - 2 * MARGIN; // 9638
const WL = A4.height - 2 * MARGIN; // 14570 (paisagem)

const svc = JSON.parse(fs.readFileSync(path.join(__dirname, "caderno-auddoc004.json"), "utf8"));
const logo = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "documents", "assets", "logo.png"));

// ---------- utilitários de texto
function runs(text, base = {}) {
  // **negrito**
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p) =>
    p.startsWith("**") ? new TextRun({ text: p.slice(2, -2), bold: true, font: FONT, ...base }) : new TextRun({ text: p, font: FONT, ...base }),
  );
}
const P = (text, o = {}) =>
  new Paragraph({ spacing: { after: o.after ?? 120, before: o.before ?? 0, line: 276 }, alignment: o.align, keepNext: o.keepNext, children: runs(text, { size: o.size ?? 20, color: o.color, italics: o.italics, bold: o.bold }) });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun({ text: t, font: FONT })] });
const H1np = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: FONT })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text: t, font: FONT })] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, children: [new TextRun({ text: t, font: FONT })] });
const B = (t, level = 0) => new Paragraph({ numbering: { reference: "bul", level }, spacing: { after: 60, line: 264 }, children: runs(t, { size: 20 }) });
const N = (t) => new Paragraph({ numbering: { reference: "num", level: 0 }, spacing: { after: 60, line: 264 }, children: runs(t, { size: 20 }) });

// ---------- tabelas
const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };
function cell(content, width, o = {}) {
  const paras = (Array.isArray(content) ? content : [content]).map((c) =>
    c instanceof Paragraph ? c : new Paragraph({ spacing: { after: 40, line: 252 }, alignment: o.align, children: runs(c, { size: o.size ?? 18, bold: o.bold, color: o.color }) }),
  );
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: o.valign ?? VerticalAlign.TOP,
    columnSpan: o.span,
    children: paras,
  });
}
function table(widths, header, rows, o = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const trs = [];
  if (header)
    trs.push(new TableRow({ tableHeader: true, cantSplit: true, children: header.map((h, i) => cell(h, widths[i], { fill: NAVY, color: "FFFFFF", bold: true, size: 17 })) }));
  for (const r of rows)
    trs.push(
      new TableRow({
        cantSplit: o.cantSplit ?? true,
        children: r.map((c, i) => (c && c.__cell ? cell(c.v, widths[i], c.o) : cell(c ?? "", widths[i], { fill: o.fills?.[i], size: o.size }))),
      }),
    );
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows: trs });
}
const C = (v, o) => ({ __cell: true, v, o });
const IN = (v = "") => C(v, { fill: INPUT, color: "1F3A93" }); // campo de resposta (amarelo, como no ANX01)
const spacer = () => new Paragraph({ spacing: { after: 80 }, children: [] });

// ---------- bloco padrão de pendência
let fieldNo = 0;
function bloco(p) {
  const out = [];
  out.push(H2(`${p.id} — ${p.titulo}`));
  out.push(
    table(
      [2200, W - 2200],
      null,
      [
        [C("AUDDOC de referência", { fill: HEAD, bold: true }), p.auddoc],
        [C("Quem responde", { fill: HEAD, bold: true }), p.quem],
        [C("Bloqueia o uso real?", { fill: HEAD, bold: true }), p.bloqueia],
        ...(p.gate ? [[C("Prontidão (AUDDOC015-ANX01)", { fill: HEAD, bold: true }), p.gate]] : []),
        [C("Onde entra no sistema", { fill: HEAD, bold: true }), p.sistema],
        [C("Lista de pendências", { fill: HEAD, bold: true }), p.lista],
      ],
    ),
  );
  out.push(spacer());
  if (p.contexto) out.push(P(p.contexto));
  if (p.extraAntes) out.push(...p.extraAntes);
  if (p.fazer?.length) {
    out.push(H3("O que precisa ser feito / decidido"));
    p.fazer.forEach((f) => out.push(B(f)));
  }
  if (p.campos?.length) {
    out.push(H3("Campos para responder"));
    out.push(
      table(
        [850, 4250, W - 5100],
        ["Nº", "Pergunta / dado necessário", "Resposta"],
        p.campos.map((c) => {
          const id = `${p.id}.${String(++fieldNo).padStart(2, "0")}`;
          const q = typeof c === "string" ? c : c.q;
          const hint = typeof c === "string" ? null : c.dica;
          const opts = typeof c === "string" ? null : c.opcoes;
          return [
            C(id, { size: 16, color: MUTED }),
            C(hint ? [q, new Paragraph({ spacing: { after: 20 }, children: runs(hint, { size: 16, color: MUTED, italics: true }) })] : q),
            IN(opts ? opts.map((x) => `☐ ${x}`).join("    ") : ""),
          ];
        }),
      ),
    );
    fieldNo = 0;
  }
  if (p.extra) out.push(...p.extra);
  if (p.anexos?.length) {
    out.push(H3("Comprovantes para anexar"));
    p.anexos.forEach((a) => out.push(B(a)));
  }
  out.push(H3("Como será aplicado no sistema"));
  p.aplicar.forEach((a) => out.push(B(a)));
  out.push(spacer());
  return out;
}

// =====================================================================================
// CONTEÚDO
// =====================================================================================
const capa = [
  new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 400 }, children: [new ImageRun({ type: "png", data: logo, transformation: { width: 180, height: 60 } })] }),
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "SISTEMA AUDITA DE OPERAÇÃO", font: FONT, size: 20, bold: true, color: GREEN })] }),
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Caderno de pendências para o sistema real", font: FONT, size: 44, bold: true, color: NAVY })] }),
  P("O que cada responsável precisa definir, preencher ou comprovar para o sistema operar com clientes reais — com campos para resposta e a referência ao AUDDOC de cada item.", { size: 24, color: MUTED, after: 400 }),
  table(
    [2600, W - 2600],
    null,
    [
      [C("Documento", { fill: HEAD, bold: true }), "Caderno de pendências — documento técnico de trabalho (não é um AUDDOC; não altera documentos aprovados)"],
      [C("Versão / data", { fill: HEAD, bold: true }), "v1.0 — 10/10/2026"],
      [C("Base oficial", { fill: HEAD, bold: true }), "AUDDOC017 Rev.00 e AUDDOC001–AUDDOC015 (versões aprovadas). Em divergência, prevalecem os documentos aprovados."],
      [C("Origem", { fill: HEAD, bold: true }), "Homologação do MVP (I9) — lista final de pendências (docs/PENDENCIAS_SISTEMA_REAL.md, itens 1 a 27)"],
      [C("Destinatário", { fill: HEAD, bold: true }), "Vinicius Rocha Pereira — Diretor (repassar as seções 3 e 4 à contabilidade e à assessoria jurídica)"],
      [C("Situação do sistema", { fill: HEAD, bold: true }), "MVP homologado no ambiente de desenvolvimento, somente com dados fictícios. Nenhum serviço liberado, nenhum parâmetro real e nenhuma publicação em produção."],
    ],
  ),
  spacer(),
  new Paragraph({
    spacing: { before: 200 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: GREEN, space: 8 } },
    children: runs("**Objetivo:** responder neste próprio arquivo, devolver ao desenvolvimento e o sistema será configurado com as respostas, com testes e evidência registrada. Itens sem resposta continuam PENDENTES no sistema — nada é inventado.", { size: 20 }),
  }),
];

const comoUsar = [
  H1("1. Como usar este caderno"),
  N("Cada pendência tem um código (ex.: **C1**, **J2**, **D3**) e informa o **AUDDOC** em que se baseia, **quem responde**, se **bloqueia** o uso real e **onde entra no sistema**."),
  N("Preencha somente as células **amarelas** (mesma convenção do AUDDOC011-ANX01: amarelo = dado de entrada). Nas opções, troque ☐ por ☒ na escolhida."),
  N("Se ainda não souber, escreva **PENDENTE** ou deixe em branco: o sistema continuará bloqueando o que depende daquela informação. Não é preciso estimar."),
  N("Anexe os comprovantes pedidos (cartão CNPJ, certificados, pareceres). Comprovantes com dados pessoais devem ir por canal seguro, não por grupos de mensagem."),
  N("Devolva o arquivo. Cada resposta será aplicada no sistema, testada e registrada no histórico de desenvolvimento, com referência ao código da pergunta (ex.: **C1.03**)."),
  spacer(),
  H2("1.1 Ordem recomendada"),
  table(
    [1500, 3200, W - 4700],
    ["Etapa", "O que", "Por quê"],
    [
      ["1 (em paralelo)", "Seção 3 — Contabilidade/Fiscal e Seção 4 — Jurídico", "São as respostas mais demoradas e bloqueiam o piloto com cliente real (gate G1 do AUDDOC015)."],
      ["1 (em paralelo)", "Seção 5 — Decisões do Diretor", "Liberação de serviços, parâmetros da Direção e condições comerciais podem andar junto com a contabilidade."],
      ["2", "Ajustes do sistema (seção 6.1)", "Desenvolvimento aplica as respostas: dados institucionais, I9.1 (usuários e tema), e-mail."],
      ["3", "Seção 6 — Implantação", "Só com a sua autorização expressa e com os bloqueios das etapas 1 e 2 resolvidos."],
    ],
  ),
  spacer(),
  H2("1.2 Legenda"),
  table(
    [2600, W - 2600],
    null,
    [
      [C("Bloqueia o uso real?", { fill: HEAD, bold: true }), "Sim = o sistema não deve operar com clientes reais sem isso. Não = pode ser resolvido depois, sem risco ao uso inicial."],
      [C("Gate G1 / G2", { fill: HEAD, bold: true }), "Níveis de prontidão do AUDDOC015: G1 = piloto assistido com cliente real; G2 = lançamento comercial. R0xx = requisito da matriz AUDDOC015-ANX01."],
      [C("C / J / D / I", { fill: HEAD, bold: true }), "C = contabilidade/fiscal; J = jurídico; D = Diretor; I = implantação (Diretor autoriza, desenvolvimento executa)."],
    ],
  ),
];

const resumo = [
  H1("2. Resumo — o que falta, por responsável"),
  P("Visão rápida para distribuir o trabalho. O detalhamento de cada item está nas seções seguintes."),
  H2("2.1 Contabilidade / fiscal — o que precisamos deles"),
  table(
    [800, 5000, 2000, W - 7800],
    ["Item", "Decisão / informação", "AUDDOC", "Bloqueia?"],
    [
      ["C1", "Abertura da empresa: razão social, CNPJ, CNAEs, inscrições, regime tributário, emissão de NFS-e", "AUDDOC010 §7; AUDDOC015", "Sim"],
      ["C2", "Percentual de tributos sobre a receita (e se varia por tipo de serviço) e retenções", "AUDDOC011 §5; ANX01", "Sim"],
      ["C3", "Pró-labore: valor e encargos (com a decisão do Diretor)", "AUDDOC011 §5; ANX01", "Sim"],
      ["C4", "Despesas fixas mensais da operação", "AUDDOC011 §5; ANX01", "Sim"],
      ["C5", "Taxas de cobrança por meio de pagamento", "AUDDOC011 §5; ANX01", "Sim"],
      ["C6", "Emissão fiscal, cobrança e recebimento", "AUDDOC015 R030; AUDDOC011 §7", "Sim (G2)"],
    ],
  ),
  spacer(),
  H2("2.2 Jurídico — quais decisões e pendências jurídicas existem"),
  table(
    [800, 5000, 2000, W - 7800],
    ["Item", "Decisão / revisão", "AUDDOC", "Bloqueia?"],
    [
      ["J1", "Revisão da proposta M01 e do orçamento M02 (os modelos que o sistema emite) e cláusulas padrão", "AUDDOC010 §3, §7; ANX01, ANX02", "Sim"],
      ["J2", "Contrato M04 para serviços mensais e demais anexos (M03, M05, M06)", "AUDDOC010 §2, §7; ANX03–ANX06", "Sim, para mensais"],
      ["J3", "LGPD: termo do autocadastro, aviso de privacidade, papéis e operadores", "AUDDOC013 §8; AUDDOC017 §10", "Sim"],
      ["J4", "Prazos de retenção e descarte dos registros", "AUDDOC013 §9, §14", "Sim (G1)"],
      ["J5", "Validade do aceite por e-mail e necessidade de assinatura eletrônica", "AUDDOC017 §18; AUDDOC010 M01 §6", "Não"],
      ["J6", "Marca, assinatura de relatórios e limites de responsabilidade técnica", "AUDDOC004 (Pendências 13 e 15)", "Sim (G2)"],
    ],
  ),
  spacer(),
  H2("2.3 Diretor — o que falta definir e preencher"),
  table(
    [800, 5000, 2000, W - 7800],
    ["Item", "Definição / preenchimento", "AUDDOC", "Bloqueia?"],
    [
      ["D1", "Parâmetros da Direção: horas faturáveis, contingência, margem-alvo, desconto máximo, comissão", "AUDDOC011 §5; ANX01", "Sim"],
      ["D2", "Política de desconto por família de serviços", "AUDDOC011 §6, §8", "Não"],
      ["D3", "Liberação dos 33 serviços e das 12 ofertas de treinamento", "AUDDOC004; AUDDOC005 §14", "Sim"],
      ["D4", "Habilitações e comprovações do responsável técnico", "AUDDOC004 (Habilitações)", "Sim"],
      ["D5", "Condições comerciais padrão das propostas", "AUDDOC010 M01 §4; AUDDOC011 §8", "Não"],
      ["D6", "Dados institucionais que aparecem nas propostas", "AUDDOC013; AUDDOC010 M01; AUDDOC015 §2", "Sim"],
      ["D7", "Usuários e permissões por nível (I9.1)", "AUDDOC017 §1, §10; AUDDOC013 §8", "Não"],
      ["D8", "Remetente de e-mails do sistema", "AUDDOC017 §10", "Sim"],
      ["D9", "Metas dos indicadores", "AUDDOC017 §14", "Não"],
      ["D10", "Documentos da biblioteca: AUDDOC001 aprovado; títulos do AUDDOC014/015", "AUDDOC001; AUDDOC017 §18", "Não"],
      ["D11", "Escopo do piloto e decisões dos gates G1/G2", "AUDDOC015 §3, §6", "Sim"],
    ],
  ),
  spacer(),
  H2("2.4 Implantação — decisões que dependem da sua autorização"),
  table(
    [800, 5000, 2000, W - 7800],
    ["Item", "Decisão", "AUDDOC", "Bloqueia?"],
    [
      ["I1", "Banco de produção (corporativo compartilhado com o PRO ou separado) e plano de backup", "AUDDOC017 §11, §18; AUDDOC013 §14", "Sim"],
      ["I2", "Publicação na Vercel e endereço (subdomínio do audita.seg.br)", "AUDDOC017 §18", "Sim"],
      ["I3", "Segurança das contas: MFA e proteção contra senhas vazadas", "AUDDOC017 §10", "Sim"],
      ["I4", "Carga inicial, ensaio de restauração e regressão em produção", "AUDDOC017 §10, §15", "Sim"],
    ],
  ),
];

// ------------------------------------------------------------- SEÇÃO 3 — CONTABILIDADE
const contab = [
  H1("3. Contabilidade e fiscal"),
  P("Estas respostas alimentam o cabeçalho das propostas (dados da AUDITA) e os **parâmetros financeiros** do AUDDOC011-ANX01, que o sistema usa para calcular custo/hora e preço sugerido. Sem elas, todo orçamento continua **PENDENTE: CUSTOS / PARÂMETROS** e sem preço (AUDDOC011 §8; AUDDOC017 CA-05)."),
  P("Fórmulas que o sistema aplica (AUDDOC011 §4), para referência do contador:", { keepNext: true }),
  B("Custo interno por hora = (pró-labore mensal + despesas fixas mensais) ÷ horas faturáveis por mês."),
  B("Custo com contingência = (horas do serviço × custo/hora + despesas diretas) × (1 + contingência)."),
  B("Preço sugerido = custo com contingência ÷ [1 − (tributos + taxas de recebimento + comissão + margem-alvo)] — só existe se a soma for menor que 100%."),
  B("Margem efetiva = (preço após desconto − custo com contingência − tributos, taxas e comissão sobre o preço) ÷ preço após desconto."),
  spacer(),
  ...bloco({
    id: "C1",
    titulo: "Formalização da empresa",
    auddoc: "AUDDOC010 §7 (revisões jurídicas, fiscais e técnicas pendentes); AUDDOC015 §2 e §5; AUDDOC004 — Habilitações e Pendências (ordem 12)",
    quem: "Contabilidade (com o Diretor)",
    bloqueia: "Sim — nenhuma proposta pode ser emitida em nome de empresa inexistente (AUDDOC010, condição de uso). Hoje as propostas mostram “AUDITA — razão social e CNPJ pendentes de formalização”.",
    gate: "G1 — R014 (empresa formalizada) e R015 (enquadramento fiscal e emissão fiscal verificados)",
    sistema: "Configurações → Dados institucionais (tela a construir após a resposta) e cabeçalho/rodapé dos documentos M01 e M02",
    lista: "Item 1 (e item 13 — tela de dados institucionais)",
    contexto: "Sede planejada em Sorocaba/SP (AUDDOC015 §2). A AUDITA ainda não tem CNPJ, contrato social, enquadramento tributário, inscrição municipal nem emissão fiscal (AUDDOC004 — Habilitações).",
    fazer: [
      "Concluir a abertura da empresa e informar os dados oficiais abaixo.",
      "Confirmar com o contador quais **CNAEs** cobrem cada família de serviço pretendida (consultoria SST, treinamentos, documentos, auditorias internas, meio ambiente e software/SaaS). Um serviço sem CNAE compatível não deve ser liberado (ver D3).",
      "Confirmar como será emitida a **NFS-e** em Sorocaba/SP (ou no município da sede).",
    ],
    campos: [
      "Razão social",
      "Nome fantasia (se houver)",
      "CNPJ",
      "Data de abertura",
      { q: "Natureza jurídica", opcoes: ["MEI", "EI / SLU", "LTDA", "Outra:"] },
      "Endereço completo da sede (logradouro, número, bairro, CEP, município/UF)",
      "CNAE principal (código e descrição)",
      { q: "CNAEs secundários (código e descrição)", dica: "Indicar, para cada família de serviço, qual CNAE a cobre." },
      "Inscrição municipal",
      { q: "Inscrição estadual", opcoes: ["Não se aplica", "Número:"] },
      { q: "Regime tributário", opcoes: ["Simples Nacional", "Lucro Presumido", "Outro:"] },
      { q: "Anexo / faixa do Simples ou observação do enquadramento (se aplicável)" },
      { q: "Sistema de emissão de NFS-e do município e data prevista para emitir a primeira nota" },
    ],
    anexos: ["Cartão CNPJ", "Contrato social ou requerimento de empresário", "Comprovante de inscrição municipal / cadastro de NFS-e"],
    aplicar: [
      "Cadastro dos dados institucionais (nova tela em Configurações) e substituição do texto “pendentes de formalização” nos documentos emitidos; nova versão técnica dos modelos M01/M02 se o texto mudar.",
      "Registro no histórico e evidência no AUDDOC015-ANX01 (R014/R015) pelo Diretor.",
    ],
  }),
  ...bloco({
    id: "C2",
    titulo: "Tributos sobre a receita e retenções",
    auddoc: "AUDDOC011 §4.5, §5 (“Tributação efetiva / retenções — contador após abertura e enquadramento”); AUDDOC011-ANX01, aba Parâmetros, célula B11",
    quem: "Contabilidade",
    bloqueia: "Sim — sem a alíquota, o preço sugerido não é calculado.",
    gate: "G2 — R029 (parâmetros reais de custo, horas, tributos, margem e descontos)",
    sistema: "Configurações → Parâmetros financeiros → “Tributos estimados sobre receita (%)”",
    lista: "Item 2",
    contexto: "Hoje o sistema aplica **um único percentual** de tributos para todos os serviços, como a planilha ANX01. Se o percentual variar por tipo de serviço, município de prestação ou tipo de cliente, informe abaixo: isso exige ajuste do sistema antes da implantação.",
    campos: [
      { q: "Percentual efetivo estimado de tributos sobre o faturamento (%)", dica: "Número com casas decimais, ex.: 0,00%. O sistema guarda até 6 casas da fração." },
      { q: "O percentual varia por família de serviço ou município de prestação?", opcoes: ["Não", "Sim — detalhar abaixo"] },
      "Se variar: percentual por família (consultoria, treinamento, documentos, auditoria, meio ambiente, software)",
      { q: "Haverá retenções na fonte por tomadores (ISS, IR, PIS/COFINS/CSLL, INSS)? Em que casos?" },
      { q: "As retenções devem aparecer na proposta?", opcoes: ["Não", "Sim — com o texto:"] },
      "Data de referência da estimativa e nome do contador responsável",
    ],
    aplicar: [
      "Nova versão de parâmetros (rascunho → publicação), com “validado por” = contador e data de referência. A versão anterior fica preservada e propostas já emitidas não mudam (CA-08).",
      "Se houver variação por família/município: ajuste do motor de cálculo com testes de conferência contra a planilha ANX01 antes de publicar.",
    ],
  }),
  ...bloco({
    id: "C3",
    titulo: "Pró-labore e encargos",
    auddoc: "AUDDOC011 §4.1, §5 (“Pró-labore planejado — decisão da Direção e suporte contábil”); ANX01 B7",
    quem: "Diretor decide o valor; contabilidade orienta encargos",
    bloqueia: "Sim — compõe o custo/hora.",
    gate: "G2 — R029",
    sistema: "Parâmetros financeiros → “Pró-labore mensal previsto (R$)”",
    lista: "Item 2",
    campos: [
      "Pró-labore mensal previsto (R$)",
      { q: "Encargos sobre o pró-labore (INSS etc.) entram no valor acima ou nas despesas fixas (C4)?", opcoes: ["No pró-labore", "Nas despesas fixas", "Não se aplica"] },
      "Valor mensal estimado dos encargos (R$), se houver",
    ],
    aplicar: ["Campo do conjunto de parâmetros; o custo/hora é recalculado automaticamente e mostrado antes da publicação."],
  }),
  ...bloco({
    id: "C4",
    titulo: "Despesas fixas mensais da operação",
    auddoc: "AUDDOC011 §4.1, §4.3, §5 (“Estimativa mensal: software, comunicação, contabilidade, hospedagem etc.”); ANX01 B8",
    quem: "Diretor levanta; contabilidade confere",
    bloqueia: "Sim — compõe o custo/hora.",
    gate: "G2 — R029",
    sistema: "Parâmetros financeiros → “Custos operacionais fixos mensais (R$)” (o sistema guarda o total)",
    lista: "Item 2",
    contexto: "Não lançar aqui despesas de cada serviço (deslocamento, materiais, terceiros) — elas entram no orçamento de cada demanda (AUDDOC011 §4.3).",
    extra: [
      table(
        [5600, W - 5600],
        ["Despesa fixa (preencher apenas as que existirem)", "Valor mensal (R$)"],
        [
          ["Contabilidade", IN()],
          ["Hospedagem e banco de dados do sistema (Vercel, Supabase) e domínios", IN()],
          ["Software e assinaturas (escritório, e-mail, armazenamento)", IN()],
          ["Telefone e internet", IN()],
          ["Registro profissional / anuidades", IN()],
          ["Seguro de responsabilidade civil profissional (se contratado)", IN()],
          ["Marketing e presença digital", IN()],
          ["Aluguel / espaço de trabalho", IN()],
          ["Outras (descrever)", IN()],
          [C("TOTAL MENSAL", { bold: true }), IN()],
        ],
      ),
      spacer(),
    ],
    aplicar: ["O total vai para o conjunto de parâmetros; o detalhamento fica registrado nas observações da versão."],
  }),
  ...bloco({
    id: "C5",
    titulo: "Taxas de cobrança por meio de pagamento",
    auddoc: "AUDDOC011 §5 (“Taxas de cobrança, comissão — condições reais do canal e forma de pagamento”); ANX01 B12",
    quem: "Contabilidade / banco escolhido",
    bloqueia: "Sim — sem o percentual (ou 0 explícito) o preço não é calculado.",
    gate: "G2 — R029",
    sistema: "Parâmetros financeiros → “Taxas variáveis de cobrança (%)” — informar 0 se não houver (ANX01: “0 explícito se não aplicável”)",
    lista: "Item 2",
    campos: [
      { q: "Meios de recebimento que serão aceitos", opcoes: ["Pix", "Boleto", "Transferência", "Cartão", "Outro:"] },
      "Taxa percentual de cada meio (%)",
      { q: "Percentual único a usar no cálculo (%)", dica: "Se houver vários meios, informe o percentual que deve ser considerado na precificação (ex.: o do meio mais usado ou o maior)." },
      "Banco / conta PJ que receberá os pagamentos (apenas o nome da instituição)",
    ],
    aplicar: ["Campo do conjunto de parâmetros; meios aceitos entram também no texto padrão de pagamento (D5)."],
  }),
  ...bloco({
    id: "C6",
    titulo: "Emissão fiscal, cobrança e recebimentos",
    auddoc: "AUDDOC015-ANX01 R030 (emissão fiscal, cobrança e recebimentos habilitados e testados); AUDDOC011 §7 (caixa); AUDDOC017 RF-18 (caixa — versão 1.1)",
    quem: "Contabilidade (com o Diretor)",
    bloqueia: "Sim para o lançamento comercial (G2); não bloqueia o piloto interno.",
    gate: "G2 — R030",
    sistema: "Fora do MVP: o sistema registra propostas e aceites, mas **não emite nota fiscal** nem controla caixa. O caixa gerencial (entradas e saídas efetivas) está previsto na versão 1.1.",
    lista: "Itens 6 e 24",
    campos: [
      { q: "A NFS-e será emitida pelo portal do município ou por outro sistema?", opcoes: ["Portal do município", "Sistema contábil", "Outro:"] },
      { q: "Quando a nota é emitida?", opcoes: ["No aceite", "Na entrega", "No recebimento", "Mensal (contratos)"] },
      "Categorias de entradas e saídas que o caixa da versão 1.1 deve ter (se quiser já definir)",
    ],
    aplicar: ["Registrado para o escopo da versão 1.1; nenhuma integração fiscal no MVP (AUDDOC017 §2)."],
  }),
];

// ------------------------------------------------------------- SEÇÃO 4 — JURÍDICO
const jur = [
  H1("4. Jurídico"),
  P("O AUDDOC010 aprovou os modelos para **padronização interna**; o uso externo depende de revisão jurídica (AUDDOC010, condição de uso e §7; AUDDOC015-ANX01 R018 e R031). O sistema já emite a proposta integrada (M01) e o orçamento simplificado (M02) com marca d’água de teste; os demais modelos (M03 a M06) estão previstos para a versão 1.1 (AUDDOC017 RF-23)."),
  ...bloco({
    id: "J1",
    titulo: "Revisão da proposta M01 e do orçamento M02 e das cláusulas padrão",
    auddoc: "AUDDOC010 §3 (condições inegociáveis), §7; AUDDOC010-ANX01 (M01) e ANX02 (M02)",
    quem: "Assessoria jurídica",
    bloqueia: "Sim — sem revisão, os modelos não podem ser usados externamente.",
    gate: "G1 — R018; G2 — R031",
    sistema: "Modelos de documentos (Configurações → Modelos) — uma nova versão técnica é registrada se o texto mudar; o SHA-256 do arquivo aprovado fica guardado",
    lista: "Itens 5 e 8",
    contexto: "Enviar ao jurídico: os arquivos AUDDOC010-ANX01 e ANX02 e um PDF de exemplo emitido pelo sistema (com marca d’água). Pontos que o AUDDOC010 §7 manda revisar estão nas perguntas abaixo.",
    campos: [
      { q: "Os modelos M01 e M02 podem ser usados como estão?", opcoes: ["Sim", "Sim, com os ajustes abaixo", "Não"] },
      "Ajustes de texto pedidos no M01 (indicar seção e redação)",
      "Ajustes de texto pedidos no M02",
      "Cláusula padrão de reagendamento e cancelamento (prazos e valores devidos)",
      "Mora: juros, multa e correção em caso de atraso de pagamento",
      { q: "Reajuste dos serviços mensais (índice e periodicidade)", dica: "O sistema já registra início e tempo de contrato dos serviços mensais." },
      "Rescisão antecipada de serviços mensais: aviso prévio e valores devidos",
      "Limite de responsabilidade civil e redação sobre “não garantia de conformidade/certificação” (AUDDOC010 §3)",
      "Foro / forma de solução de conflitos",
      "Texto obrigatório sobre a qualificação do proponente (como deve aparecer razão social, CNPJ e responsável técnico)",
    ],
    anexos: ["Parecer ou e-mail do jurídico aprovando a versão final", "Arquivo Word dos modelos revisados (se houver alteração)"],
    aplicar: [
      "Nova revisão dos anexos na Biblioteca (Rev.01 vigente; Rev.00 preservada — CA-09) e nova versão técnica dos modelos usados na emissão.",
      "Cláusulas padrão entram como texto pré-preenchido nas propostas (ver D5), editáveis por proposta quando o jurídico permitir.",
    ],
  }),
  ...bloco({
    id: "J2",
    titulo: "Contrato M04 (serviços mensais) e modelos M03, M05 e M06",
    auddoc: "AUDDOC010 §2 (contrato mensal SST = M01 + M04), §7; AUDDOC010-ANX03 a ANX06; AUDDOC017 RF-23 (versão 1.1)",
    quem: "Assessoria jurídica",
    bloqueia: "Sim para serviços mensais (consultoria recorrente); não para serviços pontuais.",
    gate: "G1 — R018",
    sistema: "Hoje fora do sistema (uso manual controlado). Preenchimento automático dos anexos ANX03–ANX06 previsto na versão 1.1.",
    lista: "Itens 8 e 24",
    contexto: "O M04 é uma minuta-base e traz, em colchetes, os pontos a definir: rescisão, penalidades, foro, proteção de dados, regime tributário, riscos de vínculo (AUDDOC010-ANX04, “Revisão obrigatória”).",
    campos: [
      { q: "M04 aprovado para contratos mensais?", opcoes: ["Sim", "Com ajustes", "Não"] },
      "Ajustes no M04 (cláusulas de rescisão, penalidades, foro, LGPD, vínculo)",
      { q: "Testemunhas no contrato?", opcoes: ["Não", "Sim — orientação:"] },
      { q: "M03 (aceite independente), M05 (OS comercial) e M06 (alteração de escopo) aprovados?", opcoes: ["Sim", "Com ajustes", "Não"] },
    ],
    aplicar: ["Revisões publicadas na Biblioteca; geração automática entra no planejamento da versão 1.1."],
  }),
  ...bloco({
    id: "J3",
    titulo: "LGPD — termo do autocadastro, aviso de privacidade e papéis",
    auddoc: "AUDDOC013 §8 (acesso, confidencialidade e privacidade); AUDDOC010 §6, §7; AUDDOC017 §10; AUDDOC004 — Habilitações (termos e LGPD pendentes)",
    quem: "Assessoria jurídica (com o Diretor)",
    bloqueia: "Sim — antes de tratar dados de clientes reais e para usar o link de autocadastro.",
    gate: "G1 — R019 (finalidades, base legal, aviso de privacidade e registros de tratamento)",
    sistema: "Autocadastro por link (termo versionado “TERMO-CAD-v0.1”, imutável; cada envio registra a versão aceita) e futuro aviso de privacidade",
    lista: "Item 9",
    contexto: "Texto atual do termo exibido ao cliente no autocadastro (versão TERMO-CAD-v0.1):",
    extraAntes: [
      new Paragraph({
        spacing: { after: 120 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: LINE, space: 8 } },
        children: runs(
          "“Declaro que as informações prestadas neste formulário são verdadeiras e que estou autorizado(a) a fornecê-las em nome da empresa. Os dados informados serão tratados pela AUDITA somente para cadastro, comunicação, elaboração de propostas e contratos e execução dos serviços contratados, com acesso restrito, em conformidade com a Lei nº 13.709/2018 (LGPD). Os dados de contato devem limitar-se ao necessário para o relacionamento com a AUDITA. O titular pode solicitar a confirmação, a atualização ou a correção dos seus dados pelo e-mail engenharia.audita@outlook.com. O envio deste formulário não constitui contratação de serviços. O cadastro será analisado pela AUDITA antes de ser efetivado.”",
          { size: 18, italics: true, color: "333333" },
        ),
      }),
      P("Dados que o sistema guarda hoje: empresa (razão social, nome fantasia, CNPJ/CPF, endereço, segmento), unidades, contatos (nome, função, e-mail, telefone), demandas, propostas e aceites, documentos gerados e trilha de auditoria (quem fez o quê e quando). Infraestrutura: banco de dados Supabase (desenvolvimento na região São Paulo) e aplicação na Vercel.", { size: 18, color: MUTED }),
    ],
    campos: [
      { q: "O texto do termo pode ser usado?", opcoes: ["Sim", "Sim, com a redação abaixo", "Não"] },
      "Nova redação do termo (se houver) — será publicada como nova versão; aceites anteriores ficam vinculados à versão antiga",
      { q: "Base legal para os dados de contato dos clientes", opcoes: ["Execução de contrato / procedimentos preliminares", "Legítimo interesse", "Consentimento", "Outra:"] },
      { q: "Papel da AUDITA no cadastro de clientes", opcoes: ["Controladora", "Operadora", "Depende — orientar"] },
      "Canal oficial para pedidos dos titulares (confirmar engenharia.audita@outlook.com ou outro)",
      { q: "É necessário aviso de privacidade público (site/sistema)?", opcoes: ["Sim — texto anexo", "Não neste momento"] },
      { q: "Hospedagem em provedores de nuvem (Supabase, Vercel) exige cláusula/menção específica?", opcoes: ["Não", "Sim — orientação:"] },
      { q: "Dados ocupacionais ou de saúde poderão ser recebidos de clientes? Que cuidados exigir?", dica: "AUDDOC013 §8: dados sensíveis exigem controles específicos." },
    ],
    aplicar: [
      "Nova versão do termo publicada no banco (as anteriores continuam guardadas, com os aceites vinculados).",
      "Aviso de privacidade como página pública do sistema/site, se aprovado.",
    ],
  }),
  ...bloco({
    id: "J4",
    titulo: "Prazos de retenção e descarte dos registros",
    auddoc: "AUDDOC013 §9 (sem prazo único; registrar prazo, responsável e condição de eliminação) e §14 (“Prazos de retenção — Pendente”)",
    quem: "Jurídico (com o Diretor)",
    bloqueia: "Sim para o piloto real (G1) — o sistema hoje **não exclui** nada (inativação lógica), o que é seguro, mas precisa de regra para descarte/anonimização.",
    gate: "G1 — R028 (retenção e descarte); G2 — R039",
    sistema: "Regra de retenção por categoria; descarte ou anonimização só com decisão registrada (nada automático sem aprovação)",
    lista: "Item 27",
    extra: [
      table(
        [3800, 2400, W - 6200],
        ["Categoria de registro no sistema", "Prazo ou critério de guarda", "Fundamento / condição de descarte"],
        [
          ["Cadastro de clientes, unidades e contatos (ativos e inativos)", IN(), IN()],
          ["Solicitações de autocadastro recusadas", IN(), IN()],
          ["Convites de autocadastro expirados", IN(), IN()],
          ["Demandas e linha do tempo", IN(), IN()],
          ["Propostas, revisões congeladas e aceites/recusas", IN(), IN()],
          ["Documentos emitidos (PDF/DOCX) e seus downloads", IN(), IN()],
          ["Trilha de auditoria (log de ações)", IN(), IN()],
          ["Documentos da biblioteca (revisões substituídas)", IN(), IN()],
        ],
      ),
      spacer(),
    ],
    aplicar: [
      "Tabela de retenção registrada no sistema e no AUDDOC013 (revisão controlada, se o Diretor optar).",
      "Rotina de descarte/anonimização desenvolvida somente após aprovação, com teste e evidência.",
    ],
  }),
  ...bloco({
    id: "J5",
    titulo: "Aceite por e-mail e assinatura eletrônica",
    auddoc: "AUDDOC017 §18 (“não presumir validade técnica/jurídica de assinatura desenhada; definir processo e fornecedor futuramente”); AUDDOC010-ANX01 §6",
    quem: "Jurídico (com o Diretor)",
    bloqueia: "Não — hoje o aceite é registrado com data, nome/cargo de quem aceitou e referência (e-mail, protocolo, assinatura).",
    sistema: "Registro de aceite da proposta",
    lista: "Item 10",
    campos: [
      { q: "O aceite por e-mail que identifica a proposta e a revisão é suficiente para serviços pontuais?", opcoes: ["Sim", "Não — exigir:"] },
      { q: "Para contratos mensais (M04), qual forma de assinatura?", opcoes: ["Assinatura eletrônica (fornecedor a definir)", "Certificado digital", "Assinatura física", "Outra:"] },
      "Fornecedor de assinatura eletrônica preferido (se houver)",
    ],
    aplicar: ["Se apenas e-mail: nenhum ajuste. Se assinatura eletrônica: integração planejada como item próprio, com aprovação de custo."],
  }),
  ...bloco({
    id: "J6",
    titulo: "Marca, assinatura de relatórios e limites de responsabilidade técnica",
    auddoc: "AUDDOC004 — Pendências e Liberação (ordem 13: contratos e limites de responsabilidade; ordem 15: situação fiscal, marca e assinatura de relatórios); AUDDOC010 §3",
    quem: "Jurídico",
    bloqueia: "Sim para o lançamento comercial (G2).",
    gate: "G2 — R031",
    sistema: "Textos padrão das propostas e (versão 1.1) dos relatórios/entregáveis",
    lista: "Item 8",
    campos: [
      { q: "Há restrição para usar a marca “AUDITA” comercialmente (registro/consulta)?", opcoes: ["Não", "Sim — providência:"] },
      "Como o responsável técnico assina relatórios e o que deve constar (nome, registro, ressalvas)",
      "Texto padrão de limitação: o que a AUDITA não garante (conformidade total, certificação, eliminação de multas — AUDDOC010 §3)",
    ],
    aplicar: ["Textos aprovados entram nos modelos e no conteúdo padrão das propostas."],
  }),
];

// ------------------------------------------------------------- SEÇÃO 5 — DIRETOR
const familias = ["Consultoria SST recorrente", "Treinamentos", "Documentos e relatórios", "Auditorias internas", "Meio Ambiente", "HUB — SaaS"];
const matriz = svc["Matriz de Serviços"].slice(3).map(([, c]) => c).filter((c) => c.A);
const treinos = svc["Treinamentos por NR"].slice(3).map(([, c]) => c).filter((c) => c.A && c.A.startsWith("TRN"));

const diretor1 = [
  H1("5. Decisões e preenchimentos do Diretor"),
  ...bloco({
    id: "D1",
    titulo: "Parâmetros financeiros da Direção",
    auddoc: "AUDDOC011 §4, §5; AUDDOC011-ANX01, aba Parâmetros (B9, B13, B14, B15, B16)",
    quem: "Diretor (com apoio da contabilidade, C2 a C5)",
    bloqueia: "Sim — sem eles, todo orçamento fica PENDENTE e sem preço.",
    gate: "G2 — R029",
    sistema: "Configurações → Parâmetros financeiros → nova versão → publicar (só uma versão vigente; anteriores preservadas)",
    lista: "Item 2",
    contexto: "Percentuais devem ser informados explicitamente; “0” quando não se aplica (ANX01). Os valores fictícios do ambiente de teste NÃO serão usados.",
    campos: [
      { q: "Horas faturáveis planejadas por mês (h)", dica: "Horas que efetivamente geram receita, não todas as horas de trabalho (AUDDOC011 §4.1). Considere a capacidade declarada no AUDDOC004 — Habilitações (disponibilidade)." },
      { q: "Contingência de execução (%)", dica: "Cobre incertezas razoáveis de escopo; não substitui exclusões (AUDDOC011 §4.4)." },
      { q: "Margem-alvo sobre a receita (%)" },
      { q: "Desconto máximo sugerido (%)", dica: "Hoje: desconto até este limite segue com autorização expressa registrada no item; acima, bloqueado." },
      { q: "Comissão variável (%)", dica: "0 se não houver comissão de vendas." },
      "Data de referência dos parâmetros",
      "Validado por (nome; ex.: Diretor e contador)",
    ],
    aplicar: [
      "Cadastro em nova versão de parâmetros e conferência do custo/hora e do preço sugerido em três simulações (serviço pontual, consultoria recorrente e treinamento — AUDDOC011 §11) antes de publicar.",
    ],
  }),
  ...bloco({
    id: "D2",
    titulo: "Política de desconto por família de serviços",
    auddoc: "AUDDOC011 §4.6 (descontos exigem nova verificação), §6 (regras por família), §8 (descontos aprovados pela Direção)",
    quem: "Diretor",
    bloqueia: "Não — enquanto não definida, vale o desconto máximo único (D1) com autorização registrada.",
    sistema: "Parâmetros financeiros e autorização de desconto no item do orçamento",
    lista: "Item 3",
    extra: [
      table(
        [3200, 1900, 2200, W - 7300],
        ["Família (AUDDOC011 §6)", "Desconto máximo (%)", "Quem autoriza", "Condições (ex.: contrato ≥ 12 meses)"],
        familias.map((f) => [f, IN(), IN(), IN()]),
      ),
      spacer(),
    ],
    aplicar: ["Se os limites forem diferentes por família: ajuste do sistema (limite por família) com testes; se iguais, apenas o parâmetro único."],
  }),
];

const servRows = matriz.map((c) => [
  C(c.A, { bold: true, size: 16 }),
  C(c.B, { size: 16 }),
  C(c.D?.split(" — ")[0] ?? "", { size: 16, align: AlignmentType.CENTER }),
  C(c.G ?? "", { size: 15, color: "333333" }),
  IN("☐ Não liberado\n"),
  IN(""),
]);
// Paragraphs dentro da célula de decisão
function decisaoCell() {
  return C(
    ["☐ Não liberado", "☐ Apto tecnicamente", "☐ Apto comercialmente", "☐ Expansão futura"].map(
      (t) => new Paragraph({ spacing: { after: 10 }, children: runs(t, { size: 15, color: "1F3A93" }) }),
    ),
    { fill: INPUT },
  );
}
function compCell() {
  return C(
    ["Documentos: ☐S ☐P ☐N", "Resp. técnico: ☐S ☐P ☐N ☐N/A", "Recursos: ☐S ☐P ☐N ☐N/A"].map(
      (t) => new Paragraph({ spacing: { after: 10 }, children: runs(t, { size: 15, color: "1F3A93" }) }),
    ),
    { fill: INPUT },
  );
}
const WS = [1000, 2700, 750, 3100, 1900, 2500, WL - 11950];
const servTable = table(
  WS,
  ["Código", "Serviço (AUDDOC004)", "Classe", "O que comprovar (AUDDOC004)", "Decisão (AUDDOC005 §14)", "Comprovações", "Fundamento / evidência / data"],
  matriz.map((c) => [
    C(c.A, { bold: true, size: 16 }),
    C(c.B, { size: 16 }),
    C(c.D?.split(" — ")[0] ?? "", { size: 16, align: AlignmentType.CENTER }),
    C(c.G ?? "", { size: 15, color: "333333" }),
    decisaoCell(),
    compCell(),
    IN(""),
  ]),
);
const WT = [1250, 3000, 3100, 1900, 2500, WL - 11750];
const treinoTable = table(
  WT,
  ["Código", "Treinamento (AUDDOC004 — Treinamentos por NR)", "Exigência / limite a conferir (AUDDOC004)", "Decisão (AUDDOC005 §14)", "Comprovações", "Fundamento / evidência / data"],
  treinos.map((c) => [
    C(c.A, { bold: true, size: 16 }),
    C(`${c.B} — ${c.C}`, { size: 16 }),
    C(c.H ?? "", { size: 15, color: "333333" }),
    decisaoCell(),
    compCell(),
    IN(""),
  ]),
);

const diretorServicos = [
  H1np("D3 — Liberação dos serviços e das ofertas de treinamento"),
  table(
    [2600, WL - 2600],
    null,
    [
      [C("AUDDOC de referência", { fill: HEAD, bold: true }), "AUDDOC004 Rev.00 (Matriz de Serviços; Treinamentos por NR; Pendências e Liberação); AUDDOC005 §14 (matriz de decisão comercial) e §18; AUDDOC017 CA-04"],
      [C("Quem responde", { fill: HEAD, bold: true }), "Diretor (decisão registrada, com fundamento, data e evidência)"],
      [C("Bloqueia o uso real?", { fill: HEAD, bold: true }), "Sim — no sistema real, só serviço **Apto comercialmente** gera proposta. As liberações fictícias do ambiente de teste (SST-001, SST-009, DOC-002, TRN-001, TRN-NR06) NÃO vão para a produção."],
      [C("Prontidão (AUDDOC015-ANX01)", { fill: HEAD, bold: true }), "G1 — R016 (serviços do piloto liberados individualmente) e R017 (registro, competência e recursos confirmados); G2 — R032 (catálogo divulgado só com liberados)"],
      [C("Onde entra no sistema", { fill: HEAD, bold: true }), "Configurações → Catálogo de serviços → decisão de situação (com fundamento obrigatório e histórico imutável)"],
      [C("Lista de pendências", { fill: HEAD, bold: true }), "Item 4"],
    ],
  ),
  spacer(),
  P("**Critérios (AUDDOC005 §14):** Não liberado = situação atual. **Apto tecnicamente** = atribuição, competência, equipamentos, documentação e práticas verificados e registrados. **Apto comercialmente** = além disso, regularização PJ (C1), documentação comercial e contratos (J1/J2), preços (D1) e validação final. **Expansão futura** = depende de parceiros, credenciais ou estrutura. Em “Comprovações”: S = sim, P = parcial, N = não, N/A = não se aplica."),
  P("Os serviços da classe C (ESP-001 a ESP-007) são de expansão futura no AUDDOC004 e não devem ser anunciados como disponíveis (AUDDOC005 §18). SIS-001/SIS-002 dependem de produto homologado e do modelo de preço SaaS (item 6 da lista; AUDDOC011 §6)."),
  H3("3.a — Os 33 serviços da AUDDOC004"),
  servTable,
  spacer(),
  H3("3.b — As 12 ofertas de treinamento (detalham TRN-005)"),
  treinoTable,
  spacer(),
  H3("Como será aplicado no sistema"),
  B("Cada decisão é registrada pelo fluxo do catálogo, com o fundamento e a data informados; o histórico guarda a situação anterior. Só os serviços “Apto comercialmente” passam a permitir emissão de proposta."),
  B("Atualização da AUDDOC004 por revisão controlada (Rev.01), se o Diretor optar, mantendo a Rev.00 na Biblioteca."),
];

const diretor2 = [
  ...bloco({
    id: "D4",
    titulo: "Habilitações e comprovações do responsável técnico",
    auddoc: "AUDDOC004 — Habilitações e Pendências e Liberação (ordens 1 a 11 e 14); AUDDOC015 §4 (formalização e habilitação)",
    quem: "Diretor (titular)",
    bloqueia: "Sim — sustentam as decisões de D3.",
    gate: "G1 — R017",
    sistema: "Fundamento das decisões do catálogo; comprovantes guardados em local seguro (não no portfólio público — AUDDOC004)",
    lista: "Item 4",
    extra: [
      table(
        [3300, 2900, W - 6200],
        ["Comprovação (AUDDOC004)", "Situação registrada no AUDDOC004", "Atualização / evidência enviada"],
        [
          ["Situação cadastral atual do registro profissional de TST", "Em análise — cartão de 2023 apresentado", IN()],
          ["Certificados de instrutor por NR, programas, avaliações próprios", "Em análise — proficiência declarada", IN()],
          ["Certificado de curso de auditor interno ISO e histórico de auditorias", "Parcial — certificado de interpretação (24 h) recebido", IN()],
          ["Equipamentos de medição (aluguel, calibração, fornecedores)", "Em análise — aluguel por demanda previsto", IN()],
          ["Estrutura prática de treinamento (local, equipamentos, simulações)", "Em análise — sem infraestrutura própria", IN()],
          ["NR-33: responsável técnico e estrutura prática", "Em análise — falta RT e estrutura", IN()],
          ["NR-35: prática, resgate e estrutura presencial", "Em análise", IN()],
          ["NR-11 (empilhadeira e ponte rolante): experiência por equipamento e prática", "Pendente", IN()],
          ["Capacidade real (visitas/mês, regiões, serviços simultâneos)", "Em análise — disponibilidade integral declarada", IN()],
          ["Projeto pedagógico e modalidade (EAD só onde permitido)", "Em desenvolvimento", IN()],
        ],
      ),
      spacer(),
    ],
    aplicar: ["As evidências viram o fundamento de cada decisão em D3 e podem ser registradas no AUDDOC015-ANX01 (R017)."],
  }),
  ...bloco({
    id: "D5",
    titulo: "Condições comerciais padrão das propostas",
    auddoc: "AUDDOC010-ANX01 (M01) §3–§4; AUDDOC010 §5 (campos por família); AUDDOC011 §8",
    quem: "Diretor (cláusulas de cancelamento e mora dependem de J1)",
    bloqueia: "Não — hoje são preenchidas a cada proposta.",
    sistema: "Textos pré-preenchidos nos campos do conteúdo da proposta (editáveis por proposta)",
    lista: "Item 5",
    campos: [
      { q: "Validade padrão das propostas (dias)" },
      "Forma de pagamento padrão — serviços pontuais (à vista, parcelas, prazo de vencimento)",
      "Forma de pagamento padrão — serviços mensais (dia de vencimento)",
      { q: "Despesas adicionais (deslocamento, pedágio, hospedagem): critério padrão", dica: "AUDDOC010 M01: “somente as expressamente pactuadas; valor/teto ou critério de aprovação”." },
      { q: "Tempo de contrato padrão dos serviços mensais (meses)" },
      { q: "Modelo preferido", opcoes: ["Sempre M01", "M02 para cotação preliminar e M01 para fechamento", "Decidir por proposta"] },
      "Texto padrão do “próximo passo” após o aceite",
      "Raio/região de atendimento sem cobrança de deslocamento (se houver)",
    ],
    aplicar: ["Textos padrão configurados no sistema e aplicados às novas propostas; propostas já emitidas não mudam."],
  }),
  ...bloco({
    id: "D6",
    titulo: "Dados institucionais exibidos nas propostas",
    auddoc: "AUDDOC013 §3–§4; AUDDOC010-ANX01 (identificação do proponente); AUDDOC015 §2 (e-mail oficial único da fase inicial); AUDDOC003 (identidade visual)",
    quem: "Diretor (dados fiscais vêm de C1)",
    bloqueia: "Sim — o proponente precisa estar identificado na proposta real.",
    sistema: "Configurações → Dados institucionais (tela a construir) → cabeçalho e rodapé do M01/M02",
    lista: "Item 13",
    campos: [
      "E-mail comercial exibido nas propostas (AUDDOC015 registra engenharia.audita@outlook.com como e-mail oficial da fase inicial)",
      "Telefone / WhatsApp comercial",
      "Site exibido (ex.: audita.seg.br — somente quando publicado)",
      { q: "Exibir nome e registro do responsável técnico na proposta?", opcoes: ["Sim", "Não", "Conforme J6"] },
      "Nome e cargo de quem assina as propostas pela AUDITA",
      { q: "Endereço completo da sede na proposta?", opcoes: ["Completo", "Somente município/UF"] },
    ],
    aplicar: ["Tela de dados institucionais (desenvolvimento) e nova versão técnica dos modelos com os dados reais."],
  }),
  ...bloco({
    id: "D7",
    titulo: "Usuários e permissões por nível (I9.1)",
    auddoc: "AUDDOC017 §1 (“um único administrador; preparar permissões para expansão”) e §10 (perfis); AUDDOC013 §8 (papéis e acessos)",
    quem: "Diretor",
    bloqueia: "Não — por decisão de 10/10/2026, por enquanto só existe o usuário mestre.",
    sistema: "Minha conta → Novo usuário (somente o usuário mestre); permissões aplicadas no banco (RLS), não apenas na tela",
    lista: "Item 14",
    contexto: "Decisão do Diretor (10/10/2026): manter apenas o usuário mestre por enquanto; o mestre poderá criar contas de **qualquer nível**. Abaixo, a proposta de permissões a partir do AUDDOC017 §10 — confirme ou ajuste cada linha.",
    extraAntes: [
      H3("Matriz de permissões — confirme ou ajuste (células amarelas)"),
      table(
        [3500, 1900, 2000, W - 7400],
        ["Ação", "Administrador", "Operador administrativo", "Marketing"],
        [
          ["Ver e cadastrar clientes, unidades e contatos", "Sim", IN("Sim (AUDDOC017)"), IN("Não")],
          ["Registrar e acompanhar demandas", "Sim", IN("Sim (AUDDOC017)"), IN("Não")],
          ["Preparar orçamentos (itens, horas, despesas)", "Sim", IN("Sim (AUDDOC017)"), IN("Não")],
          ["Ver preços, custos e margens", "Sim", IN("?"), IN("Não (AUDDOC017)")],
          ["Concluir revisão e emitir proposta", "Sim", IN("?"), IN("Não")],
          ["Registrar aceite / recusa", "Sim", IN("?"), IN("Não")],
          ["Autorizar desconto", "Sim", IN("?"), IN("Não")],
          ["Liberar serviços no catálogo", "Sim", IN("Não (AUDDOC017)"), IN("Não")],
          ["Alterar parâmetros financeiros / política de preços", "Sim", IN("Não (AUDDOC017)"), IN("Não")],
          ["Biblioteca: consultar e baixar", "Sim", IN("?"), IN("?")],
          ["Biblioteca: enviar e publicar revisões", "Sim", IN("?"), IN("Não")],
          ["Comunicação/marketing (I10): rascunhos", "Sim", IN("?"), IN("Sim (AUDDOC017)")],
          ["Ver indicadores do Início", "Sim", IN("?"), IN("?")],
          ["Criar usuários e alterar permissões", "Somente o mestre", IN("Não (AUDDOC017)"), IN("Não")],
        ],
      ),
      spacer(),
    ],
    campos: [
      "E-mail de login do usuário mestre (confirmar)",
      { q: "Ao criar um usuário, ele recebe convite por e-mail para definir a senha?", opcoes: ["Sim (recomendado)", "Senha provisória definida pelo mestre"] },
    ],
    aplicar: ["Implementação no I9.1 com testes por chamada direta para cada nível (o que não é permitido deve ser recusado pelo banco)."],
  }),
  ...bloco({
    id: "D8",
    titulo: "Remetente dos e-mails do sistema",
    auddoc: "AUDDOC017 §10 (autenticação); AUDDOC015 §2 (e-mail oficial)",
    quem: "Diretor",
    bloqueia: "Sim — recuperação de senha e convites de usuários dependem de envio de e-mail confiável.",
    sistema: "Configuração de envio (SMTP) da autenticação; avisos de novas solicitações de cadastro",
    lista: "Item 15",
    campos: [
      { q: "Endereço remetente", dica: "Ex.: um endereço no domínio audita.seg.br. Contas pessoais/gratuitas costumam ser bloqueadas para envio automático." },
      { q: "Provedor de e-mail do domínio", opcoes: ["Ainda não contratado", "Provedor:"] },
      "Quem recebe os avisos internos (novas solicitações de cadastro etc.)",
    ],
    aplicar: ["Configuração do envio no ambiente de produção, teste de recuperação de senha e de convite."],
  }),
  ...bloco({
    id: "D9",
    titulo: "Metas dos indicadores",
    auddoc: "AUDDOC017 §14 (indicadores e fórmulas)",
    quem: "Diretor",
    bloqueia: "Não",
    sistema: "Início → indicadores (meta exibida ao lado do valor)",
    lista: "Item 7",
    campos: ["Meta de valor cotado por mês (R$)", "Meta de conversão (%)", "Meta de ticket médio aceito (R$)", "Meta de demandas atendidas por mês"],
    aplicar: ["Exibição da meta e do quanto falta, sem misturar valor de proposta com dinheiro recebido."],
  }),
  ...bloco({
    id: "D10",
    titulo: "Documentos da biblioteca",
    auddoc: "AUDDOC001 (padrão de documentos); AUDDOC014 e AUDDOC015 (propriedades do arquivo); AUDDOC017 §18 (minutas nunca vigentes)",
    quem: "Diretor",
    bloqueia: "Não",
    sistema: "Biblioteca → enviar revisão e publicar",
    lista: "Itens 11 e 12",
    contexto: "Achado da importação do acervo: o arquivo do AUDDOC001 no dossiê é a **minuta** (status “Rascunho”, data e responsável “[Inserir…]”), por isso está sem revisão vigente no sistema. No AUDDOC014 e AUDDOC015, conteúdo e SHA-256 são da Rev.00 aprovada; apenas a propriedade interna de título do Word ainda diz “Minuta v0.1”.",
    campos: [
      "Enviar o arquivo aprovado da Rev.00 do AUDDOC001 (anexar)",
      { q: "AUDDOC014 e AUDDOC015: corrigir a propriedade de título?", opcoes: ["Manter como está", "Emitir revisão controlada corrigindo"] },
    ],
    aplicar: ["Publicação na Biblioteca com SHA-256 conferido; a minuta continua no histórico, sem ser vigente."],
  }),
  ...bloco({
    id: "D11",
    titulo: "Escopo do piloto e decisões de prontidão (gates G1/G2)",
    auddoc: "AUDDOC015 §3, §6 e §10; AUDDOC015-ANX01 (Decisões e Histórico)",
    quem: "Diretor",
    bloqueia: "Sim — o uso com cliente real exige decisão expressa registrada (G1).",
    gate: "G1 — R025 (cliente e participantes do piloto autorizados, escopo limitado); R027 (suporte e canal de incidentes)",
    sistema: "Define o que será liberado na implantação (serviços, usuários, funcionalidades)",
    lista: "Itens 18 a 22",
    campos: [
      "Serviços que entram no piloto (códigos)",
      "Clientes do piloto (quantidade e critério; não informar dados pessoais aqui)",
      "Período do piloto",
      "Canal de suporte e de incidentes durante o piloto",
      { q: "Decisão G1 (após resolver os bloqueios)", opcoes: ["Aprovado", "Aprovado com restrições", "Não aprovado"] },
    ],
    aplicar: ["Configuração da produção restrita ao escopo aprovado; registro da decisão no AUDDOC015-ANX01."],
  }),
];

// ------------------------------------------------------------- SEÇÃO 6 — IMPLANTAÇÃO
const impl = [
  H1("6. Implantação e itens do desenvolvimento"),
  P("Nada desta seção é executado sem a sua **autorização expressa** (regra do projeto). Os itens 6.1 não exigem resposta: são ajustes que o desenvolvimento fará a partir das respostas anteriores."),
  ...bloco({
    id: "I1",
    titulo: "Banco de dados de produção e backup",
    auddoc: "AUDDOC017 §11, §12 e §18 (mesmo banco corporativo planejado; confirmar acesso, tabelas, RLS e backups antes de qualquer DDL); AUDDOC013 §14 (local de armazenamento e backup); AUDDOC015-ANX01 R023",
    quem: "Diretor decide; desenvolvimento executa",
    bloqueia: "Sim",
    gate: "G1 — R023 (backup e restauração testados no ambiente autorizado); R024 (banco compartilhado sem vazamento)",
    sistema: "Infraestrutura",
    lista: "Itens 18 e 21",
    contexto: "Achado da homologação (H-04): no banco compartilhado com o Audita PRO, o schema do AUDITA deve ser **acrescentado** à lista de schemas expostos, sem retirar os do PRO. Todas as tabelas do AUDITA ficam no schema próprio “audita”; nenhuma tabela do PRO/HUB é alterada.",
    campos: [
      { q: "Onde o sistema real vai rodar?", opcoes: ["Projeto corporativo do Audita PRO (schema separado), como prevê o AUDDOC017", "Projeto Supabase separado até a fase de integração"] },
      { q: "Plano do Supabase com cópias de segurança automáticas", opcoes: ["Contratar (valor a conferir no painel)", "Manter o atual"] },
      { q: "Frequência do ensaio de restauração com o roteiro do sistema", opcoes: ["Antes do piloto e depois mensal", "Antes do piloto e depois trimestral", "Outra:"] },
    ],
    aplicar: [
      "Inventário prévio do banco escolhido, plano de rollback, aplicação das 14 migrações validadas somente no schema “audita” e conferência de segurança automática (a mesma do I9).",
      "Ensaio de restauração antes de cadastrar dados reais (o roteiro da homologação restaurou 21/21 tabelas idênticas).",
    ],
  }),
  ...bloco({
    id: "I2",
    titulo: "Publicação e endereço do sistema",
    auddoc: "AUDDOC017 §18; AUDDOC015 §2 (domínio audita.seg.br registrado)",
    quem: "Diretor",
    bloqueia: "Sim",
    sistema: "Vercel (produção) com o ambiente marcado como produção (dados de teste fora dos indicadores e sem marca d’água de teste só quando tudo estiver liberado)",
    lista: "Item 19",
    campos: [
      { q: "Endereço desejado", dica: "Ex.: um subdomínio de audita.seg.br" },
      "Quem administra o DNS do domínio (para criar o apontamento)",
      { q: "Autoriza a publicação em produção após os bloqueios resolvidos?", opcoes: ["Sim", "Não — aguardar"] },
    ],
    aplicar: ["Publicação somente após a sua autorização; teste do endereço, do login e das telas no celular e no computador."],
  }),
  ...bloco({
    id: "I3",
    titulo: "Segurança das contas",
    auddoc: "AUDDOC017 §10 (autenticação robusta); AUDDOC013 §8",
    quem: "Diretor (configuração no painel; o desenvolvimento orienta)",
    bloqueia: "Sim",
    sistema: "Painel do Supabase e login do sistema",
    lista: "Item 17",
    campos: [
      { q: "Ativar verificação em duas etapas (MFA) para o usuário mestre?", opcoes: ["Sim", "Não"] },
      { q: "Ativar a proteção contra senhas vazadas (único alerta restante da revisão de segurança)?", opcoes: ["Sim", "Não"] },
    ],
    aplicar: ["Configuração e nova revisão de segurança sem alertas."],
  }),
  ...bloco({
    id: "I4",
    titulo: "Carga inicial, ensaio de restauração e regressão em produção",
    auddoc: "AUDDOC017 §10 (backups e recuperação testável antes de dados reais), §15; AUDDOC015 §7 (simulação mínima da experiência do cliente)",
    quem: "Desenvolvimento (com acompanhamento do Diretor)",
    bloqueia: "Sim",
    gate: "G1 — R021/R022 (testes críticos executados, sem P0/P1)",
    sistema: "Produção",
    lista: "Itens 20 a 23",
    fazer: [
      "Criar o usuário mestre; publicar os parâmetros reais (D1/C2–C5); registrar as liberações (D3); importar o acervo oficial com o roteiro já testado.",
      "Não levar nenhum dado de teste. Rodar a regressão completa e a jornada de homologação em produção com registros temporários identificados.",
      "Ensaio de restauração e limpeza controlada de arquivos sem registro (achado H-03).",
    ],
    aplicar: ["Relatório de implantação com evidências, no mesmo formato da homologação do MVP."],
  }),
  H2("6.1 Ajustes do sistema que dependem das respostas (sem pergunta)"),
  table(
    [1500, 5200, W - 6700],
    ["Item da lista", "Ajuste", "Depende de"],
    [
      ["13", "Tela de dados institucionais e textos dos modelos com os dados reais", "C1, D6, J1"],
      ["14", "I9.1 — Minha conta, criação de usuários (só o mestre) e tema claro/escuro", "D7"],
      ["15", "Envio de e-mails com domínio próprio", "D8"],
      ["16", "Mensagem de sucesso que permanece na tela após ações seguintes (achado H-02)", "—"],
      ["2/3", "Tributos ou descontos diferentes por família, se a resposta exigir", "C2, D2"],
      ["27", "Regra de retenção e rotina de descarte/anonimização aprovada", "J4"],
    ],
  ),
  H2("6.2 Próximas versões (registradas, fora do MVP)"),
  table(
    [1500, 5200, W - 6700],
    ["Item da lista", "Assunto", "AUDDOC / decisão necessária"],
    [
      ["6", "Modelo de preço do Audita HUB/PRO como serviço (SaaS)", "AUDDOC011 §6 — Diretor e contabilidade"],
      ["24", "V1.1: caixa gerencial, serviço contratado/execução, anexos ANX03–ANX06 automáticos", "AUDDOC017 §2, RF-07, RF-18, RF-23"],
      ["25", "I10 / V1.2: comunicação e marketing; IA só com provedor, custo e tratamento de dados aprovados", "AUDDOC017 RF-25 a RF-28, §18"],
      ["26", "Integração com Audita PRO / HUB em estágio próprio", "AUDDOC014; AUDDOC017 §12"],
    ],
  ),
];

const fim = [
  H1("7. Checklist de devolução"),
  table(
    [700, 6500, W - 7200],
    ["", "Item", "Responsável"],
    [
      [IN("☐"), "Seção 3 respondida (C1 a C6) e comprovantes de C1 anexados", "Contabilidade"],
      [IN("☐"), "Seção 4 respondida (J1 a J6) e parecer/aprovação anexados", "Jurídico"],
      [IN("☐"), "D1, D2, D5, D6, D8 e D9 preenchidos", "Diretor"],
      [IN("☐"), "D3 — decisão registrada para cada serviço e treinamento", "Diretor"],
      [IN("☐"), "D4 — evidências atualizadas enviadas por canal seguro", "Diretor"],
      [IN("☐"), "D7 — matriz de permissões confirmada", "Diretor"],
      [IN("☐"), "D10 — arquivo aprovado do AUDDOC001 anexado", "Diretor"],
      [IN("☐"), "D11 e I1 a I3 — decisões de piloto e implantação", "Diretor"],
    ],
  ),
  spacer(),
  H2("Controle do documento"),
  table(
    [1500, 1500, 3000, W - 6000],
    ["Versão", "Data", "Responsável", "Descrição"],
    [["v1.0", "10/10/2026", "AUDITA — elaboração assistida", "Primeira emissão, a partir da homologação do MVP (I9) e dos AUDDOC004, 005, 010, 011, 013, 015 e 017. Documento de trabalho, sem código AUDDOC."]],
  ),
  spacer(),
  P("Este caderno não aprova, libera ou altera nenhum documento oficial. Decisões aqui registradas passam a valer no sistema somente depois de aplicadas, testadas e registradas no histórico de desenvolvimento.", { italics: true, color: MUTED, size: 18 }),
];

// =====================================================================================
const header = new Header({
  children: [
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN, space: 4 } },
      children: [new TextRun({ text: "AUDITA  |  Caderno de pendências para o sistema real  —  v1.0 (10/10/2026)", font: FONT, size: 16, color: MUTED })],
    }),
  ],
});
const footer = new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: "Documento de trabalho — não é um AUDDOC  ·  Página ", font: FONT, size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: MUTED }),
        new TextRun({ text: " de ", font: FONT, size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: MUTED }),
      ],
    }),
  ],
});
const portrait = { page: { size: A4, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } };
const landscape = { page: { size: { ...A4, orientation: PageOrientation.LANDSCAPE }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } };

const doc = new Document({
  creator: "AUDITA",
  title: "Caderno de pendências para o sistema AUDITA real",
  description: "Pendências por responsável, com campos para resposta e referência aos AUDDOC",
  styles: {
    default: { document: { run: { font: FONT, size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, color: NAVY, font: FONT }, paragraph: { spacing: { before: 120, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, color: NAVY, font: FONT }, paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 21, bold: true, color: GREEN, font: FONT }, paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] },
      { reference: "num", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 280 } } } }] },
    ],
  },
  sections: [
    { properties: portrait, headers: { default: header }, footers: { default: footer }, children: [...capa, ...comoUsar, ...resumo, ...contab, ...jur, ...diretor1] },
    { properties: landscape, headers: { default: header }, footers: { default: footer }, children: diretorServicos },
    { properties: portrait, headers: { default: header }, footers: { default: footer }, children: [...diretor2, ...impl, ...fim] },
  ],
});

const out = process.argv[2] || path.join(__dirname, "..", "docs", "Caderno_Pendencias_Sistema_AUDITA_v1.0.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log("ok", out, buf.length);
});
