"use client";

import { useActionState, useState } from "react";
import { Alert, Field, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { CHECK_OPTIONS, COMMERCIAL_STATUS, COMMERCIAL_STATUS_KEYS, type CommercialStatus } from "@/lib/services/labels";
import type { ServiceActionState } from "../actions";

type Action = (s: ServiceActionState, f: FormData) => Promise<ServiceActionState>;

export function DecisionForm({ action, current }: { action: Action; current: CommercialStatus }) {
  const [state, formAction] = useActionState<ServiceActionState, FormData>(action, {});
  return (
    <DecisionFields key={state.seq ?? 0} state={state} formAction={formAction} current={current} />
  );
}

function DecisionFields({
  state,
  formAction,
  current,
}: {
  state: ServiceActionState;
  formAction: (f: FormData) => void;
  current: CommercialStatus;
}) {
  const v = state.ok ? {} : (state.values ?? {});
  const e = state.fieldErrors ?? {};
  const [target, setTarget] = useState<string>(v.commercial_status ?? "");
  const options = [
    { value: "", label: "Selecione" },
    ...COMMERCIAL_STATUS_KEYS.filter((k) => k !== current).map((k) => ({ value: k, label: COMMERCIAL_STATUS[k].label })),
  ];
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">
          Nova situação<span className="text-danger" aria-hidden> *</span>
        </span>
        <select
          name="commercial_status"
          value={target}
          onChange={(ev) => setTarget(ev.target.value)}
          aria-invalid={e.commercial_status ? true : undefined}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 ${e.commercial_status ? "border-danger" : "border-line"}`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {e.commercial_status && <span className="mt-1 block text-xs text-danger">{e.commercial_status}</span>}
      </label>
      {target && target in COMMERCIAL_STATUS && (
        <p className="rounded-md bg-surface px-3 py-2 text-xs text-muted">
          <strong className="text-ink">Critério (AUDDOC005 §14):</strong> {COMMERCIAL_STATUS[target as CommercialStatus].criterio}
        </p>
      )}
      {target === "apto_comercialmente" && (
        <Alert kind="warning">
          Com esta situação o serviço poderá gerar proposta comercial final. Confirme formalização PJ, documentação comercial,
          contratos, preços e habilitação (AUDDOC004/005/015).
        </Alert>
      )}
      <TextAreaField
        label="Fundamento da decisão"
        name="status_basis"
        required
        defaultValue={v.status_basis}
        error={e.status_basis}
        rows={3}
        hint="O que foi verificado e por quê. Fica registrado no histórico do serviço."
      />
      <Field
        label="Referência / evidência"
        name="status_reference"
        required={false}
        defaultValue={v.status_reference}
        error={e.status_reference}
        placeholder="Ex.: AUDDOC004 Rev.01, certificado, parecer"
        hint="Liberar um serviço altera a AUDDOC004: registre a revisão correspondente (Rev.01…)."
      />
      <SubmitButton pendingText="Registrando…" full={false}>
        Registrar decisão
      </SubmitButton>
    </form>
  );
}

export function VerificationForm({
  action,
  initial,
}: {
  action: Action;
  initial: Record<"docs_received" | "rt_confirmed" | "resources_confirmed" | "billing_unit_ref" | "catalog_status" | "audita_notes", string>;
}) {
  const [state, formAction] = useActionState<ServiceActionState, FormData>(action, {});
  const v = { ...initial, ...(state.values ?? {}) };
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Documentos recebidos?" name="docs_received" options={[...CHECK_OPTIONS.docs_received]} defaultValue={v.docs_received} error={e.docs_received} />
        <SelectField label="Responsável técnico confirmado?" name="rt_confirmed" options={[...CHECK_OPTIONS.rt_confirmed]} defaultValue={v.rt_confirmed} error={e.rt_confirmed} />
        <SelectField label="Recursos confirmados?" name="resources_confirmed" options={[...CHECK_OPTIONS.resources_confirmed]} defaultValue={v.resources_confirmed} error={e.resources_confirmed} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          className="sm:col-span-2"
          label="Unidade de cobrança de referência"
          name="billing_unit_ref"
          required={false}
          defaultValue={v.billing_unit_ref}
          error={e.billing_unit_ref}
          hint="AUDDOC011 §6 (ex.: turma / participante)."
        />
        <SelectField
          label="Situação no catálogo"
          name="catalog_status"
          options={[
            { value: "ativo", label: "Ativo" },
            { value: "inativo", label: "Inativo" },
          ]}
          defaultValue={v.catalog_status}
          error={e.catalog_status}
        />
      </div>
      <TextAreaField label="Observações da AUDITA" name="audita_notes" defaultValue={v.audita_notes} error={e.audita_notes} rows={3} maxLength={2000} />
      <SubmitButton pendingText="Salvando…" variant="secondary" full={false}>
        Salvar verificação
      </SubmitButton>
    </form>
  );
}
