import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/form";
import { Card, DefinitionList, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { CHANGE_STATUS, MODELS } from "@/lib/execucao/labels";
import { getChangeOr404, getContractOr404 } from "@/lib/execucao/queries";
import { formatDay } from "@/lib/format";
import { formatBRL, numberToInput } from "@/lib/pricing/engine";
import { ADMIN_ONLY } from "@/lib/permissions";
import { changeChangeStatusAction, generateDocumentAction, updateChangeAction } from "../../../actions";
import { ChangeForm, GenerateForm, StatusForm } from "../../../exec-forms";
import { ChangeStatusPill } from "../../../shared";

export const metadata = { title: "Alteração de escopo" };

const LABELS = Object.fromEntries(Object.entries(CHANGE_STATUS).map(([k, v]) => [k, v.label]));

export default async function AlteracaoPage({ params, searchParams }: { params: Promise<{ id: string; altId: string }>; searchParams: Promise<{ criada?: string }> }) {
  await requireAppUser(ADMIN_ONLY);
  const { id, altId } = await params;
  const sp = await searchParams;
  const c = await getContractOr404(id);
  const a = await getChangeOr404(id, altId);
  return (
    <>
      <Link href={`/demandas/servicos/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> {c.contract_code}
      </Link>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-navy">{a.change_code}</span>
          <ChangeStatusPill status={a.status} />
          {a.is_test && <TestBadge />}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Alteração de escopo</h1>
        <p className="mt-1 text-sm text-muted">{c.clients?.legal_name}</p>
      </header>
      <div className="space-y-6">
        {sp.criada && <Alert kind="info">Alteração registrada em rascunho. Aprove somente com o aceite rastreável do cliente.</Alert>}
        {a.status === "rascunho" ? (
          <Card title="Dados da alteração">
            <ChangeForm
              action={updateChangeAction.bind(null, id, a.id)}
              button="Salvar alteração"
              initial={{
                reason: a.reason,
                activities_before: a.activities_before ?? "",
                activities_after: a.activities_after ?? "",
                deadline_before: a.deadline_before ?? "",
                deadline_after: a.deadline_after ?? "",
                value_before: a.value_before ? numberToInput(a.value_before) : "",
                value_after: a.value_after ? numberToInput(a.value_after) : "",
                deliverables_before: a.deliverables_before ?? "",
                deliverables_after: a.deliverables_after ?? "",
                client_approval: a.client_approval ?? "",
                validated_by_name: a.validated_by_name ?? "",
                validated_on: a.validated_on ?? "",
                documents_update: a.documents_update ?? "",
              }}
            />
          </Card>
        ) : (
          <Card title="Dados da alteração">
            <DefinitionList
              items={[
                { label: "Motivo", value: a.reason },
                { label: "Valor", value: a.value_before || a.value_after ? `${formatBRL(a.value_before)} → ${formatBRL(a.value_after)}` : null },
                { label: "Prazo", value: a.deadline_before || a.deadline_after ? `${a.deadline_before ?? "—"} → ${a.deadline_after ?? "—"}` : null },
                { label: "Aprovação do cliente", value: a.client_approval },
                { label: "Validação AUDITA", value: a.validated_by_name ? `${a.validated_by_name} — ${formatDay(a.validated_on)}` : null },
                { label: "Observação", value: a.status_note },
              ]}
            />
          </Card>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Situação">
            <StatusForm action={changeChangeStatusAction.bind(null, id, a.id)} options={a.status === "rascunho" ? ["aprovada", "cancelada"] : []} labels={LABELS} />
          </Card>
          <Card title={MODELS.M06.label}>
            <GenerateForm action={generateDocumentAction.bind(null, id, "M06", a.id)} label="Gerar M06" />
          </Card>
        </div>
      </div>
    </>
  );
}
