import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/form";
import { Card, DefinitionList, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { activitiesToText, MODELS, ORDER_STATUS } from "@/lib/execucao/labels";
import { getContractOr404, getOrderOr404 } from "@/lib/execucao/queries";
import { formatDay } from "@/lib/format";
import { ADMIN_ONLY } from "@/lib/permissions";
import { changeOrderStatusAction, generateDocumentAction, updateOrderAction } from "../../../actions";
import { GenerateForm, OrderForm, StatusForm } from "../../../exec-forms";
import { OrderStatusPill } from "../../../shared";

export const metadata = { title: "OS comercial" };

const NEXT: Record<string, string[]> = { rascunho: ["liberada", "cancelada"], liberada: ["concluida", "cancelada"], concluida: [], cancelada: [] };
const LABELS = Object.fromEntries(Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label]));

export default async function OsPage({ params, searchParams }: { params: Promise<{ id: string; osId: string }>; searchParams: Promise<{ criada?: string }> }) {
  await requireAppUser(ADMIN_ONLY);
  const { id, osId } = await params;
  const sp = await searchParams;
  const c = await getContractOr404(id);
  const o = await getOrderOr404(id, osId);
  return (
    <>
      <Link href={`/demandas/servicos/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> {c.contract_code}
      </Link>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-navy">{o.order_code}</span>
          <OrderStatusPill status={o.status} />
          {o.is_test && <TestBadge />}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Ordem de serviço comercial</h1>
        <p className="mt-1 text-sm text-muted">{c.clients?.legal_name} · não substitui a Ordem de Serviço de SST do empregador (AUDDOC010-ANX05).</p>
      </header>
      <div className="space-y-6">
        {sp.criada && <Alert kind="info">OS criada em rascunho. Preencha, salve e libere quando não houver condicionantes pendentes.</Alert>}
        {o.status === "rascunho" ? (
          <Card title="Dados da OS">
            <OrderForm
              action={updateOrderAction.bind(null, id, o.id)}
              initial={{
                scheduled_start: o.scheduled_start ?? "",
                scheduled_end: o.scheduled_end ?? "",
                time_window: o.time_window ?? "",
                location: o.location ?? "",
                executor_name: o.executor_name ?? "",
                executor_role: o.executor_role ?? "",
                client_contact: o.client_contact ?? "",
                activities: activitiesToText(o.activities),
                access_conditions: o.access_conditions ?? "",
                pending_conditions: o.pending_conditions ?? "",
                released_by_name: o.released_by_name ?? "",
                released_on: o.released_on ?? "",
              }}
            />
          </Card>
        ) : (
          <Card title="Dados da OS">
            <DefinitionList
              items={[
                { label: "Período", value: `${formatDay(o.scheduled_start)}${o.scheduled_end ? ` a ${formatDay(o.scheduled_end)}` : ""}` },
                { label: "Local", value: o.location },
                { label: "Responsável", value: o.executor_name },
                { label: "Contato no cliente", value: o.client_contact },
                { label: "Liberação", value: o.released_by_name ? `${o.released_by_name} — ${formatDay(o.released_on)}` : null },
                { label: "Observação", value: o.status_note },
              ]}
            />
            <ul className="mt-4 list-disc pl-5 text-sm text-ink">
              {o.activities.map((a, i) => (
                <li key={i}>
                  {a.atividade}
                  {a.entrega ? ` — ${a.entrega}` : ""}
                  {a.condicao ? ` (${a.condicao})` : ""}
                </li>
              ))}
            </ul>
          </Card>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Situação">
            <StatusForm action={changeOrderStatusAction.bind(null, id, o.id)} options={NEXT[o.status]} labels={LABELS} />
            <p className="mt-2 text-xs text-muted">Liberar exige responsável, data, ao menos uma atividade e nenhuma condicionante pendente.</p>
          </Card>
          <Card title={MODELS.M05.label}>
            <GenerateForm action={generateDocumentAction.bind(null, id, "M05", o.id)} label="Gerar M05" />
            <p className="mt-2 text-xs text-muted">O documento fica na lista do serviço contratado.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
