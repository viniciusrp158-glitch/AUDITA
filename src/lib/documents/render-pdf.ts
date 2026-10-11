import "server-only";
import pdfmake from "pdfmake";
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { FONT_BOLD, FONT_REGULAR, LOGO_PNG } from "./assets/embedded";
import type { Block, DocModel } from "./proposal";

// AUDDOC001: A4, margens de 20 mm (≈ 56,7 pt), fonte métrica Arial. AUDDOC003: #031B35 / #80BB08.
const NAVY = "#031B35";
const GREEN = "#80BB08";
const LIGHT = "#EEF1F5";
const LINE = "#C9D1DB";
const MUTED = "#5B6573";
const MM = 2.8346;

// Partes da API do pdfmake 0.3 (servidor) que os tipos publicados ainda não descrevem.
type PdfmakeServer = typeof pdfmake & {
  virtualfs: { writeFileSync(name: string, data: Buffer): void };
  setLocalAccessPolicy(cb: (path: string) => boolean): void;
};
const pm = pdfmake as PdfmakeServer;

let ready = false;
function setup() {
  if (ready) return;
  pm.virtualfs.writeFileSync("LiberationSans-Regular.ttf", Buffer.from(FONT_REGULAR, "base64"));
  pm.virtualfs.writeFileSync("LiberationSans-Bold.ttf", Buffer.from(FONT_BOLD, "base64"));
  pdfmake.setFonts({
    Arial: {
      normal: "LiberationSans-Regular.ttf",
      bold: "LiberationSans-Bold.ttf",
      italics: "LiberationSans-Regular.ttf",
      bolditalics: "LiberationSans-Bold.ttf",
    },
  });
  // Documento 100% autocontido: nenhum acesso a URLs ou arquivos locais.
  pdfmake.setUrlAccessPolicy(() => false);
  pm.setLocalAccessPolicy(() => false);
  ready = true;
}

/** Fontes e políticas de acesso do pdfmake (usado também pela exportação das peças de comunicação). */
export function ensurePdfmake() {
  setup();
}

const gridLayout = {
  hLineWidth: () => 0.6,
  vLineWidth: () => 0.6,
  hLineColor: () => LINE,
  vLineColor: () => LINE,
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 3.5,
  paddingBottom: () => 3.5,
};

const head = (text: string, alignment: "left" | "right" | "center" = "left"): TableCell => ({
  text,
  bold: true,
  color: "#FFFFFF",
  fillColor: NAVY,
  alignment,
});

function block(b: Block): Content[] {
  switch (b.kind) {
    case "heading":
      return [{ text: b.text, bold: true, fontSize: 12, color: NAVY, margin: [0, 12, 0, 5] }];
    case "paragraph":
      return [{ text: b.text || "—", alignment: "justify", margin: [0, 0, 0, 6] }];
    case "fields":
      return [
        {
          table: {
            widths: ["30%", "70%"],
            headerRows: 1,
            keepWithHeaderRows: 1,
            dontBreakRows: true,
            body: [[head("CAMPO"), head("PREENCHIMENTO")], ...b.rows.map(([k, v]) => [{ text: k, bold: true, fillColor: LIGHT }, { text: v || "—" }])],
          },
          layout: gridLayout,
          margin: [0, 0, 0, 8],
        },
      ];
    case "columns":
      return [
        {
          table: { widths: ["50%", "50%"], headerRows: 1, keepWithHeaderRows: 1, dontBreakRows: true, body: [[head(b.headers[0]), head(b.headers[1])], [b.left || "—", b.right || "—"]] },
          layout: gridLayout,
          margin: [0, 0, 0, 8],
        },
      ];
    case "table": {
      const n = b.headers.length;
      return [
        {
          table: {
            widths: b.widths.map((x) => `${x}%`),
            headerRows: 1,
            keepWithHeaderRows: 1,
            dontBreakRows: true,
            body: [
              b.headers.map((h, i) => head(h, b.align[i])),
              ...b.rows.map((r) => r.map((c, i) => ({ text: c, alignment: b.align[i] }) as TableCell)),
              ...b.totals.map(
                ([label, value]) =>
                  [
                    { text: label, bold: true, fillColor: LIGHT, colSpan: n - 1 },
                    ...Array.from({ length: n - 2 }, () => ({})),
                    { text: value, bold: true, fillColor: LIGHT, alignment: "right" },
                  ] as TableCell[],
              ),
            ],
          },
          layout: gridLayout,
          margin: [0, 0, 0, 8],
        },
      ];
    }
    case "notice":
      return [
        {
          table: {
            widths: ["*"],
            body: [[{ text: [{ text: `${b.label} | `, bold: true, color: NAVY }, { text: b.text }], fillColor: LIGHT, margin: [4, 3, 4, 3] }]],
          },
          layout: {
            hLineWidth: () => 0.6,
            vLineWidth: (i: number) => (i === 0 ? 3 : 0.6),
            hLineColor: () => LINE,
            vLineColor: (i: number) => (i === 0 ? GREEN : LINE),
          },
          margin: [0, 6, 0, 6],
        },
      ];
  }
}

export async function renderPdf(m: DocModel): Promise<Buffer> {
  setup();
  const def: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [20 * MM, 26 * MM, 20 * MM, 20 * MM],
    info: { title: `${m.title} ${m.reference}`, author: "AUDITA", creator: "Sistema AUDITA", subject: m.templateCode },
    defaultStyle: { font: "Arial", fontSize: 9.5, lineHeight: 1.15, color: "#16202B" },
    watermark: m.watermark ? { text: m.watermark, color: "#B42318", opacity: 0.1, bold: true, fontSize: 22, angle: -45 } : undefined,
    header: () => ({
      margin: [20 * MM, 8 * MM, 20 * MM, 0],
      stack: [
        {
          columns: [
            { image: `data:image/png;base64,${LOGO_PNG}`, width: 72 },
            {
              stack: [
                { text: m.headerRight, bold: true, color: NAVY, alignment: "right", fontSize: 9 },
                ...(m.watermark ? [{ text: m.watermark, bold: true, color: "#B42318", alignment: "right" as const, fontSize: 8 }] : []),
              ],
            },
          ],
        },
        { canvas: [{ type: "line", x1: 0, y1: 4, x2: (210 - 40) * MM, y2: 4, lineWidth: 1.2, lineColor: GREEN }] },
      ],
    }),
    footer: (page: number, pages: number) => ({
      margin: [20 * MM, 4 * MM, 20 * MM, 0],
      columns: [
        { text: m.footer, fontSize: 7, color: MUTED, width: "*" },
        { text: `Página ${page} de ${pages}`, fontSize: 7, color: MUTED, alignment: "right", width: 70 },
      ],
    }),
    content: [
      ...(m.watermark
        ? [
            {
              table: { widths: ["*"], body: [[{ text: m.watermark, bold: true, color: "#B42318", alignment: "center" as const, fontSize: 11 }]] },
              layout: { hLineWidth: () => 1, vLineWidth: () => 0, hLineColor: () => "#B42318" },
              margin: [0, 0, 0, 8] as [number, number, number, number],
            },
          ]
        : []),
      { text: m.title, bold: true, fontSize: 16, color: NAVY },
      { text: `${m.reference} · ${m.modelCode} — ${m.templateCode}`, color: MUTED, fontSize: 9, margin: [0, 2, 0, 10] },
      ...m.blocks.flatMap(block),
    ],
  };
  const doc = pdfmake.createPdf(def);
  return (await doc.getBuffer()) as Buffer;
}
