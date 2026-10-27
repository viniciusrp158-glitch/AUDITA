/**
 * Lista Mestra de Serviços e Treinamentos (documento AUDDOC019, pedido do Diretor em 27/10/2026).
 * O conteúdo sai sempre do catálogo (AUDDOC004/005) e dos treinamentos EAD cadastrados: ninguém digita a lista.
 * Cada revisão guarda a "impressão digital" do conteúdo nas observações; quando o catálogo muda, a impressão digital
 * deixa de bater com a revisão vigente e o sistema avisa. A nova revisão só vira vigente com a aprovação do Diretor.
 * Este arquivo não acessa o banco (conteúdo e documento); as consultas ficam em master-list.ts.
 */
import { createHash } from "node:crypto";
import { renderDocx } from "@/lib/documents/render-docx";
import type { Block, DocModel } from "@/lib/documents/proposal";
import { COMMERCIAL_STATUS, type CommercialStatus } from "@/lib/services/labels";

export const MASTER_LIST_CODE = "AUDDOC019";
export const MASTER_LIST_TITLE = "Lista Mestra de Serviços e Treinamentos";
export const FINGERPRINT_RE = /Impressão digital: ([0-9a-f]{16})/;

export type MasterService = {
  service_code: string;
  kind: "servico" | "oferta";
  name: string;
  family: string;
  modality: string | null;
  legal_reference: string | null;
  billing_unit_ref: string | null;
  pricing_model: string;
  commercial_status: CommercialStatus;
  catalog_status: string;
  /** Só para os pontos de atenção da tela (não entra no documento nem na impressão digital). */
  scope_preliminary?: string | null;
  updated_at: string;
  created_at: string;
};
export type MasterCourse = {
  course_code: string;
  title: string;
  status: string;
  price: string | null;
  access_days: number | null;
  version_label: string | null;
  workload_minutes: number | null;
  updated_at: string;
  created_at: string;
  published_at: string | null;
};
export type MasterListData = { services: MasterService[]; courses: MasterCourse[] };


/** Impressão digital só do que aparece no documento (datas de alteração não contam). */
export function masterFingerprint(d: MasterListData): string {
  const canon = {
    s: d.services.map((s) => [s.service_code, s.kind, s.name, s.family, s.modality, s.legal_reference, s.billing_unit_ref, s.pricing_model, s.commercial_status, s.catalog_status]),
    c: d.courses.map((c) => [c.course_code, c.title, c.status, c.price, c.access_days, c.version_label, c.workload_minutes]),
  };
  return createHash("sha256").update(JSON.stringify(canon)).digest("hex").slice(0, 16);
}

const day = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const brl = (v: string | null) =>
  v === null ? "PENDENTE" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hours = (min: number | null) => (min === null ? "—" : `${(min / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`);
const PRICING = { hora_tecnica: "Hora técnica (AUDDOC011)", sem_modelo_definido: "Sem modelo definido — PENDENTE" } as Record<string, string>;

export function masterListBlocks(d: MasterListData, meta: { revision: string; approvedBy: string; approvedOn: string; fingerprint: string }): Block[] {
  const active = d.services.filter((s) => s.catalog_status === "ativo");
  const released = active.filter((s) => s.commercial_status === "apto_comercialmente");
  const notReleased = active.filter((s) => s.commercial_status !== "apto_comercialmente");
  const inactive = d.services.filter((s) => s.catalog_status !== "ativo");
  const families = [...new Set(released.map((s) => s.family))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const svcRow = (s: MasterService) => [
    `${s.kind === "oferta" ? "  " : ""}${s.service_code}`,
    s.name,
    s.modality ?? "—",
    s.legal_reference ?? "—",
    PRICING[s.pricing_model] ?? s.pricing_model,
  ];
  const svcTable = (rows: MasterService[]): Block => ({
    kind: "table",
    headers: ["Código", "Serviço / treinamento", "Modalidade", "Referência legal", "Precificação"],
    widths: [13, 33, 20, 18, 16],
    align: ["left", "left", "left", "left", "left"],
    rows: rows.map(svcRow),
    totals: [],
  });

  const blocks: Block[] = [
    {
      kind: "fields",
      rows: [
        ["Documento", `${MASTER_LIST_CODE} — ${MASTER_LIST_TITLE}`],
        ["Revisão", meta.revision],
        ["Aprovação", `${meta.approvedBy} em ${day(meta.approvedOn)}`],
        ["Origem dos dados", "Gerado automaticamente pelo Sistema AUDITA a partir do catálogo de serviços (AUDDOC004/005) e dos treinamentos EAD cadastrados."],
        ["Impressão digital do conteúdo", meta.fingerprint],
      ],
    },
    {
      kind: "notice",
      label: "Uso",
      text: "Somente os serviços da seção 1 podem gerar proposta comercial final (AUDDOC004 / AUDDOC017 RF-17). Valores ausentes aparecem como PENDENTE e não são orçados.",
    },
    { kind: "heading", text: `1. Serviços liberados para orçamento (${released.length})` },
  ];
  for (const f of families) {
    blocks.push({ kind: "paragraph", text: f.toUpperCase() });
    blocks.push(svcTable(released.filter((s) => s.family === f)));
  }
  blocks.push({ kind: "heading", text: `2. Treinamentos EAD (${d.courses.length})` });
  blocks.push({
    kind: "table",
    headers: ["Código", "Treinamento", "Versão publicada", "Carga horária", "Preço", "Situação"],
    widths: [10, 38, 13, 12, 14, 13],
    align: ["left", "left", "center", "center", "right", "left"],
    rows: d.courses.map((c) => [c.course_code, c.title, c.version_label ?? "Sem versão publicada", hours(c.workload_minutes), brl(c.price), c.status === "ativo" ? "Ativo" : "Inativo"]),
    totals: [],
  });
  blocks.push({ kind: "heading", text: `3. Serviços ainda não liberados (${notReleased.length}) — não orçar` });
  blocks.push({
    kind: "table",
    headers: ["Código", "Serviço", "Família", "Situação (AUDDOC005 §14)"],
    widths: [14, 46, 18, 22],
    align: ["left", "left", "left", "left"],
    rows: notReleased.map((s) => [s.service_code, s.name, s.family, COMMERCIAL_STATUS[s.commercial_status]?.label ?? s.commercial_status]),
    totals: [],
  });
  if (inactive.length) {
    blocks.push({ kind: "heading", text: `4. Inativos no catálogo (${inactive.length})` });
    blocks.push({
      kind: "table",
      headers: ["Código", "Serviço", "Família"],
      widths: [16, 60, 24],
      align: ["left", "left", "left"],
      rows: inactive.map((s) => [s.service_code, s.name, s.family]),
      totals: [],
    });
  }
  return blocks;
}

export async function renderMasterListDocx(d: MasterListData, meta: { revision: string; approvedBy: string; approvedOn: string; fingerprint: string; preview?: boolean; test?: boolean }): Promise<Buffer> {
  const model: DocModel = {
    templateCode: MASTER_LIST_CODE,
    modelCode: "LISTA",
    title: MASTER_LIST_TITLE,
    reference: meta.revision,
    headerRight: `${MASTER_LIST_CODE} · ${MASTER_LIST_TITLE} · ${meta.revision}`,
    footer: `AUDITA · ${MASTER_LIST_CODE} ${meta.revision} · Gerado pelo Sistema AUDITA em ${day(meta.approvedOn)} · Aprovado por ${meta.approvedBy}`,
    watermark: meta.preview ? "PRÉVIA — AINDA NÃO APROVADA" : meta.test ? "AMBIENTE DE TESTE — SEM VALIDADE" : null,
    fileBase: `${MASTER_LIST_CODE}_Lista_Mestra_Servicos_Treinamentos_${meta.revision.replace(".", "")}`,
    blocks: masterListBlocks(d, meta),
  };
  return renderDocx(model);
}

export const fingerprintNote = (fp: string, changes: string[]) =>
  `Gerada automaticamente pelo sistema a partir do catálogo e dos treinamentos. Impressão digital: ${fp}.${
    changes.length ? ` Alterações desde a revisão anterior: ${changes.join("; ")}` : ""
  }`.slice(0, 2000);

/** Pontos de atenção do catálogo para orçar (aparecem na tela da Lista Mestra; a decisão é do Diretor). */
export function masterListWarnings(d: MasterListData): string[] {
  const released = d.services.filter((s) => s.catalog_status === "ativo" && s.commercial_status === "apto_comercialmente");
  const out: string[] = [];
  for (const s of released) {
    if (s.pricing_model === "sem_modelo_definido") out.push(`${s.service_code} — ${s.name}: liberado, mas sem modelo de precificação (PENDENTE; não entra nos totais do orçamento).`);
    if (s.scope_preliminary !== undefined && !(s.scope_preliminary ?? "").trim()) out.push(`${s.service_code} — ${s.name}: liberado, mas sem escopo preliminar no catálogo.`);
  }
  for (const c of d.courses.filter((x) => x.status === "ativo")) {
    if (!c.version_label) out.push(`${c.course_code} — ${c.title}: treinamento EAD ativo sem versão publicada.`);
    else if (c.price === null) out.push(`${c.course_code} — ${c.title}: publicado sem preço (PENDENTE).`);
  }
  return out;
}
