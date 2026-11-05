/**
 * AUDDOC018 — Modelos Operacionais de SST e Treinamento, Rev.00 (05/11/2026).
 * O documento existia na Biblioteca só com os anexos (ANX01–ANX10, aprovados em 12/10/2026). Esta Rev.00 é o
 * documento-índice: identifica cada modelo, o formato, a revisão vigente e os serviços do catálogo que o usam.
 * Só dados já registrados (Biblioteca e catálogo); nada novo é criado.
 * Uso: npx vite-node --config vitest.config.ts scripts/biblioteca/auddoc018-rev00.ts <pasta com a018.json e catalogo.json>
 */
import fs from "node:fs";
import path from "node:path";
import { renderDocx } from "@/lib/documents/render-docx";
import type { Block } from "@/lib/documents/proposal";

type Doc = { doc_code: string; title: string; revision: string | null; status: string | null; original_name: string | null; approved_on: string | null };
type Svc = { service_code: string; name: string; status_basis: string | null; commercial_status: string };

const dir = process.argv[2];
const docs: Doc[] = JSON.parse(fs.readFileSync(path.join(dir, "a018.json"), "utf8"));
const catalog: Svc[] = JSON.parse(fs.readFileSync(path.join(dir, "catalogo.json"), "utf8"));
const CODE = "AUDDOC018";
const TITLE = "Modelos Operacionais de SST e Treinamento";
const REV = "Rev.00";
const TODAY = "05/11/2026";

const FORMAT: Record<string, string> = { docx: "Word (.docx)", xlsx: "Excel (.xlsx)", pptx: "PowerPoint (.pptx)" };
const annexes = docs.filter((d) => d.doc_code !== CODE);

// Serviços que citam o anexo no fundamento da liberação; os treinamentos citam a família inteira (ANX01–ANX04)
const TRAINING_ANNEXES = ["ANX01", "ANX02", "ANX03", "ANX04"];
function usedBy(code: string): string {
  const suffix = code.slice(-5);
  const direct = catalog.filter((s) => (s.status_basis ?? "").includes(code)).map((s) => s.service_code);
  const training = TRAINING_ANNEXES.includes(suffix)
    ? catalog.filter((s) => s.service_code.startsWith("TRN") && /AUDDOC018 \(Rev/.test(s.status_basis ?? "")).length
    : 0;
  const parts = [...direct];
  if (training) parts.push(`${training} treinamentos (TRN)`);
  return parts.length ? parts.join(", ") : "Sem vínculo registrado no catálogo";
}

const blocks: Block[] = [
  {
    kind: "fields",
    rows: [
      ["Código", CODE],
      ["Título", TITLE],
      ["Revisão", `${REV} — documento-índice da família de modelos`],
      ["Situação", "Documento interno — família aprovada pelo Diretor em 12/10/2026"],
      ["Aprovação desta revisão", "Vinicius Rocha Pereira — Diretor, conforme registro de publicação na Biblioteca do Sistema AUDITA"],
      ["Documento-base", "AUDDOC001 — Padrão de Documentos AUDITA (PDA)"],
      ["Elaboração", `Elaboração assistida (Claude), em ${TODAY}, a partir dos registros da Biblioteca e do catálogo do Sistema AUDITA`],
    ],
  },
  { kind: "heading", text: "1. Objetivo" },
  {
    kind: "paragraph",
    text: "Reunir em um único documento controlado os modelos operacionais da AUDITA usados na prestação dos serviços de SST e nos treinamentos, indicando o código, o formato, a revisão vigente de cada modelo e os serviços do catálogo que dependem dele. Os modelos em si são os anexos AUDDOC018-ANX01 a ANX10, cada um com revisão própria na Biblioteca.",
  },
  { kind: "heading", text: `2. Modelos da família (${annexes.length})` },
  {
    kind: "table",
    headers: ["Código", "Modelo", "Formato", "Revisão vigente", "Usado por"],
    widths: [17, 30, 15, 16, 22],
    align: ["left", "left", "left", "left", "left"],
    rows: annexes.map((a) => [
      a.doc_code,
      a.title,
      FORMAT[(a.original_name ?? "").split(".").pop() ?? ""] ?? "—",
      a.revision && a.status === "vigente" ? `${a.revision} — ${a.approved_on}` : "PENDENTE",
      usedBy(a.doc_code),
    ]),
    totals: [],
  },
  { kind: "heading", text: "3. Regras de uso" },
  ...[
    "3.1. Usar sempre a revisão vigente do anexo, baixada da Biblioteca do Sistema AUDITA; não reutilizar cópias antigas.",
    "3.2. Os modelos são preenchidos por atendimento; o modelo em branco não é alterado. Mudança de conteúdo do modelo exige nova revisão do anexo.",
    "3.3. Documentos que exigem responsável técnico (por exemplo, relatório técnico com ressalvas) seguem as condições registradas na liberação do serviço no catálogo.",
    "3.4. Registros preenchidos seguem a guarda e a rastreabilidade do AUDDOC013.",
  ].map((text): Block => ({ kind: "paragraph", text })),
  { kind: "heading", text: "4. Controle de revisões" },
  {
    kind: "table",
    headers: ["Revisão", "Data", "Responsável", "Descrição"],
    widths: [12, 14, 28, 46],
    align: ["left", "left", "left", "left"],
    rows: [
      [REV, TODAY, "Vinicius Rocha Pereira — Diretor", "Primeira emissão do documento-índice da família AUDDOC018 (os anexos ANX01–ANX10 estão vigentes desde 12/10/2026). Elaboração assistida; aprovação registrada na Biblioteca do Sistema AUDITA."],
    ],
    totals: [],
  },
];

const buf = await renderDocx({
  templateCode: CODE,
  modelCode: "INDICE",
  title: TITLE,
  reference: REV,
  headerRight: `${CODE} · ${TITLE} · ${REV}`,
  footer: `AUDITA · ${CODE} ${REV} · Aprovação registrada na Biblioteca do Sistema AUDITA`,
  watermark: null,
  fileBase: `${CODE}_Modelos_Operacionais_SST_Treinamento_Rev00`,
  blocks,
});
const out = path.join(dir, `${CODE}_Modelos_Operacionais_SST_Treinamento_Rev00.docx`);
fs.writeFileSync(out, buf);
console.log(out, buf.length);
