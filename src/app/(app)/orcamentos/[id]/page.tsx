import Link from "next/link";
import { ArrowLeft, Download, FileText, Pencil, Plus } from "lucide-react";
import { Alert, SubmitButton } from "@/components/form";
import { DiscountAuthorizedBadge, ExpiredBadge, ItemStatusPill, QuoteStatusPill, RevisionStatusPill } from "@/components/pricing-status";
import { ButtonLink, Card, DefinitionList, TestBadge } from "@/components/ui";
import { contractSummary } from "@/lib/documents/proposal";
import { revisionLabel } from "@/lib/documents/snapshot";
import { isProduction } from "@/lib/env";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { formatDateTime, formatDay, todaySaoPaulo } from "@/lib/format";
import { formatBRL, formatHours, formatPercent } from "@/lib/pricing/engine";
import { CONTENT_FIELDS, DOCUMENT_MODELS, PERIODICITY } from "@/lib/pricing/labels";
import {
  getEmissionBlockers,
  getQuoteOr404,
  getReviewBlockers,
  getVigenteParameterSet,
  listRevisions,
  type QuoteRevision,
} from "@/lib/pricing/queries";
import { calculateItem, quoteTotals } from "@/lib/pricing/quote";
import {
  adoptVigenteAction,
  decideQuoteAction,
  emitRevisionAction,
  reopenQuoteAction,
  reviewQuoteAction,
  updateQuoteHeaderAction,
} from "../actions";
import { AcceptForm, EmitForm, ReasonForm, ReviewForm } from "./flow-forms";
import { getContractByQuote } from "@/lib/execucao/queries";
import { createContractAction } from "../../demandas/servicos/actions";
import { QuoteContentForm } from "./quote-forms";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { quote } = await getQuoteOr404(id);
  return { title: `${quote.quote_code} · Orçamento` };
}

const FLOW_MSG: Record<string, string> = {
  revisada: "Revisão concluída e congelada.",
  emitida: "Proposta emitida: documentos DOCX e PDF gerados e arquivados.",
  reaberta: "Cotação reaberta para nova revisão. A revisão anterior continua preservada no histórico.",
  aceita: "Aceite registrado.",
  servico_erro: "Não foi possível registrar o serviço contratado (já registrado ou proposta não aceita).",
  recusada: "Recusa registrada.",
  cancelada: "Cotação cancelada.",
};

function Details({ summary, children, open }: { summary: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group rounded-lg border border-line" open={open}>
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-navy marker:hidden">
        <span className="inline-block transition group-open:rotate-90">›</span> {summary}
      </summary>
      <div className="border-t border-line p-3">{children}</div>
    </details>
  );
}

function DocLinks({ quoteId, rev }: { quoteId: string; rev: QuoteRevision }) {
  if (!rev.generated_documents?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {[...rev.generated_documents]
        .sort((a, b) => (a.kind === "pdf" ? -1 : 1) - (b.kind === "pdf" ? -1 : 1))
        .map((d) => (
          <a
            key={d.id}
            href={`/orcamentos/${quoteId}/documentos/${d.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy/40"
            title={`SHA-256 ${d.sha256}`}
          >
            <Download size={14} /> {d.kind.toUpperCase()}
            <span className="font-normal text-muted">({Math.max(1, Math.round(d.size_bytes / 1024))} KB)</span>
          </a>
        ))}
    </div>
  );
}

export default async function OrcamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criada?: string; item?: string; fluxo?: string }>;
}) {
  const user = await requireAppUser(OPERATE);
  const isAdmin = user.role === "admin";
  const { id } = await params;
  const sp = await searchParams;
  const [{ quote, items }, vigente, revisions] = await Promise.all([getQuoteOr404(id), getVigenteParameterSet(), listRevisions(id)]);
  const contract = quote.status === "aceita" && user.role === "admin" ? await getContractByQuote(quote.id) : null;
  const ps = quote.pricing_parameter_sets;
  const editable = quote.status === "rascunho";
  const clientActive = quote.clients.status !== "inativo";
  const rows = items.map((it) => ({ it, calc: calculateItem(ps, it, it.services, clientActive) }));
  const totals = quoteTotals(rows.map((r) => ({ periodicity: r.it.periodicity, calc: r.calc })));
  const newerVigente = vigente && vigente.id !== quote.parameter_set_id;
  const anyNotReleased = rows.some((r) => r.calc.notReleased);
  const current = revisions.find((r) => r.id === quote.current_revision_id) ?? null;
  const nextRevision = revisions.length ? Math.max(...revisions.map((r) => r.revision_number)) + 1 : 0;
  const today = todaySaoPaulo();
  const expired = current?.status === "emitida" && current.valid_until !== null && current.valid_until < today;

  const [reviewBlockers, emissionBlockers] = await Promise.all([
    editable ? getReviewBlockers(id) : Promise.resolve([]),
    quote.status === "revisada" && current ? getEmissionBlockers(current.id) : Promise.resolve([]),
  ]);
  const notReady = rows.filter((r) => !r.calc.accepted).length;
  const reviewChecklist = [
    ...reviewBlockers,
    ...(notReady ? [`${notReady} item(ns) ainda não estão PRONTO PARA ANÁLISE INTERNA (ou com desconto autorizado).`] : []),
  ];
  const hasMonthly = items.some((i) => i.periodicity === "mensal");
  const watermark = !isProduction || quote.is_test || Boolean(ps?.is_test);
  const snapshotQuote = current?.snapshot.quote;

  return (
    <>
      <Link href="/orcamentos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Orçamentos
      </Link>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-navy px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-white">{quote.quote_code}</span>
          {current && <span className="rounded-md border border-line px-2 py-0.5 font-mono text-xs font-semibold text-navy">{revisionLabel(current.revision_number)}</span>}
          <QuoteStatusPill status={quote.status} />
          {expired && <ExpiredBadge />}
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
        {sp.fluxo && FLOW_MSG[sp.fluxo] && <Alert kind="info">{FLOW_MSG[sp.fluxo]}</Alert>}
        {!isAdmin && (
          <Alert kind="info">
            Você prepara o escopo, as horas e os custos dos itens. Preços, margens, conclusão da revisão, emissão e registro da decisão do
            cliente são feitos pelo administrador (AUDDOC017 §10).
          </Alert>
        )}
        {isAdmin && editable && !ps && (
          <Alert kind="warning">
            Sem versão vigente de parâmetros financeiros: os itens ficam em <strong>PENDENTE</strong> e sem preço.{" "}
            <Link href="/configuracoes/parametros" className="underline">
              Configurar parâmetros
            </Link>
            .
          </Alert>
        )}
        {editable && anyNotReleased && (
          <Alert kind="warning">
            Há itens com serviço não liberado comercialmente (AUDDOC004). A revisão interna é permitida; a emissão ficará bloqueada até a liberação.
          </Alert>
        )}
        {!clientActive && <Alert kind="warning">Cliente inativo: reative o cadastro para prosseguir com a proposta.</Alert>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
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
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="text-xs text-muted">
                          Item {idx + 1}
                          {it.services ? ` · ${it.services.service_code}` : ""} · {PERIODICITY[it.periodicity].label}
                          {it.quantity_ref ? ` · ${it.quantity_ref}` : ""}
                        </p>
                        <p className="break-words text-sm font-semibold text-ink">{it.description}</p>
                      </div>
                      {isAdmin && (
                        <span className="flex flex-wrap gap-1">
                          <ItemStatusPill status={calc.status} />
                          {calc.discountAuthorized && <DiscountAuthorizedBadge />}
                        </span>
                      )}
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                      <div>
                        <dt className="text-muted">Horas</dt>
                        <dd className="tabular-nums text-ink">{formatHours(calc.result.hours)}</dd>
                      </div>
                      {isAdmin && (
                        <>
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
                        </>
                      )}
                    </dl>
                    {isAdmin && calc.result.reasons.length > 0 && !calc.accepted && (
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

          <Card title="Conteúdo da proposta">
            {editable ? (
              <QuoteContentForm action={updateQuoteHeaderAction.bind(null, quote.id)} initial={quote} hasMonthly={hasMonthly} />
            ) : snapshotQuote ? (
              <div className="space-y-3">
                <p className="text-xs text-muted">
                  Conteúdo congelado na {revisionLabel(current!.revision_number)} — {DOCUMENT_MODELS[snapshotQuote.model].label}.
                </p>
                <DefinitionList
                  items={[
                    { label: "Validade", value: snapshotQuote.validity_days ? `${snapshotQuote.validity_days} dias` : null },
                    ...(snapshotQuote.contract_months
                      ? [{ label: "Contrato (serviços mensais)", value: contractSummary(snapshotQuote.contract_start_on ?? null, snapshotQuote.contract_months) }]
                      : []),
                    ...CONTENT_FIELDS.filter((f) => snapshotQuote[f.key]).map((f) => ({
                      label: f.label,
                      value: <span className="whitespace-pre-wrap">{snapshotQuote[f.key]}</span>,
                    })),
                  ]}
                />
              </div>
            ) : (
              <p className="text-sm text-muted">Cotação fora de rascunho.</p>
            )}
          </Card>

          {isAdmin && (
          <Card title={`Revisões (${revisions.length})`}>
            {revisions.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma revisão concluída. A Rev.00 é criada ao concluir a revisão do rascunho.</p>
            ) : (
              <ol className="space-y-3">
                {revisions.map((r) => (
                  <li key={r.id} className="rounded-lg border border-line p-3" data-testid="revision">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-navy">{revisionLabel(r.revision_number)}</span>
                      <RevisionStatusPill status={r.status} />
                      {r.document_model && <span className="text-xs text-muted">{DOCUMENT_MODELS[r.document_model].short}</span>}
                      {r.is_test_document && <TestBadge />}
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                      <div>
                        <dt className="text-muted">Valor único</dt>
                        <dd className="tabular-nums text-ink">{r.total_once ? formatBRL(r.total_once) : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Valor mensal</dt>
                        <dd className="tabular-nums text-ink">{r.total_monthly ? `${formatBRL(r.total_monthly)}/mês` : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Revisada em</dt>
                        <dd className="tabular-nums text-ink">{formatDateTime(r.reviewed_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Emitida em</dt>
                        <dd className="tabular-nums text-ink">{r.emitted_at ? formatDateTime(r.emitted_at) : "—"}</dd>
                      </div>
                      {r.valid_until && (
                        <div>
                          <dt className="text-muted">Válida até</dt>
                          <dd className="tabular-nums text-ink">{formatDay(r.valid_until)}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-muted">Parâmetros</dt>
                        <dd className="text-ink">Versão {r.snapshot.parameters.version}</dd>
                      </div>
                    </dl>
                    {r.reason && <p className="mt-2 text-xs text-ink">Motivo da revisão: {r.reason}</p>}
                    {r.status === "aceita" && (
                      <p className="mt-2 text-xs text-ok">
                        Aceita em {formatDay(r.accepted_on)} por {r.accepted_by_name} — {r.decision_reference}
                      </p>
                    )}
                    {r.decision_note && r.status !== "aceita" && <p className="mt-2 text-xs text-muted">Registro: {r.decision_note}</p>}
                    <div className="mt-2">
                      <DocLinks quoteId={quote.id} rev={r} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          )}
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-4 lg:self-start">
          {!isAdmin ? (
            <section className="rounded-xl border border-line bg-white p-4 text-sm" aria-label="Situação" data-testid="operator-flow">
              <p className="font-semibold text-ink">Situação: {quote.status === "rascunho" ? "em preparação" : "com o administrador"}</p>
              <p className="mt-1 text-xs text-muted">
                Quando os itens e o conteúdo estiverem prontos, avise o administrador para conferir os valores, concluir a revisão e emitir a
                proposta.
              </p>
            </section>
          ) : (
          <>
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
                {totals.ready} de {items.length} ite{items.length === 1 ? "m" : "ns"} pronto{totals.ready === 1 ? "" : "s"} para análise interna. Total =
                soma dos preços dos itens (em centavos), por periodicidade.
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-white" aria-label="Fluxo da proposta" data-testid="flow">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
              <FileText size={16} className="text-green-dark" /> Revisão e emissão
            </div>
            <div className="space-y-3 p-4">
              {quote.status === "rascunho" && (
                <>
                  {reviewChecklist.length > 0 ? (
                    <div className="space-y-2" data-testid="review-blockers">
                      <p className="text-sm font-semibold text-ink">Pendências para concluir a {revisionLabel(nextRevision)}:</p>
                      <ul className="list-disc space-y-1 pl-4 text-xs text-warn">
                        {reviewChecklist.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <ReviewForm
                      action={reviewQuoteAction.bind(null, quote.id)}
                      revisionLabel={revisionLabel(nextRevision)}
                      needsReason={nextRevision > 0}
                    />
                  )}
                  <Details summary="Cancelar cotação">
                    <ReasonForm
                      action={decideQuoteAction.bind(null, quote.id, "cancelada")}
                      field="decision_note"
                      label="Motivo do cancelamento"
                      button="Cancelar cotação"
                      pending="Cancelando…"
                      variant="danger"
                    />
                  </Details>
                </>
              )}

              {quote.status === "revisada" && current && (
                <>
                  <p className="text-sm text-ink">
                    {revisionLabel(current.revision_number)} concluída em {formatDateTime(current.reviewed_at)} (conteúdo congelado).
                  </p>
                  {emissionBlockers.length > 0 ? (
                    <div className="space-y-2" data-testid="emission-blockers">
                      <Alert kind="error">
                        Emissão bloqueada (AUDDOC017 RF-17):
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                          {emissionBlockers.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      </Alert>
                    </div>
                  ) : (
                    <EmitForm
                      action={emitRevisionAction.bind(null, quote.id)}
                      watermark={watermark}
                      modelLabel={DOCUMENT_MODELS[current.snapshot.quote.model].short}
                    />
                  )}
                  <Details summary="Reabrir para edição" open={emissionBlockers.length > 0}>
                    <ReasonForm
                      action={reopenQuoteAction.bind(null, quote.id)}
                      field="reason"
                      label="Motivo da reabertura"
                      button="Reabrir para edição"
                      pending="Reabrindo…"
                      hint="A revisão atual fica preservada como “Substituída”."
                    />
                  </Details>
                  <Details summary="Cancelar cotação">
                    <ReasonForm
                      action={decideQuoteAction.bind(null, quote.id, "cancelada")}
                      field="decision_note"
                      label="Motivo do cancelamento"
                      button="Cancelar cotação"
                      pending="Cancelando…"
                      variant="danger"
                    />
                  </Details>
                </>
              )}

              {quote.status === "emitida" && current && (
                <>
                  <p className="text-sm text-ink">
                    {revisionLabel(current.revision_number)} emitida em {formatDateTime(current.emitted_at!)} · válida até{" "}
                    <strong className={expired ? "text-warn" : ""}>{formatDay(current.valid_until)}</strong>.
                  </p>
                  <DocLinks quoteId={quote.id} rev={current} />
                  <Details summary="Registrar aceite do cliente" open>
                    <AcceptForm action={decideQuoteAction.bind(null, quote.id, "aceita")} minDate={current.emitted_at!.slice(0, 10)} />
                  </Details>
                  <Details summary="Registrar recusa">
                    <ReasonForm
                      action={decideQuoteAction.bind(null, quote.id, "recusada")}
                      field="decision_note"
                      withReference
                      label="Motivo da recusa"
                      button="Registrar recusa"
                      pending="Registrando…"
                    />
                  </Details>
                  <Details summary="Nova revisão (alterar a proposta)">
                    <ReasonForm
                      action={reopenQuoteAction.bind(null, quote.id)}
                      field="reason"
                      label="Motivo da nova revisão"
                      button="Abrir nova revisão"
                      pending="Reabrindo…"
                      hint="A proposta emitida fica preservada como “Substituída”, com seus documentos."
                    />
                  </Details>
                  <Details summary="Cancelar cotação">
                    <ReasonForm
                      action={decideQuoteAction.bind(null, quote.id, "cancelada")}
                      field="decision_note"
                      label="Motivo do cancelamento"
                      button="Cancelar cotação"
                      pending="Cancelando…"
                      variant="danger"
                    />
                  </Details>
                </>
              )}

              {(quote.status === "aceita" || quote.status === "recusada") && current && (
                <>
                  <p className="text-sm text-ink">
                    {quote.status === "aceita"
                      ? `Aceita em ${formatDay(current.accepted_on)} por ${current.accepted_by_name} (${current.decision_reference}).`
                      : `Recusada: ${current.decision_note}`}
                  </p>
                  <DocLinks quoteId={quote.id} rev={current} />
                  {quote.status === "aceita" && (
                    <div className="rounded-lg border border-line p-3" data-testid="contract-link">
                      {contract ? (
                        <p className="text-sm text-ink">
                          Serviço contratado:{" "}
                          <Link href={`/demandas/servicos/${contract.id}`} className="font-semibold text-navy underline">
                            {contract.contract_code}
                          </Link>
                        </p>
                      ) : (
                        <form action={createContractAction.bind(null, quote.id)} className="space-y-2">
                          <p className="text-sm text-ink">Próximo passo (AUDDOC009 §6.3): registrar o serviço contratado para acompanhar execução, entregas e formalização.</p>
                          <SubmitButton pendingText="Registrando…" full={false}>
                            Registrar serviço contratado
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  )}
                  <Details summary={quote.status === "aceita" ? "Nova revisão (alteração de escopo aceito)" : "Nova revisão (renegociar)"}>
                    <ReasonForm
                      action={reopenQuoteAction.bind(null, quote.id)}
                      field="reason"
                      label="Motivo da nova revisão"
                      button="Abrir nova revisão"
                      pending="Reabrindo…"
                    />
                  </Details>
                  {quote.status === "recusada" && (
                    <Details summary="Cancelar cotação">
                      <ReasonForm
                        action={decideQuoteAction.bind(null, quote.id, "cancelada")}
                        field="decision_note"
                        label="Motivo do cancelamento"
                        button="Cancelar cotação"
                        pending="Cancelando…"
                        variant="danger"
                      />
                    </Details>
                  )}
                </>
              )}

              {quote.status === "cancelada" && <p className="text-sm text-muted">Cotação cancelada. O histórico e os documentos emitidos continuam disponíveis.</p>}
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
            {!editable && <p className="mt-2 text-xs text-muted">Revisões guardam a cópia dos parâmetros usados; mudanças futuras não as alteram (CA-08).</p>}
          </Card>
          </>
          )}
        </aside>
      </div>
    </>
  );
}
