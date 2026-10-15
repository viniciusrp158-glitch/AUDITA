/**
 * Metas dos indicadores do Início — caderno D9 (decisão do Diretor, 14/10/2026); AUDDOC017 §14.
 * Metas mensais: comparadas ao valor do período só quando o período é de um mês (este mês ou o anterior).
 * Mudança de meta = nova decisão registrada no histórico e alteração aqui.
 */
export const TARGETS = {
  /** D9.01 — valor cotado por mês (R$). */
  quotedPerMonth: "10000.00",
  /** D9.02 — conversão (fração). */
  conversion: "0.30",
  /** D9.03 — ticket médio aceito (R$). */
  avgTicket: "300.00",
  /** D9.04 — demandas atendidas (recebidas e tratadas) por mês. */
  demandsPerMonth: 5,
} as const;

export const MONTH_PRESETS: readonly string[] = ["mes", "mes_anterior"];
