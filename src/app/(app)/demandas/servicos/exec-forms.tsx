"use client";

import { useActionState } from "react";
import { Alert, CheckboxField, Field, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { CONTRACT_STATUS, EVENT_TYPES, MANUAL_EVENTS, type ContractStatus } from "@/lib/execucao/labels";
import type { ExecState } from "./actions";

type Action = (s: ExecState, f: FormData) => Promise<ExecState>;

function Feedback({ state }: { state: ExecState }) {
  return (
    <>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
    </>
  );
}

export function ContractForm({ action, initial }: { action: Action; initial: Record<string, string> }) {
  const [state, formAction] = useActionState<ExecState, FormData>(action, {});
  const v = state.values ?? initial;
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="space-y-4" data-testid="contract-form">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Modalidade"
          name="modality"
          defaultValue={v.modality}
          options={[
            { value: "pontual", label: "Pontual" },
            { value: "recorrente", label: "Recorrente" },
          ]}
        />
        <Field label="Representante do cliente" name="client_representative" required={false} defaultValue={v.client_representative} error={e.client_representative} maxLength={200} hint="Nome e cargo de quem responde pelo cliente." />
        <Field label="Início" name="starts_on" type="date" required={false} defaultValue={v.starts_on} error={e.starts_on} />
        <Field label="Término" name="ends_on" type="date" required={false} defaultValue={v.ends_on} error={e.ends_on} />
        <Field label="Responsável pela execução" name="executor_name" required={false} defaultValue={v.executor_name} error={e.executor_name} maxLength={160} />
        <Field label="Atribuição profissional" name="executor_role" required={false} defaultValue={v.executor_role} error={e.executor_role} maxLength={160} />
        <TextAreaField label="Objeto / escopo resumido" name="scope_summary" defaultValue={v.scope_summary} error={e.scope_summary} maxLength={2000} rows={3} />
        <TextAreaField label="Entregáveis" name="deliverables" defaultValue={v.deliverables} error={e.deliverables} maxLength={2000} rows={3} />
        <TextAreaField label="Condições adicionais aceitas (M03)" name="additional_conditions" defaultValue={v.additional_conditions} error={e.additional_conditions} maxLength={2000} rows={2} />
        <TextAreaField label="Observações internas" name="notes" defaultValue={v.notes} error={e.notes} maxLength={2000} rows={2} />
      </div>
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Salvando…">Salvar dados do serviço</SubmitButton>
      </div>
    </form>
  );
}

export function StatusForm({ action, options, labels }: { action: Action; options: string[]; labels: Record<string, string> }) {
  const [state, formAction] = useActionState<ExecState, FormData>(action, {});
  if (!options.length) return <p className="text-sm text-muted">Sem novas situações possíveis.</p>;
  return (
    <form action={formAction} className="space-y-3" data-testid="status-form">
      <Feedback state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Nova situação" name="status" required options={options.map((o) => ({ value: o, label: labels[o] ?? o }))} />
        <Field label="Observação / motivo" name="nota" required={false} maxLength={1000} hint="Obrigatório para suspender ou cancelar." />
      </div>
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Registrando…">Registrar situação</SubmitButton>
      </div>
    </form>
  );
}

export const CONTRACT_STATUS_LABELS = Object.fromEntries(Object.entries(CONTRACT_STATUS).map(([k, v]) => [k, v.label])) as Record<ContractStatus, string>;

export function EventForm({ action, today }: { action: Action; today: string }) {
  const [state, formAction] = useActionState<ExecState, FormData>(action, {});
  const v = state.values ?? { occurred_on: today, event_type: "execucao" };
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="space-y-3" data-testid="event-form" key={state.seq}>
      <Feedback state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField label="Tipo" name="event_type" required defaultValue={v.event_type} error={e.event_type} options={MANUAL_EVENTS.map((t) => ({ value: t, label: EVENT_TYPES[t] }))} />
        <Field label="Data" name="occurred_on" type="date" defaultValue={v.occurred_on} error={e.occurred_on} />
        <Field label="Canal (entregas)" name="channel" required={false} defaultValue={v.channel} maxLength={200} hint="Ex.: e-mail, presencial." />
      </div>
      <TextAreaField label="Descrição" name="description" required defaultValue={v.description} error={e.description} maxLength={2000} rows={2} />
      <Field label="Destinatário (entregas)" name="recipient" required={false} defaultValue={v.recipient} maxLength={200} />
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Registrando…">Incluir na linha do tempo</SubmitButton>
      </div>
    </form>
  );
}

export function OrderForm({ action, initial }: { action: Action; initial: Record<string, string> }) {
  const [state, formAction] = useActionState<ExecState, FormData>(action, {});
  const v = state.values ?? initial;
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="space-y-4" data-testid="order-form">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Início" name="scheduled_start" type="date" required={false} defaultValue={v.scheduled_start} error={e.scheduled_start} />
        <Field label="Fim" name="scheduled_end" type="date" required={false} defaultValue={v.scheduled_end} error={e.scheduled_end} />
        <Field label="Janela de atendimento" name="time_window" required={false} defaultValue={v.time_window} maxLength={200} hint="Ex.: 8h às 12h." />
        <Field label="Local / modalidade" name="location" required={false} defaultValue={v.location} maxLength={500} />
        <Field label="Responsável pela execução" name="executor_name" required={false} defaultValue={v.executor_name} maxLength={160} />
        <Field label="Atribuição profissional" name="executor_role" required={false} defaultValue={v.executor_role} maxLength={160} />
        <Field label="Contato operacional no cliente" name="client_contact" required={false} defaultValue={v.client_contact} maxLength={300} className="sm:col-span-2" hint="Nome, telefone e e-mail." />
      </div>
      <TextAreaField
        label="Atividades (uma por linha: atividade | entrega/registro | condição)"
        name="activities"
        defaultValue={v.activities}
        rows={4}
        hint="Ex.: Visita técnica | Relatório de visita | EPI do cliente"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextAreaField label="Riscos e condições de acesso" name="access_conditions" defaultValue={v.access_conditions} maxLength={2000} rows={2} />
        <TextAreaField label="Condicionantes pendentes" name="pending_conditions" defaultValue={v.pending_conditions} maxLength={2000} rows={2} hint="Deixe vazio ou escreva “Nenhuma” quando não houver." />
        <Field label="Liberação interna — responsável" name="released_by_name" required={false} defaultValue={v.released_by_name} maxLength={160} />
        <Field label="Liberação interna — data" name="released_on" type="date" required={false} defaultValue={v.released_on} />
      </div>
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Salvando…">Salvar OS</SubmitButton>
      </div>
    </form>
  );
}

export function ChangeForm({ action, initial, button }: { action: Action; initial: Record<string, string>; button: string }) {
  const [state, formAction] = useActionState<ExecState, FormData>(action, {});
  const v = state.values ?? initial;
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="space-y-4" data-testid="change-form">
      <Feedback state={state} />
      <TextAreaField label="Motivo da mudança" name="reason" required defaultValue={v.reason} error={e.reason} maxLength={1000} rows={2} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextAreaField label="Atividades — antes" name="activities_before" defaultValue={v.activities_before} maxLength={2000} rows={2} />
        <TextAreaField label="Atividades — depois" name="activities_after" defaultValue={v.activities_after} maxLength={2000} rows={2} />
        <Field label="Prazo — antes" name="deadline_before" required={false} defaultValue={v.deadline_before} maxLength={300} />
        <Field label="Prazo — depois" name="deadline_after" required={false} defaultValue={v.deadline_after} maxLength={300} />
        <Field label="Valor — antes (R$)" name="value_before" required={false} inputMode="decimal" defaultValue={v.value_before} error={e.value_before} />
        <Field label="Valor — depois (R$)" name="value_after" required={false} inputMode="decimal" defaultValue={v.value_after} error={e.value_after} />
        <TextAreaField label="Entregáveis — antes" name="deliverables_before" defaultValue={v.deliverables_before} maxLength={2000} rows={2} />
        <TextAreaField label="Entregáveis — depois" name="deliverables_after" defaultValue={v.deliverables_after} maxLength={2000} rows={2} />
        <Field label="Aprovação do cliente" name="client_approval" required={false} defaultValue={v.client_approval} maxLength={500} className="sm:col-span-2" hint="Nome/função, data, meio e referência do aceite. Obrigatório para aprovar." />
        <Field label="Validação AUDITA — responsável" name="validated_by_name" required={false} defaultValue={v.validated_by_name} maxLength={160} />
        <Field label="Validação AUDITA — data" name="validated_on" type="date" required={false} defaultValue={v.validated_on} />
        <Field label="Atualização de documentos" name="documents_update" required={false} defaultValue={v.documents_update} maxLength={500} className="sm:col-span-2" hint="Ex.: nova revisão da proposta, contrato ou OS, quando necessária." />
      </div>
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Salvando…">{button}</SubmitButton>
      </div>
    </form>
  );
}

export function GenerateForm({ action, label }: { action: Action; label: string }) {
  const [state, formAction] = useActionState<ExecState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-2" data-testid="generate-form">
      <Feedback state={state} />
      {state.missing && state.missing.length > 0 && (
        <div className="space-y-2">
          <Alert kind="warning">
            <span className="font-semibold">Campos sem dados:</span>
            <ul className="mt-1 list-disc pl-5">
              {state.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Alert>
          <CheckboxField name="confirm" label="Gerar mesmo assim (os campos saem como [PENDENTE] na minuta)." />
        </div>
      )}
      <SubmitButton pendingText="Gerando…" variant="secondary" full={false}>
        {label}
      </SubmitButton>
    </form>
  );
}
