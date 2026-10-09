/**
 * Motor AUDDOC011 × simulador oficial ANX01 (AUDDOC017 CA-05, CA-06, CA-07; RF-10, RF-11, RF-12).
 * Os valores esperados foram calculados pela própria planilha ANX01 (LibreOffice) — ver tests/fixtures.
 */
import { describe, expect, it } from "vitest";
import fixtures from "../fixtures/anx01-simulador.json";
import {
  calculate,
  dec,
  formatBRL,
  formatPercent,
  parseBR,
  percentToFraction,
  STATUS_LABEL,
  type PricingParams,
} from "@/lib/pricing/engine";

type Fx = (typeof fixtures)["cenarios"][number];

function toParams(p: Fx["params"]): PricingParams {
  return {
    proLabore: p.pro,
    fixedCosts: p.fix,
    billableHours: p.hrs,
    taxes: p.trib,
    paymentFees: p.taxa,
    commission: p.com,
    contingency: p.cont,
    targetMargin: p.marg,
    maxDiscount: p.desc,
  };
}

const MAP: [keyof ReturnType<typeof calculate>, string][] = [
  ["hours", "B27"],
  ["costPerHour", "B28"],
  ["labor", "B29"],
  ["directCosts", "B30"],
  ["baseCost", "B31"],
  ["contingency", "B32"],
  ["costWithContingency", "B33"],
  ["taxes", "B34"],
  ["paymentFees", "B35"],
  ["commission", "B36"],
  ["targetMargin", "B37"],
  ["percentSum", "B38"],
  ["suggestedPrice", "B39"],
  ["discount", "B40"],
  ["finalPrice", "B41"],
  ["chargesOnPrice", "B42"],
  ["projectedResult", "B43"],
  ["effectiveMargin", "B44"],
];

describe("motor AUDDOC011 reproduz o simulador ANX01 célula a célula", () => {
  for (const fx of fixtures.cenarios) {
    it(`cenário ${fx.name}`, () => {
      const r = calculate(toParams(fx.params), {
        identified: Boolean(fx.input.cli && fx.input.svc),
        hours: [...fx.input.h, null],
        directCosts: fx.input.c,
        contingency: fx.input.cont,
        margin: fx.input.marg,
        discount: fx.input.desc,
      });
      const exp = fx.expected as Record<string, number | string | null>;
      for (const [key, cell] of MAP) {
        const got = r[key] as { toNumber(): number } | null;
        const want = exp[cell];
        if (want === null || want === "" || want === undefined) {
          expect(got, `${fx.name} ${cell}`).toBeNull();
        } else {
          expect(got, `${fx.name} ${cell}`).not.toBeNull();
          expect(got!.toNumber(), `${fx.name} ${cell}`).toBeCloseTo(Number(want), 9);
        }
      }
      expect(STATUS_LABEL[r.status], `${fx.name} B45`).toBe(exp.B45);
    });
  }
});

const P: PricingParams = {
  proLabore: "8000",
  fixedCosts: "2000",
  billableHours: "100",
  taxes: "0.112",
  paymentFees: "0.0299",
  commission: "0.05",
  contingency: "0.1",
  targetMargin: "0.25",
  maxDiscount: "0.1",
};
const ITEM = { identified: true, hours: ["4", "10", "3", "2", "0"], directCosts: ["150", "80", "0", "20"] };

describe("regras do AUDDOC011 / AUDDOC017", () => {
  it("fórmulas §4: custo/hora, custo base, contingência, preço, desconto e margem", () => {
    const r = calculate(P, { ...ITEM, discount: "0.05" });
    expect(r.costPerHour!.toString()).toBe("100"); // (8000+2000)/100
    expect(r.hours!.toString()).toBe("19");
    expect(r.baseCost!.toString()).toBe("2150"); // 19*100 + 250
    expect(r.costWithContingency!.toString()).toBe("2365"); // *1,10
    const s = r.percentSum!; // 0,4419
    expect(s.toString()).toBe("0.4419");
    expect(r.suggestedPrice!.toString()).toBe(r.costWithContingency!.div(s.neg().plus(1)).toString());
    expect(r.finalPrice!.toString()).toBe(r.suggestedPrice!.times(0.95).toString());
  });

  it("deslocamento técnico entra nas horas (5 campos, G-02) sem duplicar custo", () => {
    const a = calculate(P, { ...ITEM, hours: ["4", "10", "3", "2", "1.5"] });
    expect(a.hours!.toString()).toBe("20.5");
    expect(a.directCosts!.toString()).toBe("250");
  });

  it("CA-05 / RF-11: parâmetros faltantes ⇒ PENDENTE e nenhum preço", () => {
    for (const k of Object.keys(P) as (keyof PricingParams)[]) {
      if (k === "maxDiscount") continue;
      const r = calculate({ ...P, [k]: null }, ITEM);
      expect(r.status, k).toBe("PENDENTE_PARAMETROS");
      expect(r.suggestedPrice, k).toBeNull();
      expect(r.finalPrice, k).toBeNull();
      expect(r.reasons.length, k).toBeGreaterThan(0);
    }
  });

  it("RF-12 / CA-07: soma ≥ 100% bloqueia preço; desconto acima do máximo gera alerta", () => {
    const r = calculate({ ...P, targetMargin: "0.8081" }, ITEM); // soma = 1,0000
    expect(r.suggestedPrice).toBeNull();
    expect(r.reasons.join(" ")).toContain("≥ 100%");
    const d = calculate(P, { ...ITEM, discount: "0.11" });
    expect(d.status).toBe("REVER_DESCONTO");
    const ok = calculate(P, { ...ITEM, discount: "0.10" }); // no limite: permitido
    expect(ok.status).not.toBe("REVER_DESCONTO");
  });

  it("G-01: sem desconto a margem efetiva iguala a meta e nunca cai em REVER MARGEM por arredondamento", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) {
      const params: PricingParams = {
        ...P,
        proLabore: (1000 + Math.floor(rnd() * 20000)).toString(),
        fixedCosts: (Math.floor(rnd() * 5000 * 100) / 100).toString(),
        billableHours: (20 + Math.floor(rnd() * 160)).toString(),
        taxes: ["0.06", "0.0933", "0.112", "0.1633"][i % 4],
        paymentFees: ["0", "0.0299", "0.0499"][i % 3],
        commission: ["0", "0.05", "0.1"][i % 3],
        targetMargin: ["0.15", "0.2", "0.25", "0.3", "0.35"][i % 5],
        contingency: ["0", "0.05", "0.1"][i % 3],
      };
      const r = calculate(params, {
        identified: true,
        hours: [(rnd() * 40).toFixed(2), (rnd() * 40).toFixed(2)],
        directCosts: [(rnd() * 3000).toFixed(2)],
      });
      expect(r.status).toBe("PRONTO");
      expect(r.effectiveMargin!.toDecimalPlaces(4).eq(dec(params.targetMargin)!)).toBe(true);
    }
  });

  it("vazio ≠ zero: contingência/taxas 0 explícitas calculam; vazias deixam PENDENTE", () => {
    const zero = calculate({ ...P, contingency: "0", paymentFees: "0", commission: "0" }, ITEM);
    expect(zero.status).toBe("PRONTO");
    const vazio = calculate({ ...P, contingency: null }, ITEM);
    expect(vazio.status).toBe("PENDENTE_PARAMETROS");
    expect(vazio.reasons.join(" ")).toContain("Contingência");
  });

  it("valores específicos do item prevalecem sobre os parâmetros gerais", () => {
    const r = calculate(P, { ...ITEM, contingency: "0", margin: "0.3" });
    expect(r.contingency!.toString()).toBe("0");
    expect(r.targetMargin!.toString()).toBe("0.3");
  });
});

describe("formatação e entrada em pt-BR", () => {
  it("BRL com 2 casas e arredondamento comercial", () => {
    expect(formatBRL("4237.59182942125")).toBe("R$ 4.237,59");
    expect(formatBRL("1234567.005")).toBe("R$ 1.234.567,01");
    expect(formatBRL(null)).toBe("—");
  });
  it("percentuais e entradas brasileiras", () => {
    expect(formatPercent("0.112")).toBe("11,2%");
    expect(parseBR("1.234,56")).toBe("1234.56");
    expect(parseBR("12,5")).toBe("12.5");
    expect(parseBR("2.000")).toBe("2000"); // milhar em pt-BR
    expect(parseBR("1.234.567")).toBe("1234567");
    expect(parseBR("1.5")).toBe("1.5");
    expect(parseBR("1.234,5.6")).toBe("invalid");
    expect(parseBR("")).toBeNull();
    expect(parseBR("abc")).toBe("invalid");
    expect(percentToFraction("11,2")).toBe("0.112");
    expect(percentToFraction("2,99")).toBe("0.0299");
  });
});
