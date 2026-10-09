import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { LOGO_PNG } from "./assets/embedded";
import type { Block, DocModel } from "./proposal";

// AUDDOC001: A4, margens de 20 mm, Arial. AUDDOC003: azul-marinho #031B35 e verde #80BB08.
const NAVY = "031B35";
const GREEN = "80BB08";
const LIGHT = "EEF1F5";
const RED = "B42318";
const FONT = "Arial";
const MM = 56.7; // twips por milímetro
const CONTENT_WIDTH = Math.round((210 - 40) * MM);

const border = { style: BorderStyle.SINGLE, size: 4, color: "C9D1DB" };
const borders = { top: border, bottom: border, left: border, right: border };

function runs(text: string, opts: { bold?: boolean; color?: string; size?: number } = {}): TextRun[] {
  const lines = (text || "—").split("\n");
  return lines.map(
    (line, i) => new TextRun({ text: line, font: FONT, bold: opts.bold, color: opts.color, size: opts.size ?? 20, break: i > 0 ? 1 : undefined }),
  );
}

function cell(text: string, o: { width: number; bold?: boolean; fill?: string; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; span?: number }) {
  return new TableCell({
    width: { size: o.width, type: WidthType.DXA },
    columnSpan: o.span,
    borders,
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ alignment: o.align, children: runs(text, { bold: o.bold, color: o.color }) })],
  });
}

function table(widthsPct: number[], rows: TableRow[]) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widthsPct.map((p) => Math.round((CONTENT_WIDTH * p) / 100)),
    layout: TableLayoutType.FIXED,
    rows,
  });
}

const w = (p: number) => Math.round((CONTENT_WIDTH * p) / 100);
const ALIGN = { left: AlignmentType.LEFT, right: AlignmentType.RIGHT, center: AlignmentType.CENTER } as const;

function block(b: Block): (Paragraph | Table)[] {
  switch (b.kind) {
    case "heading":
      return [new Paragraph({ spacing: { before: 280, after: 120 }, children: runs(b.text, { bold: true, color: NAVY, size: 24 }) })];
    case "paragraph":
      return [new Paragraph({ spacing: { after: 120 }, alignment: AlignmentType.JUSTIFIED, children: runs(b.text) })];
    case "fields":
      return [
        table(
          [30, 70],
          [
            new TableRow({ tableHeader: true, children: [cell("CAMPO", { width: w(30), bold: true, fill: NAVY, color: "FFFFFF" }), cell("PREENCHIMENTO", { width: w(70), bold: true, fill: NAVY, color: "FFFFFF" })] }),
            ...b.rows.map(([k, v]) => new TableRow({ cantSplit: true, children: [cell(k, { width: w(30), bold: true, fill: LIGHT }), cell(v, { width: w(70) })] })),
          ],
        ),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
      ];
    case "columns":
      return [
        table(
          [50, 50],
          [
            new TableRow({ tableHeader: true, children: b.headers.map((h) => cell(h, { width: w(50), bold: true, fill: NAVY, color: "FFFFFF" })) }),
            new TableRow({ children: [cell(b.left, { width: w(50) }), cell(b.right, { width: w(50) })] }),
          ],
        ),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
      ];
    case "table": {
      const total = b.widths.reduce((a, x) => a + x, 0);
      const firstSpan = b.widths.slice(0, -1).reduce((a, x) => a + x, 0);
      return [
        table(b.widths, [
          new TableRow({
            tableHeader: true,
            children: b.headers.map((h, i) => cell(h, { width: w(b.widths[i]), bold: true, fill: NAVY, color: "FFFFFF", align: ALIGN[b.align[i]] })),
          }),
          ...b.rows.map(
            (r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, { width: w(b.widths[i]), align: ALIGN[b.align[i]] })) }),
          ),
          ...b.totals.map(
            ([label, value]) =>
              new TableRow({
                cantSplit: true,
                children: [
                  cell(label, { width: w(firstSpan), span: b.widths.length - 1, bold: true, fill: LIGHT }),
                  cell(value, { width: w(total - firstSpan), bold: true, fill: LIGHT, align: AlignmentType.RIGHT }),
                ],
              }),
          ),
        ]),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
      ];
    }
    case "notice":
      return [
        table([100], [
          new TableRow({
            children: [
              new TableCell({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                borders: { ...borders, left: { style: BorderStyle.SINGLE, size: 24, color: GREEN } },
                shading: { type: ShadingType.CLEAR, color: "auto", fill: LIGHT },
                margins: { top: 80, bottom: 80, left: 140, right: 140 },
                children: [new Paragraph({ children: [...runs(`${b.label} | `, { bold: true, color: NAVY }), ...runs(b.text)] })],
              }),
            ],
          }),
        ]),
      ];
  }
}

export async function renderDocx(m: DocModel): Promise<Buffer> {
  const logo = Buffer.from(LOGO_PNG, "base64");
  const testBanner = m.watermark
    ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
          border: { top: { style: BorderStyle.SINGLE, size: 12, color: RED }, bottom: { style: BorderStyle.SINGLE, size: 12, color: RED } },
          children: runs(m.watermark, { bold: true, color: RED, size: 24 }),
        }),
      ]
    : [];

  const doc = new Document({
    creator: "Sistema AUDITA",
    title: `${m.title} ${m.reference}`,
    description: `${m.templateCode} — ${m.title}`,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: Math.round(210 * MM), height: Math.round(297 * MM) },
            margin: { top: Math.round(20 * MM), bottom: Math.round(20 * MM), left: Math.round(20 * MM), right: Math.round(20 * MM), header: Math.round(8 * MM), footer: Math.round(8 * MM) },
          },
        },
        headers: {
          default: new Header({
            children: [
              table([40, 60], [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: w(40), type: WidthType.DXA },
                      borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.SINGLE, size: 12, color: GREEN } },
                      children: [new Paragraph({ children: [new ImageRun({ type: "png", data: logo, transformation: { width: 96, height: 32 } })] })],
                    }),
                    new TableCell({
                      width: { size: w(60), type: WidthType.DXA },
                      borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.SINGLE, size: 12, color: GREEN } },
                      children: [
                        new Paragraph({ alignment: AlignmentType.RIGHT, children: runs(m.headerRight, { bold: true, color: NAVY, size: 18 }) }),
                        ...(m.watermark ? [new Paragraph({ alignment: AlignmentType.RIGHT, children: runs(m.watermark, { bold: true, color: RED, size: 16 }) })] : []),
                      ],
                    }),
                  ],
                }),
              ]),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({ alignment: AlignmentType.LEFT, children: runs(m.footer, { color: "5B6573", size: 14 }) }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ font: FONT, size: 14, color: "5B6573", children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES] }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...testBanner,
          new Paragraph({ spacing: { after: 60 }, children: runs(m.title, { bold: true, color: NAVY, size: 32 }) }),
          new Paragraph({ spacing: { after: 200 }, children: runs(`${m.reference} · ${m.modelCode} — ${m.templateCode}`, { color: "5B6573", size: 18 }) }),
          ...m.blocks.flatMap(block),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
