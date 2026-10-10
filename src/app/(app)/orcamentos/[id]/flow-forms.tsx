"use client";

import { useActionState } from "react";
import { Alert, Field, SubmitButton, TextAreaField } from "@/components/form";
import { todaySaoPaulo } from "@/lib/format";
import type { FlowState } from "../actions";

type Action = (s: FlowState, f: FormData) => Promise<FlowState>;

function Problems({ state }: { state: FlowState }) {
  if (!state.error) return null;
  return (
    <Alert kind="error">
      {state.error}
      {state.details && state.details.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {state.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}

export function ReviewForm({ action, revisionLabel, needsReason }: { action: Action; revisionLabel: string; needsReason: boolean }) {
  const [state, formAction] = useActionState<FlowState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <Problems state={state} />
      {needsReason && (
        <TextAreaField
          label="Motivo da nova revisão"
          name="reason"
          required
          rows={2}
          maxLength={1000}
          defaultValue={state.values?.reason}
          hint="Ex.: ajuste de escopo solicitado pelo cliente."
        />
      )}
      <SubmitButton pendingText="Congelando a revisão…">Concluir revisão {revisionLabel}</SubmitButton>
      <p className="text-xs text-muted">
        A revisão congela cliente, conteúdo, itens, parâmetros e resultados (cópia imutável). Depois disso, os itens só mudam numa nova revisão.
      </p>
    </form>
  );
}

export function EmitForm({ action, watermark, modelLabel }: { action: Action; watermark: boolean; modelLabel: string }) {
  const [state, formAction] = useActionState<FlowState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <Problems state={state} />
      <p className="text-sm text-ink">
        Modelo: <strong>{modelLabel}</strong>. Serão gerados DOCX e PDF.
      </p>
      {watermark && (
        <Alert kind="warning">Ambiente ou dados de teste: os documentos sairão com a marca “DOCUMENTO DE TESTE — SEM VALIDADE COMERCIAL”.</Alert>
      )}
      <SubmitButton pendingText="Gerando documentos…">Emitir proposta</SubmitButton>
    </form>
  );
}

export function ReasonForm({
  action,
  label,
  button,
  pending,
  variant = "secondary",
  hint,
  field,
  withReference = false,
}: {
  action: Action;
  label: string;
  button: string;
  pending: string;
  variant?: "secondary" | "danger" | "primary";
  hint?: string;
  field: "reason" | "decision_note";
  withReference?: boolean;
}) {
  const [state, formAction] = useActionState<FlowState, FormData>(action, {});
  const name = field;
  return (
    <form action={formAction} className="space-y-3" noValidate>
      <Problems state={state} />
      <TextAreaField
        label={label}
        name={name}
        required
        rows={2}
        maxLength={1000}
        defaultValue={state.values?.[name]}
        error={state.fieldErrors?.[name]}
        hint={hint}
      />
      {withReference && (
        <Field label="Referência (opcional)" name="decision_reference" required={false} defaultValue={state.values?.decision_reference} maxLength={500} />
      )}
      <SubmitButton pendingText={pending} variant={variant}>
        {button}
      </SubmitButton>
    </form>
  );
}

export function AcceptForm({ action, minDate }: { action: Action; minDate: string }) {
  const [state, formAction] = useActionState<FlowState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-3" noValidate>
      <Problems state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block" htmlFor="accepted_on">
          <span className="mb-1 block text-sm font-medium text-ink">
            Data do aceite<span className="text-danger" aria-hidden> *</span>
          </span>
          <input
            id="accepted_on"
            name="accepted_on"
            type="date"
            min={minDate}
            max={todaySaoPaulo()}
            defaultValue={v.accepted_on ?? todaySaoPaulo()}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
          />
          {e.accepted_on && <span className="mt-1 block text-xs text-danger">{e.accepted_on}</span>}
        </label>
        <Field label="Quem aceitou (nome e cargo)" name="accepted_by_name" defaultValue={v.accepted_by_name} error={e.accepted_by_name} maxLength={200} />
      </div>
      <Field
        label="Referência do aceite"
        name="decision_reference"
        defaultValue={v.decision_reference}
        error={e.decision_reference}
        maxLength={500}
        hint="E-mail, protocolo, assinatura ou anexo que comprova o aceite (AUDDOC010 M01 §6)."
      />
      <TextAreaField label="Observação" name="decision_note" rows={2} maxLength={2000} defaultValue={v.decision_note} />
      <SubmitButton pendingText="Registrando…">Registrar aceite</SubmitButton>
    </form>
  );
}
