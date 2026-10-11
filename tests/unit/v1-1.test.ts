/**
 * V1.1 — caixa mensal (AUDDOC011 §7, fórmula da aba "Caixa Mensal") e documentos M03–M06 (AUDDOC010-ANX03 a ANX06; RF-23).
 * Dados fictícios de teste.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildContractDocument, LEGAL_WATERMARK, type ContractDocInput } from "@/lib/documents/contracts";
import { TEST_WATERMARK } from "@/lib/documents/proposal";
import { renderDocx } from "@/lib/documents/render-docx";
import { renderPdf } from "@/lib/documents/render-pdf";
import { monthlyCash } from "@/lib/execucao/cash";
import { activitiesToText, parseActivities } from "@/lib/execucao/labels";

describe("V1.1 — caixa mensal", () => {
  it("saldo do mês = recebimentos − pagamentos; acumulado só nos meses com lançamento; estornos e outro ano fora; decimal exato", () => {
    const { months, year } = monthlyCash(
      [
        { occurred_on: "2026-01-10", category: "recebimento", amount: "1000.10", status: "lancado" },
        { occurred_on: "2026-01-15", category: "tributo", amount: "100.05", status: "lancado" },
        { occurred_on: "2026-01-20", category: "fixo", amount: "0.10", status: "lancado" },
        { occurred_on: "2026-01-21", category: "recebimento", amount: "999", status: "estornado" },
        { occurred_on: "2026-03-05", category: "pro_labore", amount: "1500", status: "lancado" },
        { occurred_on: "2025-12-31", category: "recebimento", amount: "77", status: "lancado" },
      ],
      2026,
    );
    expect(months[0]).toMatchObject({ hasEntries: true, payments: "100.15", balance: "899.95", cumulative: "899.95" });
    expect(months[1]).toMatchObject({ hasEntries: false, balance: null, cumulative: null });
    expect(months[2]).toMatchObject({ balance: "-1500.00", cumulative: "-600.05" });
    expect(year).toMatchObject({ recebimento: "1000.10", tributo: "100.05", fixo: "0.10", pro_labore: "1500.00", payments: "1600.15", balance: "-600.05" });
    // 0,1 + 0,2 exatos (sem erro de ponto flutuante)
    const f = monthlyCash(
      [
        { occurred_on: "2026-05-01", category: "outro", amount: "0.1", status: "lancado" },
        { occurred_on: "2026-05-02", category: "outro", amount: "0.2", status: "lancado" },
      ],
      2026,
    );
    expect(f.months[4].totals.outro).toBe("0.30");
  });

  it("atividades da OS: uma por linha, com entrega e condição opcionais (até 20)", () => {
    const a = parseActivities("Visita técnica | Relatório | EPI\n\nIntegração | Lista de presença\n" + "x\n".repeat(30));
    expect(a[0]).toEqual({ atividade: "Visita técnica", entrega: "Relatório", condicao: "EPI" });
    expect(a[1]).toEqual({ atividade: "Integração", entrega: "Lista de presença" });
    expect(a).toHaveLength(20);
    expect(activitiesToText(a.slice(0, 2))).toBe("Visita técnica | Relatório | EPI\nIntegração | Lista de presença");
  });
});

const BASE: ContractDocInput = {
  issuedOn: "2026-10-11",
  test: true,
  contract: {
    code: "CTR-2026-0001",
    modality: "recorrente",
    starts_on: "2026-11-01",
    ends_on: "2027-10-31",
    executor_name: "Executor Fictício",
    executor_role: "Técnico de segurança (fictício)",
    client_representative: null,
    scope_summary: "[TESTE] Rotinas de SST",
    deliverables: "Relatório mensal",
    additional_conditions: null,
  },
  client: { code: "CLI-0999", legal_name: "[Teste automatizado] Cliente Fictício LTDA", tax_id: "11222333000181", address: "Rua Fictícia, 100, Centro, Sorocaba/SP", city_uf: "Sorocaba/SP" },
  quote: {
    code: "PROP-2026-0999",
    revision: 0,
    accepted_on: "2026-10-10",
    accepted_by_name: "Responsável Fictício",
    decision_reference: "E-mail de 10/10/2026",
    total_once: null,
    total_monthly: "1576.78",
    schedule: "Duas visitas mensais",
    location_modality: "Presencial",
    scope_included: "Visitas e registros",
    scope_excluded: "Laudos",
    service_codes: "SST-001",
  },
  proponent: null,
};

async function docxText(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  return (await zip.file("word/document.xml")!.async("string")).replace(/<[^>]+>/g, "");
}

describe("V1.1 — documentos M03–M06", () => {
  it("M03 e M04: dados dos cadastros; ausências viram [PENDENTE] e são listadas; minuta jurídica sempre identificada", async () => {
    mkdirSync("test-results/documentos", { recursive: true });
    const m03 = buildContractDocument("M03", BASE);
    expect(m03.missing).toEqual(["Representante do cliente"]);
    const t03 = await docxText(await renderDocx(m03.model));
    for (const s of ["PROP-2026-0999 Rev.00", "R$ 1.576,78/mês (recorrente)", "[PENDENTE: Representante do cliente]", "DECLARAÇÃO DE ACEITE", "MINUTA"]) expect(t03, s).toContain(s);
    expect(m03.model.watermark).toBe(TEST_WATERMARK);
    expect(m03.model.footer).toContain(LEGAL_WATERMARK);

    const m04 = buildContractDocument("M04", BASE);
    // sem dados institucionais e sem cláusulas jurídicas negociadas: nada inventado
    expect(m04.missing).toEqual(
      expect.arrayContaining([
        "Razão social da AUDITA",
        "CNPJ da AUDITA",
        "Condições negociadas de alteração, suspensão e encerramento (revisão jurídica)",
        "Cláusula de responsabilidade e foro validada pela assessoria jurídica",
      ]),
    );
    const t04 = await docxText(await renderDocx(m04.model));
    for (const s of ["CNPJ 11.222.333/0001-81", "01/11/2026 até 31/10/2027", "Cláusula 5 — Responsabilidades e limites", "REVISÃO OBRIGATÓRIA", "[PENDENTE: CNPJ da AUDITA]"])
      expect(t04, s).toContain(s);
    const pdf = await renderPdf(m04.model);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    writeFileSync(`test-results/documentos/${m04.model.fileBase}.pdf`, pdf);
    expect(buildContractDocument("M03", { ...BASE, test: false }).model.watermark).toBe(LEGAL_WATERMARK);
  });

  it("M05 (OS-COM) e M06 (ALT): tabela de atividades, liberação e quadro antes/depois com valores em BRL", async () => {
    const m05 = buildContractDocument("M05", {
      ...BASE,
      order: {
        code: "OS-COM-2026-0001",
        scheduled_start: "2026-11-03",
        scheduled_end: null,
        time_window: "8h às 12h",
        location: "Unidade fictícia",
        executor_name: "Executor Fictício",
        executor_role: null,
        client_contact: null,
        activities: [{ atividade: "Visita técnica", entrega: "Relatório", condicao: "EPI" }],
        access_conditions: "Integração prévia",
        pending_conditions: null,
        released_by_name: null,
        released_on: null,
        status: "rascunho",
      },
    });
    expect(m05.missing).toEqual(["Contato operacional no cliente"]);
    const t05 = await docxText(await renderDocx(m05.model));
    for (const s of ["OS-COM-2026-0001", "Visita técnica", "NÃO LIBERADA — aguardando requisitos", "NÃO CONFUNDIR INSTRUMENTOS"]) expect(t05, s).toContain(s);

    const m06 = buildContractDocument("M06", {
      ...BASE,
      change: {
        code: "ALT-2026-0001",
        reason: "Inclusão de uma unidade",
        activities_before: null,
        activities_after: "Visitas em duas unidades",
        deadline_before: null,
        deadline_after: null,
        value_before: "1576.78",
        value_after: "1890.00",
        deliverables_before: null,
        deliverables_after: null,
        client_approval: "Responsável Fictício, 11/10/2026, e-mail",
        validated_by_name: "Diretor",
        validated_on: "2026-10-11",
        documents_update: null,
      },
    });
    const t06 = await docxText(await renderDocx(m06.model));
    for (const s of ["ALT-2026-0001", "R$ 1.576,78", "R$ 1.890,00", "Visitas em duas unidades", "Diretor — 11/10/2026"]) expect(t06, s).toContain(s);
    expect(m06.missing).toEqual(["Responsável pela autorização"]);
  });
});
