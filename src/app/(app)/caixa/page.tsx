import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Card, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { isProduction } from "@/lib/env";
import { monthlyCash } from "@/lib/execucao/cash";
import { CASH_CATEGORIES, MONTHS, PAYMENT_CATEGORIES } from "@/lib/execucao/labels";
import { listCashEntries, listContracts } from "@/lib/execucao/queries";
import { formatDay, todaySaoPaulo } from "@/lib/format";
import { formatBRL } from "@/lib/pricing/engine";
import { ADMIN_ONLY } from "@/lib/permissions";
import { createCashEntryAction, reverseCashEntryAction } from "./actions";
import { CashEntryForm, ReverseForm } from "./cash-forms";

export const metadata = { title: "Caixa gerencial" };

export default async function CaixaPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  await requireAppUser(ADMIN_ONLY);
  const sp = await searchParams;
  const today = todaySaoPaulo();
  const thisYear = Number(today.slice(0, 4));
  const year = /^\d{4}$/.test(sp.ano ?? "") && Math.abs(Number(sp.ano) - thisYear) <= 20 ? Number(sp.ano) : thisYear;
  const [entries, contracts] = await Promise.all([listCashEntries(year), listContracts()]);
  // Em produção, lançamentos de teste não entram nos totais (AUDDOC017 §14)
  const counted = isProduction ? entries.filter((e) => !e.is_test) : entries;
  const { months, year: tot } = monthlyCash(counted, year);
  const money = (v: string | null) => (v === null ? "" : formatBRL(v));
  const neg = (v: string | null) => (v !== null && v.startsWith("-") ? "text-danger" : "text-ink");

  return (
    <>
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Início
      </Link>
      <PageHeader
        title="Caixa gerencial"
        description="Recebimentos e pagamentos EFETIVAMENTE ocorridos (AUDDOC011 §7; aba “Caixa Mensal” do simulador). Não é contabilidade, apuração fiscal nem DRE."
      />
      <div className="space-y-6">
        <Alert kind="warning">
          Lance apenas o que aconteceu: recebimento quando o dinheiro entrou; tributos e pró-labore quando pagos. Proposta emitida, venda e faturamento
          não são caixa. Correções são feitas por estorno (o lançamento original continua registrado).
        </Alert>

        <nav aria-label="Exercício" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Exercício:</span>
          {[year - 1, year, year + 1].filter((y) => y <= thisYear).map((y) => (
            <Link
              key={y}
              href={`/caixa?ano=${y}`}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${y === year ? "border-navy bg-navy text-white" : "border-line bg-white text-muted hover:border-navy/40"}`}
            >
              {y}
            </Link>
          ))}
        </nav>

        <Card title={`Controle simplificado de caixa — ${year}`}>
          <div className="overflow-x-auto" data-testid="cash-table">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Mês</th>
                  {(["recebimento", ...PAYMENT_CATEGORIES] as const).map((c) => (
                    <th key={c} className="py-2 pr-3 text-right">
                      {CASH_CATEGORIES[c].column}
                    </th>
                  ))}
                  <th className="py-2 pr-3 text-right">Saldo do mês</th>
                  <th className="py-2 text-right">Saldo acumulado</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} className="border-b border-line/60">
                    <td className="py-1.5 pr-3 text-ink">{MONTHS[m.month - 1]}</td>
                    {(["recebimento", ...PAYMENT_CATEGORIES] as const).map((c) => (
                      <td key={c} className="py-1.5 pr-3 text-right tabular-nums text-ink">
                        {m.hasEntries ? money(m.totals[c]) : ""}
                      </td>
                    ))}
                    <td className={`py-1.5 pr-3 text-right font-semibold tabular-nums ${neg(m.balance)}`}>{money(m.balance)}</td>
                    <td className={`py-1.5 text-right tabular-nums ${neg(m.cumulative)}`}>{money(m.cumulative)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2 pr-3">Total</td>
                  {(["recebimento", ...PAYMENT_CATEGORIES] as const).map((c) => (
                    <td key={c} className="py-2 pr-3 text-right tabular-nums">
                      {formatBRL(tot[c])}
                    </td>
                  ))}
                  <td className={`py-2 pr-3 text-right tabular-nums ${neg(tot.balance)}`} data-testid="cash-year-balance">
                    {formatBRL(tot.balance)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">Saldo do mês = recebimentos − (custos diretos + fixos + pró-labore + tributos + outros). Meses sem lançamento ficam em branco.</p>
        </Card>

        <Card title="Lançar movimentação">
          <CashEntryForm
            action={createCashEntryAction}
            today={today}
            contracts={contracts.map((c) => ({ id: c.id, label: `${c.contract_code} — ${c.clients?.legal_name ?? ""}` }))}
          />
        </Card>

        <Card title={`Lançamentos de ${year} (${entries.length})`}>
          {entries.length === 0 ? (
            <p className="text-sm text-muted">Nenhum lançamento neste exercício.</p>
          ) : (
            <ul className="space-y-2" data-testid="cash-entries">
              {entries.map((e) => (
                <li key={e.id} className={`rounded-lg border border-line p-3 text-sm ${e.status === "estornado" ? "opacity-70" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular-nums text-muted">{formatDay(e.occurred_on)}</span>
                    <span className="font-semibold text-ink">{CASH_CATEGORIES[e.category].label}</span>
                    <span className={`ml-auto font-semibold tabular-nums ${e.kind === "recebimento" ? "text-ok" : "text-ink"} ${e.status === "estornado" ? "line-through" : ""}`}>
                      {e.kind === "recebimento" ? "+" : "−"} {formatBRL(e.amount)}
                    </span>
                    {e.is_test && <TestBadge />}
                  </div>
                  <p className="mt-1 break-words text-ink">{e.description}</p>
                  <p className="text-xs text-muted">
                    {[e.counterparty, e.reference].filter(Boolean).join(" · ")}
                    {e.status === "estornado" ? ` · ESTORNADO: ${e.reversal_reason}` : ""}
                  </p>
                  {e.status === "lancado" && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-semibold text-muted">Estornar</summary>
                      <div className="mt-2">
                        <ReverseForm action={reverseCashEntryAction.bind(null, e.id)} />
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
