import type { Status } from "./engine";

/** Campos da aba "Parâmetros" do AUDDOC011-ANX01 (B7–B16). kind: valor em R$, horas ou percentual. */
export const PARAM_FIELDS = [
  { key: "pro_labore", engine: "proLabore", label: "Pró-labore mensal", kind: "money", cell: "B7", hint: "Retirada mensal prevista do responsável técnico." },
  { key: "fixed_costs", engine: "fixedCosts", label: "Despesas fixas mensais", kind: "money", cell: "B8", hint: "Contador, software, telefone, seguros, deslocamento fixo etc." },
  { key: "billable_hours", engine: "billableHours", label: "Horas faturáveis por mês", kind: "hours", cell: "B9", hint: "Horas efetivamente vendáveis (sem administração/prospecção)." },
  { key: "taxes", engine: "taxes", label: "Tributos estimados sobre o preço", kind: "percent", cell: "B11", hint: "Conforme regime tributário definido pelo contador." },
  { key: "payment_fees", engine: "paymentFees", label: "Taxas de recebimento", kind: "percent", cell: "B12", hint: "Boleto, cartão, intermediadores. Informe 0 se não houver." },
  { key: "commission", engine: "commission", label: "Comissão comercial", kind: "percent", cell: "B13", hint: "Informe 0 se não houver." },
  { key: "contingency", engine: "contingency", label: "Contingência padrão", kind: "percent", cell: "B14", hint: "Reserva para imprevistos; pode ser alterada por item." },
  { key: "target_margin", engine: "targetMargin", label: "Margem-alvo", kind: "percent", cell: "B15", hint: "Margem desejada sobre o preço; pode ser alterada por item." },
  { key: "max_discount", engine: "maxDiscount", label: "Desconto máximo sem aprovação", kind: "percent", cell: "B16", hint: "Acima disso o item fica em REVER DESCONTO." },
] as const;

export type ParamKey = (typeof PARAM_FIELDS)[number]["key"];

export const PARAM_STATUS = {
  rascunho: { label: "Rascunho", cls: "bg-surface text-muted" },
  vigente: { label: "Vigente", cls: "bg-ok/10 text-ok" },
  substituido: { label: "Substituído", cls: "bg-surface text-muted" },
} as const;
export type ParamStatus = keyof typeof PARAM_STATUS;

export const QUOTE_STATUS = {
  rascunho: { label: "Rascunho", cls: "bg-surface text-ink" },
  revisada: { label: "Revisada", cls: "bg-blue/10 text-navy" },
  emitida: { label: "Emitida", cls: "bg-navy text-white" },
  aceita: { label: "Aceita", cls: "bg-ok/10 text-ok" },
  recusada: { label: "Recusada", cls: "bg-danger/10 text-danger" },
  cancelada: { label: "Cancelada", cls: "bg-surface text-muted" },
} as const;
export type QuoteStatus = keyof typeof QUOTE_STATUS;

export const PERIODICITY = {
  unica: { label: "Única", short: "único" },
  mensal: { label: "Mensal (recorrente)", short: "mensal" },
} as const;
export type Periodicity = keyof typeof PERIODICITY;

/** Situação do item: as seis do simulador + "sem modelo" (serviços SaaS sem modelo de precificação definido). */
export type ItemStatus = Status | "SEM_MODELO";

export const ITEM_STATUS: Record<ItemStatus, { label: string; cls: string }> = {
  PENDENTE_IDENTIFICACAO: { label: "PENDENTE: IDENTIFICAÇÃO", cls: "bg-warn/10 text-warn" },
  PENDENTE_PARAMETROS: { label: "PENDENTE: CUSTOS / PARÂMETROS", cls: "bg-warn/10 text-warn" },
  REVER_VALORES: { label: "REVER VALORES", cls: "bg-danger/10 text-danger" },
  REVER_DESCONTO: { label: "REVER DESCONTO", cls: "bg-danger/10 text-danger" },
  REVER_MARGEM: { label: "REVER MARGEM", cls: "bg-danger/10 text-danger" },
  PRONTO: { label: "PRONTO PARA ANÁLISE INTERNA", cls: "bg-ok/10 text-ok" },
  SEM_MODELO: { label: "SEM MODELO DE PREÇO", cls: "bg-surface text-muted" },
};

export const HOUR_FIELDS = [
  { key: "hours_preparation", label: "Preparação" },
  { key: "hours_execution", label: "Execução" },
  { key: "hours_delivery", label: "Entrega / relatório" },
  { key: "hours_followup", label: "Acompanhamento" },
  { key: "hours_travel", label: "Deslocamento técnico" },
] as const;

export const COST_FIELDS = [
  { key: "cost_travel", label: "Deslocamentos / pedágios" },
  { key: "cost_materials", label: "Materiais" },
  { key: "cost_external", label: "Profissionais externos" },
  { key: "cost_other", label: "Demais custos diretos" },
] as const;

export const OVERRIDE_FIELDS = [
  { key: "contingency", label: "Contingência específica", hint: "Vazio = padrão dos parâmetros." },
  { key: "margin", label: "Margem específica", hint: "Vazio = margem-alvo dos parâmetros." },
  { key: "discount", label: "Desconto aplicado", hint: "Vazio = sem desconto." },
] as const;
