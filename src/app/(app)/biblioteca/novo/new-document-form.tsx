"use client";

import { useActionState } from "react";
import { Alert, Field, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { PHASES, type Phase } from "@/lib/library/labels";
import { createDocumentAction, type LibState } from "../actions";

export function NewDocumentForm({ parents, families }: { parents: { id: string; label: string }[]; families: string[] }) {
  const [state, formAction] = useActionState<LibState, FormData>(createDocumentAction, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={formAction} noValidate className="max-w-3xl space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Código" name="doc_code" defaultValue={v.doc_code} error={e.doc_code} hint="AUDDOC000 ou AUDDOC000-ANX00 (permanente)." />
        <SelectField
          label="Fase"
          name="phase"
          required
          defaultValue={v.phase ?? "fase2"}
          error={e.phase}
          options={(Object.keys(PHASES) as Phase[]).map((k) => ({ value: k, label: PHASES[k].label }))}
        />
      </div>
      <Field label="Título" name="title" defaultValue={v.title} error={e.title} maxLength={300} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block" htmlFor="family">
          <span className="mb-1 block text-sm font-medium text-ink">
            Família<span className="text-danger" aria-hidden> *</span>
          </span>
          <input
            id="family"
            name="family"
            list="families"
            defaultValue={v.family}
            className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 ${e.family ? "border-danger" : "border-line"}`}
          />
          <datalist id="families">
            {families.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          {e.family && <span className="mt-1 block text-xs text-danger">{e.family}</span>}
        </label>
        <SelectField
          label="Documento principal (somente anexos)"
          name="parent_id"
          defaultValue={v.parent_id ?? ""}
          error={e.parent_id}
          options={[{ value: "", label: "— Não é anexo —" }, ...parents.map((p) => ({ value: p.id, label: p.label }))]}
        />
      </div>
      <SelectField
        label="Visibilidade"
        name="visibility"
        defaultValue={v.visibility ?? "interno"}
        options={[
          { value: "interno", label: "Interno (cliente não acessa)" },
          { value: "externo", label: "Externo" },
        ]}
      />
      <TextAreaField label="Observações" name="notes" rows={2} maxLength={2000} defaultValue={v.notes} />
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Cadastrando…">Cadastrar documento</SubmitButton>
      </div>
    </form>
  );
}
