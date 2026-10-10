"use client";

import { useActionState } from "react";
import { Alert, CheckboxField, Field, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { UFS } from "@/lib/br";
import { FIELD_GROUPS, type FieldDef } from "@/lib/institutional";
import type { InstitutionalState } from "./actions";

type Action = (s: InstitutionalState, f: FormData) => Promise<InstitutionalState>;

function Input({ f, value, error }: { f: FieldDef; value: string; error?: string }) {
  const label = f.essential ? `${f.label} (essencial)` : f.label;
  if (f.kind === "uf")
    return (
      <SelectField
        label={label}
        name={f.key}
        defaultValue={value}
        error={error}
        options={[{ value: "", label: "—" }, ...UFS.map((u) => ({ value: u, label: u }))]}
      />
    );
  if (f.kind === "long")
    return <TextAreaField label={label} name={f.key} defaultValue={value} error={error} hint={f.hint} maxLength={f.max} className="sm:col-span-2" />;
  return (
    <Field
      label={label}
      name={f.key}
      required={false}
      defaultValue={value}
      error={error}
      hint={f.hint}
      maxLength={f.max}
      type={f.kind === "email" ? "email" : "text"}
      inputMode={f.kind === "cnpj" || f.kind === "zip" || f.kind === "phone" ? "numeric" : undefined}
      autoComplete="off"
    />
  );
}

export function InstitutionalForm({ action, initial }: { action: Action; initial: Record<string, string> }) {
  const [state, formAction] = useActionState<InstitutionalState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const values = state.values ?? initial;
  return (
    <form action={formAction} noValidate className="space-y-6" data-testid="institutional-form">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <p className="text-xs text-muted">
        Preencha somente com dados de documentos oficiais (cartão CNPJ, contrato social, inscrições). Deixe vazio o que ainda não existe: o
        sistema mostra <strong>PENDENTE</strong> e nada é inventado.
      </p>

      {FIELD_GROUPS.map((g) => (
        <fieldset key={g.title} className="space-y-3">
          <legend className="text-sm font-semibold text-navy">{g.title}</legend>
          <p className="text-xs text-muted">{g.description}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {g.fields.map((f) => (
              <Input key={f.key} f={f} value={values[f.key] ?? ""} error={e[f.key]} />
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-navy">Exibição nas propostas</legend>
        <CheckboxField
          key={`addr-${state.seq ?? 0}-${values.full_address_on_proposal}`}
          name="full_address_on_proposal"
          label="Mostrar o endereço completo da AUDITA no campo “Empresa proponente”."
          defaultChecked={values.full_address_on_proposal === "on"}
        />
        <CheckboxField
          key={`lead-${state.seq ?? 0}-${values.show_technical_lead}`}
          name="show_technical_lead"
          label="Mostrar o responsável técnico nas propostas."
          hint="Só marque com registro profissional confirmado (AUDDOC013; não inventar qualificações)."
          defaultChecked={values.show_technical_lead === "on"}
        />
        {e.show_technical_lead && <p className="text-xs text-danger">{e.show_technical_lead}</p>}
      </fieldset>

      <TextAreaField label="Observações internas (fonte dos dados)" name="notes" defaultValue={values.notes} error={e.notes} maxLength={2000} hint="Não aparecem nas propostas." />

      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Salvando…">Salvar rascunho</SubmitButton>
      </div>
    </form>
  );
}

export function PublishInstitutionalForm({ action, pending }: { action: Action; pending: string[] }) {
  const [state, formAction] = useActionState<InstitutionalState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-3">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {pending.length > 0 && (
        <Alert kind="warning">
          Campos essenciais vazios ({pending.length}): {pending.join(", ")}. Pode publicar assim mesmo — as propostas mostrarão esses dados
          como <strong>PENDENTE</strong>.
        </Alert>
      )}
      <CheckboxField
        name="confirm"
        label="Confirmo que os dados conferem com os documentos oficiais e que esta versão passa a valer nas novas revisões de propostas."
        hint="Após publicar, a versão não pode mais ser alterada. Propostas já revisadas continuam com os dados da época (snapshot)."
      />
      {state.fieldErrors?.confirm && <p className="text-xs text-danger">{state.fieldErrors.confirm}</p>}
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Publicando…">Publicar como vigente</SubmitButton>
      </div>
    </form>
  );
}
