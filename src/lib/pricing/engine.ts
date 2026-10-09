/**
 * Motor de precificação — AUDDOC011 Rev.00 §4 e AUDDOC011-ANX01 (aba "Simulador", células B27–B45).
 *
 * Fiel ao simulador aprovado, com duas garantias do projeto (decisão G-01 do S0):
 *  - aritmética decimal exata (sem erro binário de ponto flutuante);
 *  - margem efetiva × margem-alvo comparadas com 4 casas decimais.
 * Nenhum valor é presumido: parâmetro ausente ⇒ resultado ausente e situação PENDENTE.
 * Percentuais são frações (0,25 = 25%). Valores intermediários não são arredondados;
 * o arredondamento a centavos ocorre apenas na apresentação.
 */
import Decimal from "decimal.js";

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
type Dec = InstanceType<typeof D>;
export type Num = string | number | null | undefined;

export type PricingParams = {
  proLabore: Num; // R$/mês (Parâmetros B7)
  fixedCosts: Num; // R$/mês (B8)
  billableHours: Num; // h/mês (B9)
  taxes: Num; // fração (B11)
  paymentFees: Num; // fração (B12)
  commission: Num; // fração (B13)
  contingency: Num; // fração (B14)
  targetMargin: Num; // fração (B15)
  maxDiscount: Num; // fração (B16)
};

export type ItemInput = {
  /** Cliente e serviço identificados (Simulador B7/B8). */
  identified: boolean;
  /** Horas: preparação, execução, entrega/relatório, acompanhamento, deslocamento (B12–B15; G-02). */
  hours: Num[];
  /** Custos diretos R$: deslocamentos/pedágios, materiais, profissionais externos, demais (B16–B19). */
  directCosts: Num[];
  contingency?: Num; // específica (B20)
  margin?: Num; // específica (B21)
  discount?: Num; // aplicado (B22)
};

export type Status =
  | "PENDENTE_IDENTIFICACAO"
  | "PENDENTE_PARAMETROS"
  | "REVER_VALORES"
  | "REVER_DESCONTO"
  | "REVER_MARGEM"
  | "PRONTO";

export const STATUS_LABEL: Record<Status, string> = {
  PENDENTE_IDENTIFICACAO: "PENDENTE: IDENTIFICAÇÃO",
  PENDENTE_PARAMETROS: "PENDENTE: CUSTOS / PARÂMETROS",
  REVER_VALORES: "REVER VALORES",
  REVER_DESCONTO: "REVER DESCONTO",
  REVER_MARGEM: "REVER MARGEM",
  PRONTO: "PRONTO PARA ANÁLISE INTERNA",
};

export type PricingResult = {
  hours: Dec | null; // B27
  costPerHour: Dec | null; // B28 (Parâmetros B10)
  labor: Dec | null; // B29
  directCosts: Dec | null; // B30
  baseCost: Dec | null; // B31
  contingency: Dec | null; // B32
  costWithContingency: Dec | null; // B33
  taxes: Dec | null; // B34
  paymentFees: Dec | null; // B35
  commission: Dec | null; // B36
  targetMargin: Dec | null; // B37
  percentSum: Dec | null; // B38
  suggestedPrice: Dec | null; // B39
  discount: Dec; // B40
  finalPrice: Dec | null; // B41
  chargesOnPrice: Dec | null; // B42
  projectedResult: Dec | null; // B43
  effectiveMargin: Dec | null; // B44
  status: Status; // B45
  /** Motivos legíveis das pendências e revisões (não alteram o cálculo). */
  reasons: string[];
};

/** Converte entrada em decimal; vazio/ inválido ⇒ null (equivale a célula vazia no simulador). */
export function dec(v: Num): Dec | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? new D(v) : null;
  const s = v.trim();
  if (s === "") return null;
  try {
    const d = new D(s);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

/** SOMA do Excel com a condição "CONT.NÚM = 0 ⇒ vazio". */
function sumIfAny(values: Num[]): Dec | null {
  const nums = values.map(dec).filter((x): x is Dec => x !== null);
  return nums.length === 0 ? null : nums.reduce((a, b) => a.plus(b), new D(0));
}

export function costPerHour(p: PricingParams): Dec | null {
  const pro = dec(p.proLabore);
  const fix = dec(p.fixedCosts);
  const hrs = dec(p.billableHours);
  if (pro === null || fix === null || hrs === null || hrs.lte(0)) return null;
  return pro.plus(fix).div(hrs);
}

const round4 = (x: Dec) => x.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

export function calculate(p: PricingParams, item: ItemInput): PricingResult {
  const reasons: string[] = [];

  const hours = sumIfAny(item.hours); // B27
  const cph = costPerHour(p); // B28
  const labor = hours !== null && cph !== null ? hours.times(cph) : null; // B29
  const direct = sumIfAny(item.directCosts); // B30
  const baseCost = labor !== null && direct !== null ? labor.plus(direct) : null; // B31
  const contingency = dec(item.contingency) ?? dec(p.contingency); // B32
  const costWithCont = baseCost !== null && contingency !== null ? baseCost.times(contingency.plus(1)) : null; // B33
  const taxes = dec(p.taxes); // B34
  const fees = dec(p.paymentFees); // B35
  const commission = dec(p.commission); // B36
  const margin = dec(item.margin) ?? dec(p.targetMargin); // B37
  const percentSum =
    taxes !== null && fees !== null && commission !== null && margin !== null ? taxes.plus(fees).plus(commission).plus(margin) : null; // B38
  const suggested =
    costWithCont !== null && percentSum !== null && percentSum.lt(1) ? costWithCont.div(new D(1).minus(percentSum)) : null; // B39
  const discount = dec(item.discount) ?? new D(0); // B40
  const finalPrice = suggested !== null ? suggested.times(new D(1).minus(discount)) : null; // B41
  const charges =
    finalPrice !== null && taxes !== null && fees !== null && commission !== null ? finalPrice.times(taxes.plus(fees).plus(commission)) : null; // B42
  const result = finalPrice !== null && costWithCont !== null && charges !== null ? finalPrice.minus(costWithCont).minus(charges) : null; // B43
  const effMargin = finalPrice !== null && finalPrice.gt(0) && result !== null ? result.div(finalPrice) : null; // B44

  // B45 — situação da simulação (mesma ordem de testes do simulador)
  let status: Status;
  const maxDiscount = dec(p.maxDiscount);
  if (!item.identified) {
    status = "PENDENTE_IDENTIFICACAO";
    reasons.push("Cliente e serviço precisam estar identificados.");
  } else if (suggested === null || finalPrice === null || effMargin === null) {
    status = "PENDENTE_PARAMETROS";
  } else if (finalPrice.lte(0) || (percentSum !== null && percentSum.gte(1)) || (costWithCont !== null && costWithCont.lte(0))) {
    status = "REVER_VALORES";
  } else if (maxDiscount !== null && discount.gt(maxDiscount)) {
    status = "REVER_DESCONTO";
  } else if (margin !== null && round4(effMargin).lt(round4(margin))) {
    status = "REVER_MARGEM";
  } else {
    status = "PRONTO";
  }

  // Motivos (orientação ao usuário; mesmas condições do cálculo acima)
  if (status !== "PENDENTE_IDENTIFICACAO") {
    if (hours === null) reasons.push("Horas do serviço não informadas.");
    if (cph === null) reasons.push("Custo/hora indefinido: pró-labore, despesas fixas ou horas faturáveis (> 0) não definidos.");
    if (direct === null) reasons.push("Despesas diretas não informadas (informe 0 se não houver).");
    if (contingency === null) reasons.push("Contingência não definida (informe 0 se não se aplicar).");
    if (taxes === null) reasons.push("Tributos estimados não definidos.");
    if (fees === null) reasons.push("Taxas de recebimento não definidas (0 se não se aplicar).");
    if (commission === null) reasons.push("Comissão não definida (0 se não se aplicar).");
    if (margin === null) reasons.push("Margem-alvo não definida.");
    if (percentSum !== null && percentSum.gte(1))
      reasons.push("Tributos + taxas + comissão + margem ≥ 100%: preço sugerido bloqueado (AUDDOC011 §4.5).");
    if (suggested !== null && finalPrice !== null && finalPrice.lte(0)) reasons.push("Preço após desconto igual a zero.");
    if (costWithCont !== null && costWithCont.lte(0) && suggested !== null) reasons.push("Custo total igual a zero.");
    if (status === "REVER_DESCONTO") reasons.push("Desconto acima do máximo definido nos parâmetros.");
    if (status === "REVER_MARGEM") reasons.push("Margem efetiva abaixo da margem-alvo.");
  }

  return {
    hours,
    costPerHour: cph,
    labor,
    directCosts: direct,
    baseCost,
    contingency,
    costWithContingency: costWithCont,
    taxes,
    paymentFees: fees,
    commission,
    targetMargin: margin,
    percentSum,
    suggestedPrice: suggested,
    discount,
    finalPrice,
    chargesOnPrice: charges,
    projectedResult: result,
    effectiveMargin: effMargin,
    status,
    reasons,
  };
}

/** Valor para gravação/transporte (string decimal sem perda) ou null. */
export function toPlain(x: Dec | null): string | null {
  return x === null ? null : x.toString();
}

/** R$ com 2 casas (arredondamento comercial), só para apresentação. */
export function formatBRL(x: Num | Dec | null): string {
  const d = x !== null && x !== undefined && typeof x === "object" ? (x as Dec) : dec(x as Num);
  if (d === null) return "—";
  const fixed = d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const [int, frac] = fixed.abs().toFixed(2).split(".");
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${fixed.isNeg() ? "-" : ""}R$ ${withDots},${frac}`;
}

/** Percentual com até 2 casas ("25%", "11,2%"). */
export function formatPercent(x: Num | Dec | null): string {
  const d = x !== null && x !== undefined && typeof x === "object" ? (x as Dec) : dec(x as Num);
  if (d === null) return "—";
  const pct = d.times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return `${pct.toString().replace(".", ",")}%`;
}

/** Horas com até 2 casas ("19,5 h"). */
export function formatHours(x: Num | Dec | null): string {
  const d = x !== null && x !== undefined && typeof x === "object" ? (x as Dec) : dec(x as Num);
  if (d === null) return "—";
  return `${d.toDecimalPlaces(2).toString().replace(".", ",")} h`;
}

/** Entrada brasileira ("1.234,56", "12,5") → string decimal ("1234.56", "12.5"); vazio ⇒ null. */
export function parseBR(input: string | null | undefined): string | null {
  const s = (input ?? "").trim().replace(/\s|R\$|%/g, "");
  if (s === "") return null;
  // pt-BR: vírgula é decimal e ponto é milhar ("2.000" = dois mil). Sem vírgula, ponto só é decimal
  // quando não segue o padrão de milhares (ex.: "1.5"). Pontos fora do padrão de milhar ⇒ inválido.
  const thousands = /^-?\d{1,3}(\.\d{3})+$/;
  let normalized: string;
  if (s.includes(",")) {
    const [int, frac, ...rest] = s.split(",");
    if (rest.length || !/^\d+$/.test(frac ?? "") || !(thousands.test(int) || /^-?\d+$/.test(int))) return "invalid";
    normalized = `${int.replace(/\./g, "")}.${frac}`;
  } else {
    normalized = thousands.test(s) ? s.replace(/\./g, "") : s;
  }
  return /^-?\d+(\.\d+)?$/.test(normalized) ? normalized : "invalid";
}

/** Percentual digitado ("12,5") → fração decimal ("0.125"). */
export function percentToFraction(input: string | null | undefined): string | null {
  const p = parseBR(input);
  if (p === null || p === "invalid") return p;
  return new D(p).div(100).toString();
}

/** Fração ("0.125") → texto para campo de percentual ("12,5"). */
export function fractionToPercentInput(v: Num): string {
  const d = dec(v);
  return d === null ? "" : d.times(100).toDecimalPlaces(6).toString().replace(".", ",");
}

/** Número ("1234.5") → texto para campo ("1234,5"). */
export function numberToInput(v: Num): string {
  const d = dec(v);
  return d === null ? "" : d.toString().replace(".", ",");
}
