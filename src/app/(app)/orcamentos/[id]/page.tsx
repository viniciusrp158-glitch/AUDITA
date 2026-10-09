import Link from "next/link";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { Alert, SubmitButton } from "@/components/form";
import { ItemStatusPill, QuoteStatusPill } from "@/components/pricing-status";
import { ButtonLink, Card, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { formatBRL, formatHours, formatPercent } from "@/lib/pricing/engine";
import { PERIODICITY } from "@/lib/pricing/labels";
import { getQuoteOr404, getVigenteParameterSet } from "@/lib/pricing/queries";
import { calculateItem, quoteTotals } from "@/lib/pricing/quote";
import { adoptVigenteAction, updateQuoteHeaderAction } from "../actions";
import { QuoteHeaderForm } from "./quote-forms";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { quote } = await getQuoteOr404(id);
  return { title: `${quote.quote_code} · Orçamento` };
}

export default async function OrcamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criada?: string; item?: string }>;
}) {
  await requireAppUser();
  const { id } = await params;
  const sp = await searchParams;
  const [{ quote, items }, vigente] = await Promise.all([getQuoteOr404(id), getVigenteParameterSet()]);
  const ps = quote.pricing_parameter_sets;
  const editable = quote.status === "rascunho";
  const clientActive = quote.clients.status !== "inativo";
  const rows = items.map((it) => ({ it, calc: calculateItem(ps, it, it.services, clientActive) }));
  const totals = quoteTotals(rows.map((r) => ({ periodicity: r.it.periodicity, calc: r.calc })));
  const newerVigente = vigente && vigente.id !== quote.parameter_set_id;
  const anyNotReleased = rows.some((r) => r.calc.notReleased);

  return (
    <>
      <Link href="/orcamentos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Orçamentos
      </Link>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-navy px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-white">{quote.quote_code}</span>
          <QuoteStatusPill status={quote.status} />
          {quote.is_test && <TestBadge />}
        </div>
        <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-ink">{quote.demands.summary}</h1>
        <p className="mt-1 text-sm text-muted">
          <Link href={`/clientes/${quote.clients.id}`} className="hover:text-navy hover:underline">
            {quote.clients.client_code} — {quote.clients.trade_name || quote.clients.legal_name}
          </Link>{" "}
          · demanda{" "}
          <Link href={`/demandas/${quote.demand_id}`} className="font-mono text-xs text-navy hover:underline">
            {quote.demands.demand_code}
          </Link>
        </p>
      </header>

      <div className="mb-4 space-y-3">
        {sp.criada && <Alert kind="info">Cotação criada com o código {quote.quote_code}.</Alert>}
        {sp.item === "salvo" && <Alert kind="info">Item salvo.</Alert>}
        {sp.item === "removido" && <Alert kind="info">Item removido.</Alert>}
        {!ps && (
          <Alert kind="warning">
            Sem versão vigente de parâmetros financeiros: os itens ficam em <strong>PENDENTE</strong> e sem preço.{" "}
            <Link href="/configuracoes/parametros" className="underline">
              Configurar parâmetros
            </Link>
            .
          </Alert>
        )}
        {anyNotReleased && (
          <Alert kind="warning">
            Há itens com serviço não liberado comercialmente (AUDDOC004). Simulação interna permitida; a emissão da proposta ficará bloqueada (I6).
          </Alert>
        )}
        {!clientActive && <Alert kind="warning">Cliente inativo: reative o cadastro para prosseguir com a proposta.</Alert>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Card
            title={`Itens (${items.length})`}
            actions={
              editable ? (
                <ButtonLink href={`/orcamentos/${quote.id}/itens/novo`} variant="secondary">
                  <Plus size={16} /> Adicionar item
                </ButtonLink>
              ) : null
            }
          >
            {rows.length === 0 ? (
              <p className="text-sm text-muted">Nenhum item. Adicione os serviços com horas e custos diretos para calcular o preço.</p>
            ) : (
              <ol className="space-y-3">
                {rows.map(({ it, calc }, idx) => (
                  <li key={it.id} className="rounded-lg border border-line p-3" data-testid="quote-item">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted">
                          Item {idx + 1}
                          {it.services ? ` · ${it.services.service_code}` : ""} · {PERIODICITY[it.periodicity].label}
                          {it.quantity_ref ? ` · ${it.quantity_ref}` : ""}
                        </p>
                        <p className="break-words text-sm font-semibold text-ink">{it.description}</p>
                      </div>
                      <ItemStatusPill status={calc.status} />
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                      <div>
                        <dt className="text-muted">Horas</dt>
                        <dd className="tabular-nums text-ink">{formatHours(calc.result.hours)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Custo c/ contingência</dt>
                        <dd className="tabular-nums text-ink">{formatBRL(calc.result.costWithContingency)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Preço final</dt>
                        <dd className="font-semibold tabular-nums text-navy">{formatBRL(calc.result.finalPrice)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Margem efetiva</dt>
                        <dd className="tabular-nums text-ink">{formatPercent(calc.result.effectiveMargin)}</dd>
                      </div>
                    </dl>
                    {calc.result.reasons.length > 0 && calc.status !== "PRONTO" && (
                      <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-warn">
                        {calc.result.reasons.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    )}
                    {calc.notReleased && <p className="mt-1 text-xs text-warn">Serviço não liberado comercialmente (AUDDOC004).</p>}
                    {editable && (
                      <Link
                        href={`/orcamentos/${quote.id}/itens/${it.id}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-navy hover:underline"
                      >
                        <Pencil size={13} /> Editar item
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Condições">
            {editable ? (
              <QuoteHeaderForm action={updateQuoteHeaderAction.bind(null, quote.id)} initial={quote} />
            ) : (
              <p className="text-sm text-muted">Cotação fora de rascunho: condições bloqueadas.</p>
            )}
          </Card>
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-xl border border-line bg-white" aria-label="Totais">
            <div className="border-b border-line bg-navy px-4 py-2.5 text-sm font-semibold text-white">Totais</div>
            <div className="space-y-3 p-4 text-sm">
              {(["unica", "mensal"] as const).map((p) => {
                const t = totals[p];
                if (t.count === 0) return null;
                return (
                  <div key={p} className="flex justify-between gap-3">
                    <span className="text-muted">{p === "unica" ? "Valor único" : "Valor mensal"}</span>
                    <span className="text-right font-semibold tabular-nums text-navy" data-testid={`total-${p}`}>
                      {t.total ? formatBRL(t.total) : <span className="text-warn">PENDENTE</span>}
                    </span>
                  </div>
                );
              })}
              {totals.unica.count + totals.mensal.count === 0 && <p className="text-muted">Sem itens calculáveis.</p>}
              <p className="text-xs text-muted">
                {totals.ready} de {items.length} ite{items.length === 1 ? "m" : "ns"} pronto{totals.ready === 1 ? "" : "s"} para análise interna. O
                total só aparece quando todos os itens da periodicidade estão prontos.
              </p>
            </div>
          </section>

          <Card title="Parâmetros usados">
            {ps ? (
              <div className="space-y-2 text-sm">
                <Link href={`/configuracoes/parametros/${ps.id}`} className="font-semibold text-navy hover:underline">
                  Versão {ps.version} — {ps.label}
                </Link>
                <p className="text-xs text-muted">
                  {ps.status === "vigente" ? "Vigente" : "Substituída"}
                  {ps.published_at ? ` · publicada em ${formatDateTime(ps.published_at)}` : ""}
                </p>
              </div>
            ) : (
              <p className="text-sm text-warn">Nenhuma versão adotada.</p>
            )}
            {editable && newerVigente && (
              <form action={adoptVigenteAction.bind(null, quote.id)} className="mt-3">
                <p className="mb-2 text-xs text-muted">Há uma versão vigente diferente (versão {vigente!.version}).</p>
                <SubmitButton pendingText="Atualizando…" variant="secondary">
                  Usar versão vigente
                </SubmitButton>
              </form>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
