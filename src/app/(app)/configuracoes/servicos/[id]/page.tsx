import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Alert } from "@/components/form";
import { Card, DefinitionList } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { checkLabel, COMMERCIAL_STATUS, PRICING_MODEL } from "@/lib/services/labels";
import { getServiceOr404, getStatusHistory } from "@/lib/services/queries";
import { decideStatusAction, saveVerificationAction } from "../actions";
import { StatusPill } from "@/components/service-status";
import { DecisionForm, VerificationForm } from "./service-forms";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { service } = await getServiceOr404(id);
  return { title: `${service.service_code} · ${service.name}` };
}

export default async function ServicoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAppUser(ADMIN_ONLY);
  const { id } = await params;
  const { service: s, parentCode, offers } = await getServiceOr404(id);
  const history = await getStatusHistory(id);
  const releasable = s.commercial_status === "apto_comercialmente" && s.catalog_status === "ativo";

  return (
    <>
      <Link href="/configuracoes/servicos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={14} /> Catálogo de serviços
      </Link>

      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-md bg-navy px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-white">{s.service_code}</span>
          <StatusPill status={s.commercial_status} />
          <span className="rounded border border-line px-1.5 py-0.5 text-xs font-medium text-ink">Classe {s.matrix_class}</span>
          {s.catalog_status === "inativo" && <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">Inativo no catálogo</span>}
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{s.name}</h1>
        <p className="text-sm text-muted">
          {s.family}
          {s.kind === "oferta" && parentCode ? ` · Oferta de ${parentCode}` : ""}
          {s.norm ? ` · ${s.norm}` : ""}
        </p>
      </header>

      <div className="mb-5">
        {releasable ? (
          <Alert kind="info">Serviço apto comercialmente: pode gerar proposta comercial final.</Alert>
        ) : (
          <Alert kind="warning">
            Serviço <strong>{COMMERCIAL_STATUS[s.commercial_status].label.toLowerCase()}</strong>
            {s.catalog_status === "inativo" ? " e inativo no catálogo" : ""}: pode constar no cadastro e em simulações internas, mas{" "}
            <strong>não gera proposta comercial final</strong> (AUDDOC017 RF-17).
          </Alert>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Card title="Escopo e limites">
            <DefinitionList
              items={[
                { label: "Escopo preliminar (AUDDOC005)", value: s.scope_preliminary },
                { label: "Delimitação / alerta (AUDDOC004)", value: s.scope_limits },
                ...(s.kind === "oferta"
                  ? [
                      { label: "Agrupamento", value: s.grouping },
                      { label: "Modalidade", value: s.modality },
                      { label: "Atuação do TST", value: s.tst_compatibility },
                    ]
                  : []),
              ]}
            />
          </Card>

          <Card title="Requisitos e referências">
            <DefinitionList
              items={[
                { label: "O que comprovar", value: s.evidence_required },
                { label: "Referência normativa", value: s.legal_reference },
                {
                  label: "Fonte oficial",
                  value: s.official_url ? (
                    <a href={s.official_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-navy underline">
                      Abrir <ExternalLink size={13} />
                    </a>
                  ) : null,
                },
                ...(s.technical_responsibility ? [{ label: "Responsabilidade técnica", value: s.technical_responsibility }] : []),
                { label: "Prioridade", value: s.priority },
                { label: "Modelo de preço", value: PRICING_MODEL[s.pricing_model] },
                { label: "Origem do registro", value: s.source_reference },
              ]}
            />
          </Card>

          {offers.length > 0 && (
            <Card title={`Ofertas detalhadas (${offers.length})`}>
              <ul className="divide-y divide-line">
                {offers.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/configuracoes/servicos/${o.id}`} className="min-w-0 text-sm text-ink hover:text-navy hover:underline">
                      <span className="mr-2 font-mono text-xs font-semibold text-navy">{o.service_code}</span>
                      {o.name}
                    </Link>
                    <StatusPill status={o.commercial_status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Verificação operacional">
            <VerificationForm
              action={saveVerificationAction.bind(null, s.id)}
              initial={{
                docs_received: s.docs_received,
                rt_confirmed: s.rt_confirmed,
                resources_confirmed: s.resources_confirmed,
                billing_unit_ref: s.billing_unit_ref ?? "",
                catalog_status: s.catalog_status,
                audita_notes: s.audita_notes ?? "",
              }}
            />
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card title="Situação comercial">
            <div className="mb-4 grid grid-cols-2 gap-3 border-b border-line pb-4 text-sm sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Situação atual</p>
                <div className="mt-1">
                  <StatusPill status={s.commercial_status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Desde</p>
                <p className="mt-1 tabular-nums text-ink">{formatDateTime(s.status_decided_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Docs / RT / recursos</p>
                <p className="mt-1 text-ink">
                  {checkLabel(s.docs_received)} / {checkLabel(s.rt_confirmed)} / {checkLabel(s.resources_confirmed)}
                </p>
              </div>
            </div>
            <DecisionForm action={decideStatusAction.bind(null, s.id)} current={s.commercial_status} />
          </Card>

          <Card title="Histórico de decisões">
            <ol className="space-y-4">
              {history.map((h) => (
                <li key={h.id} className="border-l-2 border-line pl-3">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs">
                    {h.from_status ? (
                      <>
                        <StatusPill status={h.from_status} /> <span aria-hidden className="text-muted">→</span>
                      </>
                    ) : (
                      <span className="text-muted">Registro inicial:</span>
                    )}
                    <StatusPill status={h.to_status} />
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-muted">{formatDateTime(h.decided_at)}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{h.basis}</p>
                  {h.reference && <p className="mt-0.5 text-xs text-muted">Referência: {h.reference}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
