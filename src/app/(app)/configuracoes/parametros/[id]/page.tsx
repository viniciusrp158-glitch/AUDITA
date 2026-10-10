import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/form";
import { ParamStatusPill } from "@/components/pricing-status";
import { Card, DefinitionList, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { formatDateTime, formatDay } from "@/lib/format";
import { costPerHour, formatBRL, formatHours, formatPercent } from "@/lib/pricing/engine";
import { PARAM_FIELDS } from "@/lib/pricing/labels";
import { getParameterSetOr404 } from "@/lib/pricing/queries";
import { toEngineParams } from "@/lib/pricing/quote";
import { publishParameterSetAction, updateParameterSetAction } from "../actions";
import { ParameterForm, PublishForm } from "../param-forms";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getParameterSetOr404(id);
  return { title: `Parâmetros — versão ${s.version}` };
}

export default async function ParametroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ publicada?: string }>;
}) {
  await requireAppUser(ADMIN_ONLY);
  const { id } = await params;
  const sp = await searchParams;
  const s = await getParameterSetOr404(id);
  const cph = costPerHour(toEngineParams(s));
  const fmt = (kind: string, v: string | number | null) =>
    v === null ? <span className="font-semibold text-warn">PENDENTE</span> : kind === "money" ? formatBRL(v) : kind === "hours" ? formatHours(v) : formatPercent(v);

  return (
    <>
      <Link href="/configuracoes/parametros" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Parâmetros financeiros
      </Link>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-navy">Versão {s.version}</span>
          <ParamStatusPill status={s.status} />
          {s.is_test && <TestBadge />}
        </div>
        <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-ink">{s.label}</h1>
      </header>

      {sp.publicada && (
        <div className="mb-4">
          <Alert kind="info">Versão publicada: passa a valer para os novos orçamentos.</Alert>
        </div>
      )}

      {s.status === "rascunho" ? (
        <div className="space-y-6">
          <Card title="Editar rascunho">
            <ParameterForm action={updateParameterSetAction.bind(null, s.id)} initial={s} />
          </Card>
          <Card title="Publicar">
            <PublishForm action={publishParameterSetAction.bind(null, s.id)} />
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Card title="Valores">
            <DefinitionList
              items={[
                ...PARAM_FIELDS.map((f) => ({ label: `${f.label} (${f.cell})`, value: fmt(f.kind, s[f.key]) })),
                { label: "Custo/hora técnico", value: cph ? formatBRL(cph) : <span className="font-semibold text-warn">PENDENTE</span> },
              ]}
            />
          </Card>
          <Card title="Origem e validação">
            <DefinitionList
              items={[
                { label: "Data de referência", value: formatDay(s.reference_date) },
                { label: "Validado por", value: s.validated_by },
                { label: "Publicada em", value: s.published_at ? formatDateTime(s.published_at) : null },
                { label: "Observações", value: s.notes },
              ]}
            />
          </Card>
          <p className="text-xs text-muted">Versões publicadas são imutáveis. Para alterar valores, crie uma nova versão a partir da lista.</p>
        </div>
      )}
    </>
  );
}
