"use client";

import { useActionState, useState } from "react";
import { Alert, CheckboxField, Field, SubmitButton, TextAreaField } from "@/components/form";
import { costPerHour, dec, formatBRL, formatPercent, fractionToPercentInput, numberToInput, parseBR, percentToFraction } from "@/lib/pricing/engine";
import { PARAM_FIELDS } from "@/lib/pricing/labels";
import type { ParameterValues } from "@/lib/pricing/quote";
import type { ParamActionState } from "./actions";

type Initial = ParameterValues & { label: string; reference_date: string | null; validated_by: string | null; notes: string | null };

function toInput(kind: string, v: string | number | null) {
  return kind === "percent" ? fractionToPercentInput(v) : numberToInput(v);
}

function preview(form: Record<string, string>) {
  const num = (k: string) => {
    const p = parseBR(form[k]);
    return p === "invalid" ? null : p;
  };
  const pct = (k: string) => {
    const p = percentToFraction(form[k]);
    return p === "invalid" ? null : p;
  };
  const cph = costPerHour({
    proLabore: num("pro_labore"),
    fixedCosts: num("fixed_costs"),
    billableHours: num("billable_hours"),
    taxes: null,
    paymentFees: null,
    commission: null,
    contingency: null,
    targetMargin: null,
    maxDiscount: null,
  });
  const parts = ["taxes", "payment_fees", "commission", "target_margin"].map(pct);
  const sum = parts.every((p) => p !== null) ? parts.reduce((a, b) => a!.plus(dec(b)!), dec("0"))! : null;
  const missing = PARAM_FIELDS.filter((f) => !(form[f.key] ?? "").trim()).map((f) => f.label);
  return { cph, sum, missing };
}

export function ParameterForm({
  action,
  initial,
}: {
  action: (s: ParamActionState, f: FormData) => Promise<ParamActionState>;
  initial: Initial;
}) {
  const [state, formAction] = useActionState<ParamActionState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const init: Record<string, string> = {
    label: initial.label,
    reference_date: initial.reference_date ?? "",
    validated_by: initial.validated_by ?? "",
    notes: initial.notes ?? "",
    ...Object.fromEntries(PARAM_FIELDS.map((f) => [f.key, toInput(f.kind, initial[f.key])])),
  };
  const values = state.values ?? init;
  const [snap, setSnap] = useState<Record<string, string>>(values);
  const p = preview(snap);

  return (
    <form
      action={formAction}
      noValidate
      className="space-y-6"
      onChange={(ev) => {
        const fd = new FormData(ev.currentTarget);
        setSnap(Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])));
      }}
    >
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome da versão" name="label" defaultValue={values.label} error={e.label} className="sm:col-span-2" maxLength={120} />
      </div>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-navy">Estrutura de custos (custo/hora)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {PARAM_FIELDS.filter((f) => f.kind !== "percent").map((f) => (
            <Field
              key={f.key}
              label={`${f.label} ${f.kind === "money" ? "(R$)" : "(h)"}`}
              name={f.key}
              required={false}
              inputMode="decimal"
              defaultValue={values[f.key]}
              error={e[f.key]}
              hint={f.hint}
            />
          ))}
        </div>
        <p className="rounded-md bg-surface px-3 py-2 text-sm text-ink">
          Custo/hora técnico: <strong className="tabular-nums">{p.cph ? formatBRL(p.cph) : "PENDENTE"}</strong>
          <span className="block text-xs text-muted">(pró-labore + despesas fixas) ÷ horas faturáveis — AUDDOC011 §4.1</span>
        </p>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-navy">Percentuais (%)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {PARAM_FIELDS.filter((f) => f.kind === "percent").map((f) => (
            <Field
              key={f.key}
              label={`${f.label} (%)`}
              name={f.key}
              required={false}
              inputMode="decimal"
              defaultValue={values[f.key]}
              error={e[f.key]}
              hint={f.hint}
            />
          ))}
        </div>
        <p className={`rounded-md px-3 py-2 text-sm ${p.sum !== null && p.sum.gte(1) ? "bg-danger/5 text-danger" : "bg-surface text-ink"}`}>
          Tributos + taxas + comissão + margem:{" "}
          <strong className="tabular-nums">{p.sum === null ? "PENDENTE" : formatPercent(p.sum)}</strong>
          {p.sum !== null && p.sum.gte(1) && <span className="block text-xs">Soma ≥ 100%: nenhum preço poderá ser calculado (AUDDOC011 §4.5).</span>}
        </p>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-navy">Origem e validação</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data de referência" name="reference_date" type="date" required={false} defaultValue={values.reference_date} error={e.reference_date} />
          <Field
            label="Validado por"
            name="validated_by"
            required={false}
            defaultValue={values.validated_by}
            error={e.validated_by}
            hint="Ex.: Diretor e contador responsável."
          />
        </div>
        <TextAreaField label="Fonte dos valores e observações" name="notes" defaultValue={values.notes} error={e.notes} maxLength={2000} />
      </fieldset>

      {p.missing.length > 0 && (
        <Alert kind="warning">
          Campos sem valor ({p.missing.length}): {p.missing.join(", ")}. Enquanto faltarem, os orçamentos ficam em{" "}
          <strong>PENDENTE</strong> e sem preço. Para itens que não se aplicam, informe 0.
        </Alert>
      )}

      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Salvando…">Salvar rascunho</SubmitButton>
      </div>
    </form>
  );
}

export function PublishForm({ action }: { action: (s: ParamActionState, f: FormData) => Promise<ParamActionState> }) {
  const [state, formAction] = useActionState<ParamActionState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-3">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <CheckboxField
        name="confirm"
        label="Confirmo que os valores foram validados (Diretor/contador) e que esta versão passa a valer para novos orçamentos."
        hint="Após publicar, a versão não pode mais ser alterada; mudanças exigem nova versão."
      />
      {state.fieldErrors?.confirm && <p className="text-xs text-danger">{state.fieldErrors.confirm}</p>}
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Publicando…">Publicar como vigente</SubmitButton>
      </div>
    </form>
  );
}
