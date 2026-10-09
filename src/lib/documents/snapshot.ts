/**
 * Snapshot imutável de uma revisão (RF-14 / CA-08) e conferência de integridade antes da emissão.
 * O banco grava os dados de origem (cliente, conteúdo, itens, parâmetros); a aplicação grava os resultados do motor.
 */
import Decimal from "decimal.js";
import type { Periodicity } from "@/lib/pricing/labels";
import { calculateItem, type ItemValues, type ParameterValues, type ServiceInfo } from "@/lib/pricing/quote";

type N = string | number | null;

export type SnapshotItem = ItemValues & {
  id: string;
  position: number;
  quantity_ref: string | null;
  scope_notes: string | null;
  discount_reason: string | null;
  service: (NonNullable<ServiceInfo> & { service_code: string; name: string; family: string; billing_unit_ref: string | null }) | null;
};

export type ItemResult = {
  id: string;
  status: string;
  hours: string | null;
  cost_with_contingency: string | null;
  suggested_price: string | null;
  final_price: string | null;
  /** Preço comercial do item: preço final arredondado a centavos (o que o cliente vê e o que é somado). */
  price: string | null;
  effective_margin: string | null;
};

export type RevisionResults = {
  parameter_set_id: string;
  engine: string;
  items: ItemResult[];
  totals: { unica: string | null; mensal: string | null };
};

export type QuoteSnapshot = {
  schema: number;
  frozen_at: string;
  quote: {
    id: string;
    code: string;
    revision: number;
    model: "ANX01" | "ANX02";
    validity_days: number | null;
    payment_terms: string | null;
    objective: string | null;
    scope_included: string | null;
    scope_excluded: string | null;
    location_modality: string | null;
    schedule: string | null;
    methodology: string | null;
    deliverables: string | null;
    completion_criteria: string | null;
    additional_expenses: string | null;
    cancellation_terms: string | null;
    next_step: string | null;
    is_test: boolean;
  };
  demand: { id: string; code: string; summary: string };
  client: {
    id: string;
    code: string;
    person_type: "PJ" | "PF";
    legal_name: string;
    trade_name: string | null;
    tax_id: string | null;
    address_street: string | null;
    address_number: string | null;
    address_complement: string | null;
    address_district: string | null;
    address_city: string | null;
    address_state: string | null;
    address_zip: string | null;
    is_test: boolean;
  };
  unit: { id: string; name: string; address_city: string | null; address_state: string | null } | null;
  contact: { id: string; full_name: string; role_title: string | null; email: string | null; phone: string | null } | null;
  parameters: ParameterValues & { id: string; version: number; label: string; is_test: boolean; status: string };
  items: SnapshotItem[];
  results: RevisionResults;
};

export const ENGINE_VERSION = "AUDDOC011-ANX01/motor-v1";

const toStr = (x: { toString(): string } | null) => (x === null ? null : x.toString());
const cents = (x: Decimal | { toString(): string } | null) =>
  x === null ? null : new Decimal(x.toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/** Resultados do motor para gravação na revisão. Totais = soma dos preços comerciais (centavos) por periodicidade. */
export function buildResults(
  parameterSetId: string,
  params: ParameterValues,
  items: (ItemValues & { id: string; services: ServiceInfo })[],
): { results: RevisionResults; allReady: boolean } {
  const out: ItemResult[] = [];
  const sums: Record<Periodicity, Decimal | null> = { unica: null, mensal: null };
  let allReady = items.length > 0;
  for (const it of items) {
    const c = calculateItem(params, it, it.services);
    if (c.status !== "PRONTO") allReady = false;
    const price = cents(c.result.finalPrice);
    out.push({
      id: it.id,
      status: c.status,
      hours: toStr(c.result.hours),
      cost_with_contingency: toStr(c.result.costWithContingency),
      suggested_price: toStr(c.result.suggestedPrice),
      final_price: toStr(c.result.finalPrice),
      price: price === null ? null : price.toFixed(2),
      effective_margin: toStr(c.result.effectiveMargin),
    });
    if (price !== null) sums[it.periodicity] = (sums[it.periodicity] ?? new Decimal(0)).plus(price);
  }
  return {
    results: {
      parameter_set_id: parameterSetId,
      engine: ENGINE_VERSION,
      items: out,
      totals: { unica: sums.unica?.toFixed(2) ?? null, mensal: sums.mensal?.toFixed(2) ?? null },
    },
    allReady,
  };
}

/** Recalcula a partir dos dados congelados e confere com os resultados gravados (integridade antes da emissão). */
export function verifySnapshot(s: QuoteSnapshot): string[] {
  const problems: string[] = [];
  const { results } = buildResults(s.parameters.id, s.parameters, s.items.map((i) => ({ ...i, services: i.service })));
  if (results.items.length !== s.results.items.length) problems.push("Quantidade de itens diverge do snapshot.");
  for (const r of results.items) {
    const saved = s.results.items.find((x) => x.id === r.id);
    if (!saved) problems.push(`Item ${r.id} ausente nos resultados gravados.`);
    else if (saved.final_price !== r.final_price || saved.price !== r.price || saved.status !== r.status)
      problems.push(`Item ${r.id}: resultado gravado difere do recálculo.`);
  }
  if (results.totals.unica !== s.results.totals.unica || results.totals.mensal !== s.results.totals.mensal)
    problems.push("Totais gravados diferem do recálculo.");
  return problems;
}

export function revisionLabel(n: number): string {
  return `Rev.${String(n).padStart(2, "0")}`;
}

export function num(x: N): string | null {
  return x === null || x === undefined ? null : String(x);
}
