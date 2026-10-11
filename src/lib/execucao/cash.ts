/**
 * Caixa mensal (AUDDOC011 §7; aba "Caixa Mensal" do AUDDOC011-ANX01), com aritmética decimal exata:
 *   saldo do mês = recebimentos − (custos diretos + fixos + pró-labore + tributos + outros)
 *   saldo acumulado = soma dos saldos dos meses até o mês (dentro do exercício)
 * Meses sem nenhum lançamento ficam vazios (como na planilha) e não interrompem o acumulado.
 * Lançamentos estornados não entram. Não é contabilidade nem DRE.
 */
import Decimal from "decimal.js";
import type { CashCategory } from "./labels";

export type CashEntryLite = { occurred_on: string; category: CashCategory; amount: string | number; status: "lancado" | "estornado" };

export type CashMonth = {
  month: number; // 1..12
  hasEntries: boolean;
  totals: Record<CashCategory, string>;
  payments: string;
  balance: string | null;
  cumulative: string | null;
};

const CATS: CashCategory[] = ["recebimento", "custo_direto", "fixo", "pro_labore", "tributo", "outro"];

export function monthlyCash(entries: CashEntryLite[], year: number): { months: CashMonth[]; year: Record<CashCategory, string> & { payments: string; balance: string } } {
  const acc = Array.from({ length: 12 }, () => Object.fromEntries(CATS.map((c) => [c, new Decimal(0)])) as Record<CashCategory, Decimal>);
  const has = Array(12).fill(false) as boolean[];
  for (const e of entries) {
    if (e.status !== "lancado") continue;
    const [y, m] = e.occurred_on.split("-").map(Number);
    if (y !== year) continue;
    acc[m - 1][e.category] = acc[m - 1][e.category].plus(new Decimal(e.amount));
    has[m - 1] = true;
  }
  let running = new Decimal(0);
  const months: CashMonth[] = acc.map((t, i) => {
    const payments = t.custo_direto.plus(t.fixo).plus(t.pro_labore).plus(t.tributo).plus(t.outro);
    const balance = t.recebimento.minus(payments);
    if (has[i]) running = running.plus(balance);
    return {
      month: i + 1,
      hasEntries: has[i],
      totals: Object.fromEntries(CATS.map((c) => [c, t[c].toFixed(2)])) as Record<CashCategory, string>,
      payments: payments.toFixed(2),
      balance: has[i] ? balance.toFixed(2) : null,
      cumulative: has[i] ? running.toFixed(2) : null,
    };
  });
  const sum = (c: CashCategory) => acc.reduce((s, m) => s.plus(m[c]), new Decimal(0));
  const yearTotals = Object.fromEntries(CATS.map((c) => [c, sum(c).toFixed(2)])) as Record<CashCategory, string>;
  const payments = CATS.filter((c) => c !== "recebimento").reduce((s, c) => s.plus(sum(c)), new Decimal(0));
  return { months, year: { ...yearTotals, payments: payments.toFixed(2), balance: sum("recebimento").minus(payments).toFixed(2) } };
}
