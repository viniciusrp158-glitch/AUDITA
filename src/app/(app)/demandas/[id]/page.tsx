import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { DemandStatusPill, isOverdue, OverdueBadge, RecurringBadge } from "@/components/demand-status";
import { Alert } from "@/components/form";
import { StatusPill } from "@/components/service-status";
import { ButtonLink, Card, CodeBadge, DefinitionList, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { formatPhone } from "@/lib/br";
import { DEMAND_STATUS, EVENT_TYPES, ORIGINS } from "@/lib/demands/labels";
import { getDemandEvents, getDemandOr404 } from "@/lib/demands/queries";
import { formatDateTime, formatDay, todaySaoPaulo } from "@/lib/format";
import { addEventAction, changeStatusAction } from "../actions";
import { EventForm, StatusForm } from "./demand-forms";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDemandOr404(id);
  return { title: `${d.demand_code} · ${d.summary}` };
}

export default async function DemandaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criada?: string; salva?: string }>;
}) {
  await requireAppUser();
  const { id } = await params;
  const sp = await searchParams;
  const d = await getDemandOr404(id);
  const events = await getDemandEvents(id);
  const today = todaySaoPaulo();
  const svc = d.services;
  const released = svc && svc.commercial_status === "apto_comercialmente" && svc.catalog_status === "ativo";
  const contact = d.client_contacts;

  return (
    <>
      <Link href="/demandas" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={14} /> Demandas
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CodeBadge code={d.demand_code} />
            <DemandStatusPill status={d.status} />
            {isOverdue(d, today) && <OverdueBadge />}
            {d.is_recurring && <RecurringBadge />}
            {d.is_test && <TestBadge />}
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{d.summary}</h1>
          <p className="text-sm text-muted">
            <Link href={`/clientes/${d.clients.id}`} className="text-navy hover:underline">
              {d.clients.client_code} — {d.clients.legal_name}
            </Link>
            {d.clients.status === "inativo" ? " · cliente inativo" : ""}
          </p>
        </div>
        <ButtonLink href={`/demandas/${d.id}/editar`} variant="secondary">
          <Pencil size={15} /> Editar
        </ButtonLink>
      </header>

      {sp.criada && (
        <div className="mb-4">
          <Alert kind="info">
            Demanda registrada com o código <strong>{d.demand_code}</strong>.
          </Alert>
        </div>
      )}
      {sp.salva && !sp.criada && (
        <div className="mb-4">
          <Alert kind="info">Alterações salvas.</Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Card title="Necessidade">
            <DefinitionList
              items={[
                { label: "Recebida em", value: formatDay(d.received_on) },
                { label: "Prazo pretendido", value: formatDay(d.due_on) || "Não definido" },
                { label: "Origem", value: ORIGINS[d.origin] },
                { label: "Unidade / local", value: d.client_units?.name ?? (d.location ? null : "Sede / não se aplica") },
                { label: "Local de execução", value: d.location },
                {
                  label: "Pessoa de contato",
                  value: contact
                    ? [contact.full_name, contact.role_title, contact.email, formatPhone(contact.phone)].filter(Boolean).join(" · ")
                    : null,
                },
              ]}
            />
            {d.description && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Descrição / escopo pretendido</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{d.description}</p>
              </div>
            )}
          </Card>

          <Card title="Serviço e viabilidade">
            {svc ? (
              <div className="space-y-3">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Link href={`/configuracoes/servicos/${svc.id}`} className="text-ink hover:text-navy hover:underline">
                    <span className="mr-1 font-mono text-xs font-semibold text-navy">{svc.service_code}</span>
                    {svc.name}
                  </Link>
                  <StatusPill status={svc.commercial_status} />
                </p>
                {!released && (
                  <Alert kind="warning">
                    Serviço sem liberação comercial: a demanda segue registrada e pode ser analisada, mas não gera proposta comercial
                    final até a liberação no catálogo (AUDDOC017 RF-17).
                  </Alert>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">Serviço a definir na análise.</p>
            )}
            <div className="mt-4 border-t border-line pt-4">
              <DefinitionList
                items={[
                  { label: "AUDDOC004 consultada?", value: d.viability_checked ? "Sim" : "Não" },
                  { label: "Decisão / condicionantes", value: d.viability_notes },
                ]}
              />
            </div>
          </Card>

          <Card title="Proposta">
            <p className="text-sm text-muted">
              Orçamentos e propostas vinculados a esta demanda aparecerão aqui a partir dos incrementos I5 e I6.
            </p>
          </Card>

          {d.notes && (
            <Card title="Observações">
              <p className="whitespace-pre-wrap text-sm text-ink">{d.notes}</p>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <Card title="Situação">
            <p className="mb-3 text-xs text-muted">
              {DEMAND_STATUS[d.status].label} desde {formatDateTime(d.status_changed_at)}. As situações são referências do AUDDOC009 e
              podem ser puladas conforme o serviço.
            </p>
            <StatusForm action={changeStatusAction.bind(null, d.id)} current={d.status} />
          </Card>

          <Card title="Registrar acompanhamento">
            <EventForm action={addEventAction.bind(null, d.id)} />
          </Card>

          <Card title="Linha do tempo">
            <ol className="space-y-4">
              {events.map((ev) => (
                <li key={ev.id} className="border-l-2 border-line pl-3">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs">
                    {ev.event_type === "situacao" && ev.to_status ? (
                      <>
                        {ev.from_status && (
                          <>
                            <DemandStatusPill status={ev.from_status} /> <span aria-hidden className="text-muted">→</span>
                          </>
                        )}
                        <DemandStatusPill status={ev.to_status} />
                      </>
                    ) : (
                      <span className="font-semibold text-ink">{EVENT_TYPES[ev.event_type]}</span>
                    )}
                    <span className="tabular-nums text-muted">· {formatDay(ev.occurred_on)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{ev.description}</p>
                  <p className="mt-0.5 text-xs text-muted">Registrado em {formatDateTime(ev.created_at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
