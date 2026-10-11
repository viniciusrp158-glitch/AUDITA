import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Alert, SubmitButton } from "@/components/form";
import { Card, DefinitionList, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { CONTRACT_NEXT, CONTRACT_STATUS, EVENT_TYPES, MODELS } from "@/lib/execucao/labels";
import { getContractDetail, getContractOr404 } from "@/lib/execucao/queries";
import { formatDateTime, formatDay, todaySaoPaulo } from "@/lib/format";
import { ADMIN_ONLY } from "@/lib/permissions";
import { addEventAction, changeContractStatusAction, createChangeAction, createOrderAction, generateDocumentAction, updateContractAction } from "../actions";
import { ChangeForm, ContractForm, EventForm, GenerateForm, StatusForm } from "../exec-forms";
import { ChangeStatusPill, ContractStatusPill, OrderStatusPill } from "../shared";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getContractOr404(id);
  return { title: `Serviço ${c.contract_code}` };
}

const LABELS = Object.fromEntries(Object.entries(CONTRACT_STATUS).map(([k, v]) => [k, v.label]));

export default async function ServicoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requireAppUser(ADMIN_ONLY);
  const { id } = await params;
  const sp = await searchParams;
  const c = await getContractOr404(id);
  const { events, orders, changes, documents } = await getContractDetail(id);
  const closed = c.status === "encerrado" || c.status === "cancelado";

  return (
    <>
      <Link href="/demandas/servicos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Serviços contratados
      </Link>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-navy">{c.contract_code}</span>
          <ContractStatusPill status={c.status} />
          {c.is_test && <TestBadge />}
        </div>
        <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-ink">{c.clients?.legal_name}</h1>
        <p className="mt-1 text-sm text-muted">
          <Link href={`/orcamentos/${c.quote_id}`} className="underline hover:text-navy">
            {c.quotes?.quote_code}
          </Link>{" "}
          ·{" "}
          <Link href={`/demandas/${c.demand_id}`} className="underline hover:text-navy">
            {c.demands?.demand_code}
          </Link>{" "}
          · {c.clients?.client_code} · {c.modality === "recorrente" ? "recorrente" : "pontual"}
        </p>
      </header>

      <div className="space-y-6">
        {sp.criado && <Alert kind="info">Serviço contratado registrado a partir da proposta aceita. Complete os dados e registre a execução.</Alert>}
        {sp.erro && <Alert kind="error">Não foi possível criar o registro.</Alert>}
        {c.status_note && (
          <p className="rounded-md bg-surface px-3 py-2 text-sm text-ink">
            <span className="font-semibold">Última situação:</span> {c.status_note} ({formatDateTime(c.status_changed_at)})
          </p>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Situação">
            <DefinitionList
              items={[
                { label: "Início", value: formatDay(c.starts_on) },
                { label: "Término", value: formatDay(c.ends_on) },
                { label: "Responsável", value: c.executor_name },
              ]}
            />
            <div className="mt-4">
              {closed ? <p className="text-sm text-muted">Serviço {c.status}: registros travados.</p> : <StatusForm action={changeContractStatusAction.bind(null, c.id)} options={CONTRACT_NEXT[c.status]} labels={LABELS} />}
            </div>
            <p className="mt-2 text-xs text-muted">Em execução, Entregue e Encerrado também atualizam a demanda (AUDDOC009 §8).</p>
          </Card>
          <Card title="Registrar na linha do tempo">
            {closed ? <p className="text-sm text-muted">Serviço {c.status}.</p> : <EventForm action={addEventAction.bind(null, c.id)} today={todaySaoPaulo()} />}
          </Card>
        </div>

        <Card title={`Linha do tempo (${events.length})`}>
          <ol className="space-y-2" data-testid="timeline">
            {events.map((e) => (
              <li key={e.id} className="rounded-lg border border-line p-3 text-sm">
                <p className="text-xs text-muted">
                  {formatDay(e.occurred_on)} · <span className="font-semibold text-navy">{EVENT_TYPES[e.event_type]}</span>
                  {e.to_status ? ` · ${LABELS[e.from_status ?? ""] ?? "—"} → ${LABELS[e.to_status] ?? e.to_status}` : ""}
                </p>
                <p className="mt-1 whitespace-pre-line break-words text-ink">{e.description}</p>
                {(e.channel || e.recipient) && (
                  <p className="mt-1 text-xs text-muted">
                    {e.channel ? `Canal: ${e.channel}` : ""}
                    {e.channel && e.recipient ? " · " : ""}
                    {e.recipient ? `Destinatário: ${e.recipient}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Dados do serviço">
          {closed ? (
            <DefinitionList
              items={[
                { label: "Representante do cliente", value: c.client_representative },
                { label: "Escopo", value: c.scope_summary },
                { label: "Entregáveis", value: c.deliverables },
              ]}
            />
          ) : (
            <ContractForm
              action={updateContractAction.bind(null, c.id)}
              initial={{
                modality: c.modality,
                starts_on: c.starts_on ?? "",
                ends_on: c.ends_on ?? "",
                executor_name: c.executor_name ?? "",
                executor_role: c.executor_role ?? "",
                client_representative: c.client_representative ?? "",
                scope_summary: c.scope_summary ?? "",
                deliverables: c.deliverables ?? "",
                additional_conditions: c.additional_conditions ?? "",
                notes: c.notes ?? "",
              }}
            />
          )}
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card
            title={`Ordens de serviço comercial — M05 (${orders.length})`}
            actions={
              !closed ? (
                <form action={createOrderAction.bind(null, c.id)}>
                  <SubmitButton pendingText="Criando…" full={false} variant="secondary">
                    <span className="inline-flex items-center gap-1">
                      <Plus size={14} /> Nova OS
                    </span>
                  </SubmitButton>
                </form>
              ) : undefined
            }
          >
            {orders.length === 0 ? (
              <p className="text-sm text-muted">Use a OS para organizar a mobilização (AUDDOC010 §2). Não substitui a OS de SST do empregador.</p>
            ) : (
              <ul className="space-y-2">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/demandas/servicos/${c.id}/os/${o.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3 text-sm hover:border-navy/40">
                      <span className="font-mono text-xs font-semibold text-navy">{o.order_code}</span>
                      <OrderStatusPill status={o.status} />
                      <span className="text-xs text-muted">{o.scheduled_start ? formatDay(o.scheduled_start) : "sem data"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={`Alterações de escopo — M06 (${changes.length})`}>
            {changes.length > 0 && (
              <ul className="mb-4 space-y-2">
                {changes.map((a) => (
                  <li key={a.id}>
                    <Link href={`/demandas/servicos/${c.id}/alteracoes/${a.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3 text-sm hover:border-navy/40">
                      <span className="font-mono text-xs font-semibold text-navy">{a.change_code}</span>
                      <ChangeStatusPill status={a.status} />
                      <span className="min-w-0 break-words text-xs text-muted">{a.reason}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {!closed && (
              <details className="rounded-lg border border-line" data-testid="new-change">
                <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-navy">Registrar alteração de escopo</summary>
                <div className="border-t border-line p-3">
                  <p className="mb-3 text-xs text-muted">Só para mudança relevante de objeto, quantidade, preço, prazo ou entregáveis; vale após aceite rastreável do cliente.</p>
                  <ChangeForm action={createChangeAction.bind(null, c.id)} initial={{}} button="Registrar alteração" />
                </div>
              </details>
            )}
          </Card>
        </div>

        <Card title="Documentos de formalização (minutas — pendentes de revisão jurídica)">
          <div className="grid gap-4 sm:grid-cols-2">
            {(["M03", "M04"] as const).map((m) => (
              <div key={m} className="rounded-lg border border-line p-3">
                <p className="text-sm font-semibold text-ink">{MODELS[m].label}</p>
                <p className="mb-2 text-xs text-muted">{MODELS[m].hint}</p>
                <GenerateForm action={generateDocumentAction.bind(null, c.id, m, null)} label={`Gerar ${m}`} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">M05 e M06 são gerados na própria OS e na alteração de escopo. Os campos ausentes são listados antes da geração (RF-23).</p>
          {documents.length > 0 && (
            <ul className="mt-4 space-y-2" data-testid="contract-documents">
              {documents.map((d) => (
                <li key={d.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{MODELS[d.model].label}</span>
                    <span className="text-xs text-muted">{d.reference}</span>
                    {d.missing_fields.length > 0 && (
                      <span className="rounded-full bg-warn/10 px-2 py-0.5 text-xs font-semibold text-warn">{d.missing_fields.length} PENDENTE(S)</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Gerado em {formatDateTime(d.generated_at)} · {d.watermark} · SHA-256 PDF {d.pdf_sha256.slice(0, 12)}…
                  </p>
                  <div className="mt-2 flex gap-3 text-xs font-semibold">
                    <a className="text-navy underline" href={`/demandas/servicos/${c.id}/documentos/${d.id}?formato=pdf`}>
                      Baixar PDF
                    </a>
                    <a className="text-navy underline" href={`/demandas/servicos/${c.id}/documentos/${d.id}?formato=docx`}>
                      Baixar Word
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
