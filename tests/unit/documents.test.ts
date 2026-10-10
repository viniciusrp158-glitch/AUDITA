/**
 * I6 — Conteúdo e geração dos documentos (AUDDOC010-ANX01/ANX02; AUDDOC017 RF-15, RF-17, CA-08).
 * Gera DOCX e PDF a partir de um snapshot fictício e confere conteúdo, totais, marca d'água e ausência de dados internos.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildDocument, documentTotalsMatch, TEST_WATERMARK } from "@/lib/documents/proposal";
import { renderDocx } from "@/lib/documents/render-docx";
import { renderPdf } from "@/lib/documents/render-pdf";
import { buildResults, verifySnapshot, type QuoteSnapshot } from "@/lib/documents/snapshot";

const PARAMS = {
  id: "00000000-0000-4000-8000-000000000001",
  version: 1,
  label: "[TESTE] Parâmetros fictícios",
  status: "vigente",
  is_test: true,
  pro_labore: "8000",
  fixed_costs: "2000",
  billable_hours: "100",
  taxes: "0.112",
  payment_fees: "0.0299",
  commission: "0.05",
  contingency: "0.1",
  target_margin: "0.25",
  max_discount: "0.1",
};
const svc = (code: string, name: string) => ({
  service_code: code,
  name,
  family: "Consultoria",
  pricing_model: "hora_tecnica",
  commercial_status: "apto_comercialmente",
  catalog_status: "ativo",
  billing_unit_ref: "mensalidade / visitas",
});
const base = {
  hours_preparation: null,
  hours_delivery: null,
  hours_followup: null,
  hours_travel: null,
  cost_travel: null,
  cost_materials: null,
  cost_external: null,
  contingency: null,
  margin: null,
  discount: null,
  scope_notes: null,
  discount_reason: null,
};
const ITEMS = [
  {
    ...base,
    id: "00000000-0000-4000-8000-0000000000a1",
    position: 1,
    service_id: "s1",
    description: "Treinamento de integração de SST",
    periodicity: "unica" as const,
    quantity_ref: "2 turmas",
    hours_execution: "19",
    cost_other: "250",
    service: svc("TRN-001", "Integração e orientações introdutórias de SST"),
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-0000000000a2",
    position: 2,
    service_id: "s2",
    description: "Consultoria recorrente com 2 visitas mensais",
    periodicity: "mensal" as const,
    quantity_ref: null,
    hours_execution: "8",
    cost_other: "0",
    service: svc("SST-001", "Consultoria recorrente de SST para pequenas empresas"),
  },
];

function snapshot(model: "ANX01" | "ANX02"): QuoteSnapshot {
  const { results } = buildResults(PARAMS.id, PARAMS, ITEMS.map((i) => ({ ...i, services: i.service })));
  return {
    schema: 1,
    frozen_at: "2026-10-09T20:00:00Z",
    quote: {
      id: "q1",
      code: "PROP-2026-0999",
      revision: 0,
      model,
      validity_days: 15,
      payment_terms: "[Teste] 30 dias após a emissão da nota.",
      objective: "[Teste] Estruturar rotinas básicas de SST.",
      scope_included: "[Teste] Duas turmas de integração e duas visitas mensais.",
      scope_excluded: "[Teste] Laudos, medições e ART.",
      location_modality: "[Teste] Presencial — Sorocaba/SP",
      schedule: "[Teste] Início em até 10 dias após o aceite.",
      methodology: "[Teste] Visitas e registros.",
      deliverables: "[Teste] Lista de presença e relatório mensal.",
      completion_criteria: "[Teste] Entrega dos registros.",
      additional_expenses: "[Teste] Não se aplica.",
      cancellation_terms: "[Teste] Reagendamento com 48 h.",
      next_step: "[Teste] Agendar a primeira visita.",
      is_test: true,
    },
    demand: { id: "d1", code: "DEM-2026-0999", summary: "[Teste] Demanda" },
    client: {
      id: "c1",
      code: "CLI-0999",
      person_type: "PJ",
      legal_name: "[Teste automatizado] Cliente Fictício LTDA",
      trade_name: null,
      tax_id: "11222333000181",
      address_street: "Rua Fictícia",
      address_number: "100",
      address_complement: null,
      address_district: "Centro",
      address_city: "Sorocaba",
      address_state: "SP",
      address_zip: "18000000",
      is_test: true,
    },
    unit: null,
    contact: { id: "ct1", full_name: "Responsável Fictício", role_title: "Gerente", email: "responsavel@exemplo.test", phone: "15999998888" },
    parameters: PARAMS,
    items: ITEMS,
    results,
  };
}

const CTX = { issuedOn: "2026-10-09", watermark: true, templateRevision: "Rev.00", technicalVersion: "v1" };

async function docxText(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")!.async("string");
  const header = await zip.file(/word\/header\d*\.xml/)[0].async("string");
  const strip = (x: string) => x.replace(/<[^>]+>/g, "");
  return { body: strip(xml), header: strip(header) };
}

describe("documentos da proposta (M01/M02)", () => {
  it("snapshot íntegro: recálculo confere e total = soma das linhas", () => {
    const s = snapshot("ANX01");
    expect(verifySnapshot(s)).toEqual([]);
    expect(documentTotalsMatch(s)).toBe(true);
    expect(s.results.totals.unica).toBe("4237.59");
    const tampered = structuredClone(s);
    tampered.results.items[0].price = "1.00";
    expect(verifySnapshot(tampered).length).toBeGreaterThan(0);
  });

  it("M01: campos do modelo preenchidos, totais único × mensal separados, marca d'água e sem dados internos", async () => {
    const s = snapshot("ANX01");
    const model = buildDocument(s, CTX);
    const buf = await renderDocx(model);
    const { body, header } = await docxText(buf);
    for (const expected of [
      "Proposta comercial",
      "PROP-2026-0999 Rev.00",
      "Emissão: 09/10/2026",
      "Validade: 15 dias (até 24/10/2026)",
      "CNPJ 11.222.333/0001-81",
      "Responsável Fictício, Gerente",
      "AUDITA — razão social e CNPJ pendentes de formalização",
      "Cliente CLI-0999 · Demanda DEM-2026-0999 · Serviço AUDDOC005 TRN-001, SST-001",
      "VALOR TOTAL — PARCELA ÚNICA",
      "R$ 4.237,59",
      "VALOR MENSAL (RECORRENTE)",
      "R$ 1.576,78/mês",
      "ATENÇÃO",
      TEST_WATERMARK,
    ])
      expect(body, expected).toContain(expected);
    expect(header).toContain("PROP-2026-0999 Rev.00");
    // Nada de custos, horas, parâmetros ou margens no documento do cliente
    for (const internal of ["custo", "Custo", "margem", "Margem", "contingência", "pró-labore", "19 h", "2.365", "0.25"])
      expect(body, internal).not.toContain(internal);

    const pdf = await renderPdf(model);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    mkdirSync("test-results/documentos", { recursive: true });
    writeFileSync(`test-results/documentos/${model.fileBase}.docx`, buf);
    writeFileSync(`test-results/documentos/${model.fileBase}.pdf`, pdf);
  });

  it("M02: orçamento simplificado com tabela QTDE/VALOR UNIT./TOTAL e próximo passo", async () => {
    const s = snapshot("ANX02");
    const model = buildDocument(s, { ...CTX, watermark: false });
    const { body } = await docxText(await renderDocx(model));
    for (const expected of ["Orçamento simplificado", "Referência", "DESCRIÇÃO DO ITEM", "VALOR UNIT.", "TOTAL — PARCELA ÚNICA", "Próximo passo", "USO CORRETO"])
      expect(body, expected).toContain(expected);
    expect(body).not.toContain(TEST_WATERMARK);
    expect(model.fileBase).toBe("PROP-2026-0999_Rev00_Orcamento");
    const pdf = await renderPdf(model);
    writeFileSync(`test-results/documentos/${model.fileBase}.pdf`, pdf);
  });
});
