// AUDFOR001 — Ficha Cadastral de Cliente (minuta) — padrão AUDDOC001 / identidade AUDDOC003
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, BorderStyle, Header, Footer, ImageRun, PageNumber, TabStopType, VerticalAlign,
  TableLayoutType, HeightRule, LineRuleType,
} = require("docx");

const NAVY = "031B35";
const GRAY_TXT = "58677D";
const ROW_ALT = "F7F9FA";
const BORDER = "C9D3DD";
const NOTE_FILL = "FFF4D6";
const W = 9638; // largura útil A4 com margens de 20 mm (DXA)
const FONT = "Arial";

const CODE = "AUDFOR001";
const TITLE = "Ficha Cadastral de Cliente";
const REV = "Rev.00";
const STATUS = "Minuta v0.1 — para aprovação";
const DATE = "09/10/2026";

const logo = fs.readFileSync(__dirname + "/logo-oficial.png");

const t = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size ?? 20, bold: o.bold, italics: o.italics, color: o.color });
const p = (children, o = {}) =>
  new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: o.align ?? AlignmentType.LEFT,
    spacing: { before: o.before ?? 0, after: o.after ?? 120, line: o.line ?? 276, lineRule: LineRuleType.AUTO },
    keepNext: o.keepNext,
    border: o.border,
  });

const border = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(children, width, o = {}) {
  return new TableCell({
    children: Array.isArray(children) ? children : [children],
    width: { size: width, type: WidthType.DXA },
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    verticalAlign: o.vAlign ?? VerticalAlign.CENTER,
    columnSpan: o.span,
    borders,
  });
}

/** Rótulo (9 pt negrito) com dica opcional (8 pt cinza). */
function label(text, hint, required) {
  const runs = [t(text, { size: 18, bold: true, color: NAVY })];
  if (required) runs.push(t(" *", { size: 18, bold: true, color: "B63D35" }));
  const out = [p(runs, { after: 0, keepNext: true })];
  if (hint) out.push(p(t(hint, { size: 16, color: GRAY_TXT, italics: true }), { after: 0, keepNext: true }));
  return out;
}
const blank = () => p(t("", { size: 18 }), { after: 0, keepNext: true });

/** Cabeçalho de tabela: texto branco 9 pt negrito sobre azul-marinho. */
function headRow(text, cols) {
  return new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [cell(p(t(text, { size: 18, bold: true, color: "FFFFFF" }), { after: 0, keepNext: true }), W, { fill: NAVY, span: cols })],
  });
}

/** Linha de formulário com pares rótulo/campo. pairs: [[label, hint, required, labelW, valueW], ...] */
function formRow(pairs, i = 0) {
  const cells = [];
  for (const [lab, hint, req, lw, vw] of pairs) {
    cells.push(cell(label(lab, hint, req), lw, { fill: ROW_ALT }));
    cells.push(cell(blank(), vw));
  }
  return new TableRow({ cantSplit: true, height: { value: 480, rule: HeightRule.ATLEAST }, children: cells });
}

function formTable(title, rows, cols = 4) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: cols === 4 ? [2200, 2619, 2200, 2619] : [2600, 7038],
    layout: TableLayoutType.FIXED,
    rows: [headRow(title, cols), ...rows],
  });
}

const full = (lab, hint, req) => formRow([[lab, hint, req, 2600, 7038]]);
const half = (a, b) => formRow([[a[0], a[1], a[2], 2200, 2619], [b[0], b[1], b[2], 2200, 2619]]);

function checkboxRow(lab, options, hint, req) {
  return new TableRow({
    cantSplit: true,
    height: { value: 480, rule: HeightRule.ATLEAST },
    children: [
      cell(label(lab, hint, req), 2600, { fill: ROW_ALT }),
      cell(p(options.flatMap((o, i) => [t(i ? "        " : ""), t("☐ ", { size: 20 }), t(o, { size: 18 })]), { after: 0, keepNext: true }), 7038),
    ],
  });
}

const spacer = (after = 160) => p(t(""), { after });

function sectionTitle(n, text) {
  return p(t(`${n}. ${text}`, { size: 24, bold: true, color: NAVY }), { before: 200, after: 100, keepNext: true });
}

function note(strong, text) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: W, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: NOTE_FILL },
            margins: { top: 80, bottom: 80, left: 140, right: 140 },
            borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.SINGLE, size: 24, color: NAVY } },
            children: [p([t(strong, { size: 18, bold: true, color: NAVY }), t(text, { size: 18 })], { after: 0 })],
          }),
        ],
      }),
    ],
  });
}

// ----------------------------------------------------------------------------
// Cabeçalho e rodapé (AUDDOC001: logo à esquerda, título ao centro, código/revisão à direita)
// ----------------------------------------------------------------------------
const header = new Header({
  children: [
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [2400, 4838, 2400],
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY } },
              verticalAlign: VerticalAlign.BOTTOM,
              children: [p(new ImageRun({ type: "png", data: logo, transformation: { width: 96, height: 34 }, altText: { title: "AUDITA", description: "Logotipo oficial AUDITA", name: "logo" } }), { after: 40, line: 240 })],
            }),
            new TableCell({
              width: { size: 4838, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY } },
              verticalAlign: VerticalAlign.BOTTOM,
              children: [p(t(TITLE.toUpperCase(), { size: 18, bold: true, color: NAVY }), { align: AlignmentType.CENTER, after: 60 })],
            }),
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY } },
              verticalAlign: VerticalAlign.BOTTOM,
              children: [
                p(t(CODE, { size: 18, bold: true, color: NAVY }), { align: AlignmentType.RIGHT, after: 0 }),
                p(t(`${REV} | ${STATUS.split(" —")[0]}`, { size: 16, color: GRAY_TXT }), { align: AlignmentType.RIGHT, after: 60 }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
});

const footer = new Footer({
  children: [
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 4 } },
      tabStops: [
        { type: TabStopType.CENTER, position: W / 2 },
        { type: TabStopType.RIGHT, position: W },
      ],
      children: [
        t(`AUDITA | ${TITLE}`, { size: 16, color: GRAY_TXT }),
        t(`\t${CODE} · ${REV} · ${STATUS.split(" —")[0]} · ${DATE}`, { size: 16, color: GRAY_TXT }),
        new TextRun({ children: ["\tPágina ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: GRAY_TXT }),
      ],
    }),
    p(t("Documento controlado pela AUDITA.", { size: 14, color: GRAY_TXT, italics: true }), { align: AlignmentType.CENTER, after: 0 }),
  ],
});

// ----------------------------------------------------------------------------
// Corpo
// ----------------------------------------------------------------------------
const body = [
  p(t(TITLE, { size: 32, bold: true, color: NAVY }), { after: 60 }),
  p(t("AUDITA | SSMA & SGI — Gestão inteligente para ambientes mais seguros.", { size: 18, color: GRAY_TXT }), { after: 160 }),
  p(
    t("Prezado(a) cliente, preencha esta ficha com os dados da sua empresa e devolva-a à AUDITA pelo e-mail engenharia.audita@outlook.com. As informações serão usadas para o seu cadastro e para a elaboração de propostas, contratos e comunicações relacionadas aos serviços solicitados.", { size: 20 }),
    { align: AlignmentType.JUSTIFIED },
  ),
  note("Como preencher  |  ", "Os campos marcados com * são obrigatórios. Os demais podem ficar em branco quando não se aplicarem. Se sua empresa possuir mais unidades ou contatos do que os espaços disponíveis, envie as informações adicionais no corpo do e-mail ou em anexo."),
  spacer(),

  sectionTitle(1, "Identificação da empresa"),
  formTable("DADOS CADASTRAIS", [
    checkboxRow("Tipo de cadastro", ["Pessoa jurídica (CNPJ)", "Pessoa física (CPF)"], null, true),
    full("Razão social / nome completo", null, true),
    full("Nome fantasia", null, false),
    half(["CNPJ / CPF", "00.000.000/0000-00", true], ["CNAE principal", "0000-0/00, se conhecido", false]),
    full("Ramo de atividade / segmento", "Ex.: metalurgia, logística, comércio", false),
  ]),
  spacer(),

  sectionTitle(2, "Contato geral da empresa"),
  formTable("CANAIS INSTITUCIONAIS", [
    half(["E-mail", "Ex.: contato@empresa.com.br", false], ["Telefone", "Com DDD", false]),
  ]),
  spacer(),

  sectionTitle(3, "Endereço da sede"),
  formTable("ENDEREÇO", [
    half(["CEP", "00000-000", false], ["Número", null, false]),
    full("Logradouro", "Rua, avenida, rodovia etc.", false),
    half(["Complemento", null, false], ["Bairro", null, false]),
    half(["Município", null, true], ["UF", "Ex.: SP", true]),
  ]),
  spacer(),

  sectionTitle(4, "Unidades e estabelecimentos adicionais"),
  p(t("Preencha somente se os serviços envolverem outros locais além da sede.", { size: 18, color: GRAY_TXT, italics: true }), { after: 100, keepNext: true }),
  ...[1, 2].flatMap((n) => [
    formTable(`UNIDADE ${n}`, [
      half(["Nome da unidade", "Ex.: Filial Votorantim", false], ["CNPJ da unidade", "Se houver", false]),
      full("Endereço completo", "Logradouro, número, bairro, município/UF e CEP", false),
      full("Contato local", "Responsável pelo acesso, portaria etc.", false),
    ]),
    spacer(120),
  ]),

  sectionTitle(5, "Contatos e responsáveis"),
  p(t("Informe ao menos um contato, com e-mail ou telefone. Indique o contato principal para o relacionamento com a AUDITA.", { size: 18, color: GRAY_TXT, italics: true }), { after: 100, keepNext: true }),
  ...[1, 2].flatMap((n) => [
    formTable(`CONTATO ${n}`, [
      half(["Nome", null, n === 1], ["Cargo / função", null, false]),
      half(["E-mail", null, false], ["Telefone", "Com DDD", false]),
      half(["Unidade vinculada", "Sede ou nome da unidade", false], ["Finalidade", "Comercial, financeiro, técnico…", false]),
      checkboxRow("Contato principal?", ["Sim", "Não"], null, false),
    ]),
    spacer(120),
  ]),

  sectionTitle(6, "Observações"),
  new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    rows: [
      headRow("INFORMAÇÕES ADICIONAIS", 1),
      new TableRow({ height: { value: 1300, rule: HeightRule.ATLEAST }, children: [cell(blank(), W, { vAlign: VerticalAlign.TOP })] }),
    ],
  }),
  spacer(),

  sectionTitle(7, "Declaração e proteção de dados"),
  p(
    t("Declaro que as informações prestadas nesta ficha são verdadeiras e estou autorizado(a) a fornecê-las em nome da empresa. Os dados serão tratados pela AUDITA somente para cadastro, comunicação, elaboração de propostas e contratos e execução dos serviços contratados, com acesso restrito, em conformidade com a Lei nº 13.709/2018 (LGPD). Solicite a atualização ou correção dos dados a qualquer momento pelo e-mail engenharia.audita@outlook.com.", { size: 20 }),
    { align: AlignmentType.JUSTIFIED },
  ),
  new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [3000, 2400, 2638, 1600],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        children: ["RESPONSÁVEL PELO PREENCHIMENTO", "FUNÇÃO", "ASSINATURA", "DATA"].map((h, i) =>
          cell(p(t(h, { size: 18, bold: true, color: "FFFFFF" }), { after: 0 }), [3000, 2400, 2638, 1600][i], { fill: NAVY }),
        ),
      }),
      new TableRow({
        height: { value: 700, rule: HeightRule.ATLEAST },
        children: [3000, 2400, 2638, 1600].map((w) => cell(blank(), w)),
      }),
    ],
  }),
  spacer(),

  // Uso interno (preenchido pela AUDITA ao cadastrar no sistema)
  new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [2200, 2619, 2200, 2619],
    layout: TableLayoutType.FIXED,
    rows: [
      headRow("USO INTERNO DA AUDITA — NÃO PREENCHER", 4),
      formRow([["Código do cliente", "Gerado pelo sistema", false, 2200, 2619], ["Recebido em", null, false, 2200, 2619]]),
      formRow([["Cadastrado por", null, false, 2200, 2619], ["Cadastrado em", null, false, 2200, 2619]]),
    ],
  }),
];

const doc = new Document({
  creator: "AUDITA",
  title: `${CODE} — ${TITLE}`,
  description: `${CODE} ${REV} — ${STATUS}`,
  styles: {
    default: { document: { run: { font: FONT, size: 20 }, paragraph: { spacing: { line: 276, after: 120 } } } },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134, header: 284, footer: 340 },
        },
      },
      headers: { default: header },
      footers: { default: footer },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(__dirname + "/AUDFOR001_Ficha_Cadastral_de_Cliente_Rev00_Minuta.docx", buf);
  console.log("ok");
});
