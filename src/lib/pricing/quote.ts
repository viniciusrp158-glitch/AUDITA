/**
 * Ponte entre os registros do banco (parâmetros e itens) e o motor AUDDOC011.
 * Isomórfico: usado nas telas do servidor e na prévia ao vivo do formulário.
 */
import Decimal from "decimal.js";
import { calculate, type PricingParams, type PricingResult } from "./engine";
import type { ItemStatus, Periodicity } from "./labels";

type N = string | number | null;

export type ParameterValues = {
  pro_labore: N;
  fixed_costs: N;
  billable_hours: N;
  taxes: N;
  payment_fees: N;
  commission: N;
  contingency: N;
  target_margin: N;
  max_discount: N;
};

export type ItemValues = {
  description: string | null;
  service_id: string | null;
  periodicity: Periodicity;
  hours_preparation: N;
  hours_execution: N;
  hours_delivery: N;
  hours_followup: N;
  hours_travel: N;
  cost_travel: N;
  cost_materials: N;
  cost_external: N;
  cost_other: N;
  contingency: N;
  margin: N;
  discount: N;
};

export type ServiceInfo = {
  pricing_model: string;
  commercial_status: string;
  catalog_status: string;
} | null;

export function toEngineParams(p: ParameterValues | null): PricingParams {
  return {
    proLabore: p?.pro_labore ?? null,
    fixedCosts: p?.fixed_costs ?? null,
    billableHours: p?.billable_hours ?? null,
    taxes: p?.taxes ?? null,
    paymentFees: p?.payment_fees ?? null,
    commission: p?.commission ?? null,
    contingency: p?.contingency ?? null,
    targetMargin: p?.target_margin ?? null,
    maxDiscount: p?.max_discount ?? null,
  };
}

export type ItemCalc = {
  result: PricingResult;
  status: ItemStatus;
  /** Serviço do catálogo ainda não liberado comercialmente (AUDDOC004): simulação permitida, emissão bloqueada no I6. */
  notReleased: boolean;
  /** SaaS (SIS-001/SIS-002) sem modelo de precificação aprovado: não é calculado pela hora técnica. */
  noModel: boolean;
};

export function calculateItem(params: ParameterValues | null, item: ItemValues, service: ServiceInfo, clientIdentified = true): ItemCalc {
  const noModel = service?.pricing_model === "sem_modelo_definido";
  const notReleased = Boolean(service) && !(service!.commercial_status === "apto_comercialmente" && service!.catalog_status === "ativo");
  const result = calculate(toEngineParams(params), {
    identified: clientIdentified && Boolean((item.description ?? "").trim()) ,
    hours: [item.hours_preparation, item.hours_execution, item.hours_delivery, item.hours_followup, item.hours_travel],
    directCosts: [item.cost_travel, item.cost_materials, item.cost_external, item.cost_other],
    contingency: item.contingency,
    margin: item.margin,
    discount: item.discount,
  });
  if (!params) result.reasons.unshift("Nenhuma versão vigente de parâmetros financeiros adotada nesta cotação.");
  if (noModel) {
    return {
      result: { ...result, suggestedPrice: null, finalPrice: null, effectiveMargin: null, projectedResult: null, chargesOnPrice: null },
      status: "SEM_MODELO",
      notReleased,
      noModel,
    };
  }
  return { result, status: result.status, notReleased, noModel };
}

export type Totals = {
  /** Soma dos preços finais por periodicidade; null quando algum item da periodicidade não está PRONTO. */
  unica: { total: Decimal | null; count: number; pending: number };
  mensal: { total: Decimal | null; count: number; pending: number };
  ready: number;
  pending: number;
};

/**
 * Totais separados por periodicidade (G-07): nunca soma valor único com mensal.
 * Soma os preços comerciais de cada item (preço final arredondado a centavos), para que o total
 * mostrado na tela e na proposta seja sempre igual à soma das linhas.
 */
export function quoteTotals(items: { periodicity: Periodicity; calc: ItemCalc }[]): Totals {
  const acc = (p: Periodicity) => {
    const list = items.filter((i) => i.periodicity === p && i.calc.status !== "SEM_MODELO");
    const pending = list.filter((i) => i.calc.status !== "PRONTO").length;
    const total =
      list.length === 0 || pending > 0
        ? null
        : list.reduce(
            (s, i) => s.plus(new Decimal(i.calc.result.finalPrice!.toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)),
            new Decimal(0),
          );
    return { total, count: list.length, pending };
  };
  const unica = acc("unica");
  const mensal = acc("mensal");
  const ready = items.filter((i) => i.calc.status === "PRONTO").length;
  return { unica, mensal, ready, pending: items.length - ready };
}
