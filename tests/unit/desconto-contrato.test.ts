/**
 * Ajustes do Diretor no I6 (10/10/2026):
 *  - desconto autorizado: qualquer desconto deixa a margem abaixo da meta (ANX01 B45); dentro do máximo pode seguir
 *    com autorização expressa (AUDDOC011 §§4.6 e 5); acima do máximo continua bloqueado;
 *  - tempo de contrato dos serviços mensais: data final e valor total na proposta.
 */
import { describe, expect, it } from "vitest";
import { contractEnd, contractSummary } from "@/lib/documents/proposal";
import { calculateItem, quoteTotals, type ItemValues } from "@/lib/pricing/quote";

const P = {
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
const ITEM: ItemValues = {
  description: "Item",
  service_id: "s",
  periodicity: "unica",
  hours_preparation: null,
  hours_execution: "19",
  hours_delivery: null,
  hours_followup: null,
  hours_travel: null,
  cost_travel: null,
  cost_materials: null,
  cost_external: null,
  cost_other: "250",
  contingency: null,
  margin: null,
  discount: null,
};

describe("desconto autorizado (AUDDOC011 §§4.6 e 5)", () => {
  it("qualquer desconto ⇒ REVER MARGEM; aumentar a margem específica não resolve (ela vira a meta)", () => {
    for (const d of ["0.01", "0.05", "0.1"]) {
      expect(calculateItem(P, { ...ITEM, discount: d }, null).status, d).toBe("REVER_MARGEM");
      expect(calculateItem(P, { ...ITEM, discount: d, margin: "0.4" }, null).status, `${d} c/ margem 40%`).toBe("REVER_MARGEM");
    }
  });

  it("sem autorização não segue; com autorização segue, mantendo a situação fiel à planilha", () => {
    const sem = calculateItem(P, { ...ITEM, discount: "0.05" }, null);
    expect(sem.accepted).toBe(false);
    expect(sem.result.reasons.join(" ")).toContain("autorize o desconto");
    const com = calculateItem(P, { ...ITEM, discount: "0.05", discount_authorized: true }, null);
    expect(com.status).toBe("REVER_MARGEM");
    expect(com.accepted).toBe(true);
    expect(com.discountAuthorized).toBe(true);
    expect(com.result.finalPrice!.toDecimalPlaces(2).toString()).toBe("4025.71"); // 4.237,59 × 0,95
  });

  it("acima do desconto máximo continua bloqueado, mesmo marcado como autorizado", () => {
    const c = calculateItem(P, { ...ITEM, discount: "0.11", discount_authorized: true }, null);
    expect(c.status).toBe("REVER_DESCONTO");
    expect(c.accepted).toBe(false);
  });

  it("totais consideram itens com desconto autorizado", () => {
    const items = [
      { periodicity: "unica" as const, calc: calculateItem(P, ITEM, null) },
      { periodicity: "unica" as const, calc: calculateItem(P, { ...ITEM, discount: "0.05", discount_authorized: true }, null) },
    ];
    expect(quoteTotals(items).unica.total!.toFixed(2)).toBe("8263.30"); // 4.237,59 + 4.025,71
  });
});

describe("tempo de contrato (serviços mensais)", () => {
  it("data final = véspera do início do período seguinte", () => {
    expect(contractEnd("2026-11-01", 12)).toBe("2027-10-31");
    expect(contractEnd("2027-01-15", 1)).toBe("2027-02-14");
    expect(contractEnd("2027-01-31", 1)).toBe("2027-02-28");
    expect(contractEnd("2028-01-31", 1)).toBe("2028-02-29"); // ano bissexto
    expect(contractEnd("2026-12-01", 3)).toBe("2027-02-28");
  });
  it("resumo em pt-BR", () => {
    expect(contractSummary("2026-11-01", 12)).toBe("12 meses — de 01/11/2026 a 31/10/2027");
    expect(contractSummary("2026-11-01", 1)).toBe("1 mês — de 01/11/2026 a 30/11/2026");
    expect(contractSummary(null, 6)).toBe("6 meses (início a definir)");
  });
});
