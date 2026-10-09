"use client";

import { useActionState, useState } from "react";
import { Alert, Field, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { DEMAND_STATUS, DEMAND_STATUS_KEYS, EVENT_TYPES, REASON_REQUIRED, type DemandStatus } from "@/lib/demands/labels";
import { todaySaoPaulo } from "@/lib/format";
import type { DemandActionState } from "../actions";

type Action = (s: DemandActionState, f: FormData) => Promise<DemandActionState>;

export function StatusForm({ action, current }: { action: Action; current: DemandStatus }) {
  const [state, formAction] = useActionState<DemandActionState, FormData>(action, {});
  return <StatusFields key={state.seq ?? 0} state={state} formAction={formAction} current={current} />;
}

function StatusFields({ state, formAction, current }: { state: DemandActionState; formAction: (f: FormData) => void; current: DemandStatus }) {
  const v = state.ok ? {} : (state.values ?? {});
  const e = state.fieldErrors ?? {};
  const [target, setTarget] = useState<string>(v.status ?? "");
  const needsReason = (REASON_REQUIRED as string[]).includes(target);
  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">
          Nova situação<span className="text-danger" aria-hidden> *</span>
        </span>
        <select
          name="status"
          value={target}
          onChange={(ev) => setTarget(ev.target.value)}
          aria-invalid={e.status ? true : undefined}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 ${e.status ? "border-danger" : "border-line"}`}
        >
          <option value="">Selecione</option>
          {DEMAND_STATUS_KEYS.filter((k) => k !== current).map((k) => (
            <option key={k} value={k}>
              {DEMAND_STATUS[k].label}
            </option>
          ))}
        </select>
        {e.status && <span className="mt-1 block text-xs text-danger">{e.status}</span>}
      </label>
      <TextAreaField
        label={needsReason ? "Motivo" : "Observação"}
        name="note"
        required={needsReason}
        defaultValue={v.note}
        error={e.note}
        rows={2}
        hint={needsReason ? "Obrigatório para cancelar ou marcar como não viável." : "Opcional. Fica registrada na linha do tempo."}
      />
      <SubmitButton pendingText="Atualizando…" full={false}>
        Atualizar situação
      </SubmitButton>
    </form>
  );
}

export function EventForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<DemandActionState, FormData>(action, {});
  return <EventFields key={state.seq ?? 0} state={state} formAction={formAction} />;
}

function EventFields({ state, formAction }: { state: DemandActionState; formAction: (f: FormData) => void }) {
  const v = state.ok ? {} : (state.values ?? {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Tipo"
          name="event_type"
          required
          options={(["nota", "contato", "visita"] as const).map((k) => ({ value: k, label: EVENT_TYPES[k] }))}
          defaultValue={v.event_type ?? "nota"}
          error={e.event_type}
        />
        <Field label="Data" name="occurred_on" type="date" defaultValue={v.occurred_on ?? todaySaoPaulo()} error={e.occurred_on} />
      </div>
      <TextAreaField label="Descrição" name="description" required defaultValue={v.description} error={e.description} rows={3} maxLength={4000} />
      <SubmitButton pendingText="Registrando…" variant="secondary" full={false}>
        Registrar acompanhamento
      </SubmitButton>
    </form>
  );
}
