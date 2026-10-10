"use client";

import { useActionState, useState } from "react";
import { Alert, Field, SubmitButton, TextAreaField } from "@/components/form";
import { CONTENT_FIELDS, DOCUMENT_MODELS } from "@/lib/pricing/labels";
import type { QuoteActionState } from "../actions";

type Model = "ANX01" | "ANX02";
type ContentKey = (typeof CONTENT_FIELDS)[number]["key"];
export type QuoteContent = { document_model: Model; validity_days: number | null; notes: string | null } & Record<ContentKey, string | null>;

/** Conteúdo da proposta (campos customizáveis do AUDDOC010 M01/M02) e condições. */
export function QuoteContentForm({
  action,
  initial,
}: {
  action: (s: QuoteActionState, f: FormData) => Promise<QuoteActionState>;
  initial: QuoteContent;
}) {
  const [state, formAction] = useActionState<QuoteActionState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const v: Record<string, string> =
    state.values ??
    Object.fromEntries(
      Object.entries(initial).map(([k, val]) => [k, val === null || val === undefined ? "" : String(val)]),
    );
  const [model, setModel] = useState<Model>((v.document_model as Model) || "ANX01");
  const visible = CONTENT_FIELDS.filter((f) => (f.models as readonly string[]).includes(model) || ("optionalIn" in f && (f.optionalIn as readonly string[]).includes(model)));
  const required = (f: (typeof CONTENT_FIELDS)[number]) => (f.models as readonly string[]).includes(model);

  return (
    <form action={formAction} noValidate className="space-y-4" key={state.seq ?? 0}>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Modelo do documento</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(DOCUMENT_MODELS) as Model[]).map((m) => (
            <label
              key={m}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${model === m ? "border-navy bg-navy/5" : "border-line"}`}
            >
              <input type="radio" name="document_model" value={m} checked={model === m} onChange={() => setModel(m)} className="mt-0.5 accent-navy" />
              <span>
                <span className="block font-semibold text-ink">{DOCUMENT_MODELS[m].short}</span>
                <span className="block text-xs text-muted">{DOCUMENT_MODELS[m].code} — {m === "ANX01" ? "escopo, preço e aceite no mesmo documento" : "cotação breve ou demanda simples"}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field
          label="Validade (dias)"
          name="validity_days"
          inputMode="numeric"
          defaultValue={v.validity_days}
          error={e.validity_days}
          hint="Contada a partir da emissão."
        />
        <p className="self-end pb-2 text-xs text-muted">
          Campos marcados com <span className="text-danger">*</span> são exigidos pelo modelo para concluir a revisão. Quando não se aplicar, escreva
          “Não se aplica”.
        </p>
      </div>

      {/* Todos os campos ficam no formulário (os que não pertencem ao modelo escolhido apenas ocultos),
          para não perder o que foi digitado ao trocar de modelo. */}
      {CONTENT_FIELDS.map((f) => (
        <div key={f.key} className={visible.includes(f) ? "" : "hidden"}>
          <TextAreaField
            label={f.label}
            name={f.key}
            required={required(f)}
            rows={f.rows}
            maxLength={f.max}
            defaultValue={v[f.key]}
            error={e[f.key]}
          />
        </div>
      ))}

      <TextAreaField label="Observações internas (não saem no documento)" name="notes" rows={2} maxLength={4000} defaultValue={v.notes} error={e.notes} />

      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Salvando…" variant="secondary">
          Salvar conteúdo
        </SubmitButton>
      </div>
    </form>
  );
}
