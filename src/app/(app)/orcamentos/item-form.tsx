"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Alert, Field, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { ItemStatusPill } from "@/components/pricing-status";
import { formatBRL, formatHours, formatPercent, fractionToPercentInput, numberToInput, parseBR, percentToFraction } from "@/lib/pricing/engine";
import { COST_FIELDS, HOUR_FIELDS, OVERRIDE_FIELDS, PERIODICITY } from "@/lib/pricing/labels";
import { calculateItem, type ItemValues, type ParameterValues } from "@/lib/pricing/quote";
import type { QuoteActionState } from "./actions";

export type ServiceOpt = {
  id: string;
  label: string;
  family: string;
  pricing_model: string;
  commercial_status: string;
  catalog_status: string;
};

type Initial = Partial<Record<keyof ItemValues | "quantity_ref" | "discount_reason" | "scope_notes", string | null>>;

const NUM_KEYS = [...HOUR_FIELDS.map((f) => f.key), ...COST_FIELDS.map((f) => f.key)] as const;
const PCT_KEYS = OVERRIDE_FIELDS.map((f) => f.key);

function toFormValues(i: Initial): Record<string, string> {
  const out: Record<string, string> = {
    service_id: i.service_id ?? "",
    description: i.description ?? "",
    periodicity: i.periodicity ?? "unica",
    quantity_ref: i.quantity_ref ?? "",
    discount_reason: i.discount_reason ?? "",
    scope_notes: i.scope_notes ?? "",
  };
  for (const k of NUM_KEYS) out[k] = numberToInput(i[k] ?? null);
  for (const k of PCT_KEYS) out[k] = fractionToPercentInput(i[k] ?? null);
  return out;
}

function toItemValues(f: Record<string, string>): ItemValues {
  const num = (k: string) => {
    const p = parseBR(f[k]);
    return p === "invalid" ? null : p;
  };
  const pct = (k: string) => {
    const p = percentToFraction(f[k]);
    return p === "invalid" ? null : p;
  };
  return {
    description: f.description ?? "",
    service_id: f.service_id || null,
    periodicity: f.periodicity === "mensal" ? "mensal" : "unica",
    hours_preparation: num("hours_preparation"),
    hours_execution: num("hours_execution"),
    hours_delivery: num("hours_delivery"),
    hours_followup: num("hours_followup"),
    hours_travel: num("hours_travel"),
    cost_travel: num("cost_travel"),
    cost_materials: num("cost_materials"),
    cost_external: num("cost_external"),
    cost_other: num("cost_other"),
    contingency: pct("contingency"),
    margin: pct("margin"),
    discount: pct("discount"),
  };
}

export function ItemForm({
  action,
  params,
  services,
  initial,
  cancelHref,
  submitLabel,
}: {
  action: (s: QuoteActionState, f: FormData) => Promise<QuoteActionState>;
  params: ParameterValues | null;
  services: ServiceOpt[];
  initial: Initial;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<QuoteActionState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const values = state.values ?? toFormValues(initial);
  const [snap, setSnap] = useState<Record<string, string>>(values);

  const svc = services.find((s) => s.id === snap.service_id) ?? null;
  const calc = calculateItem(params, toItemValues(snap), svc);
  const r = calc.result;
  const families = [...new Set(services.map((s) => s.family))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const period = PERIODICITY[snap.periodicity === "mensal" ? "mensal" : "unica"].short;

  return (
    <form
      action={formAction}
      noValidate
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      onChange={(ev) => {
        const fd = new FormData(ev.currentTarget);
        setSnap(Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])));
      }}
    >
      <div className="min-w-0 space-y-6">
        {state.error && <Alert kind="error">{state.error}</Alert>}

        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-navy">Escopo do item</legend>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Serviço do catálogo</span>
            <select
              name="service_id"
              defaultValue={values.service_id}
              key={`svc-${values.service_id}`}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
            >
              <option value="">— Item sem serviço do catálogo —</option>
              {families.map((fam) => (
                <optgroup key={fam} label={fam}>
                  {services
                    .filter((s) => s.family === fam)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            {e.service_id && <span className="mt-1 block text-xs text-danger">{e.service_id}</span>}
          </label>
          {calc.notReleased && (
            <Alert kind="warning">
              Serviço ainda não liberado comercialmente (AUDDOC004): a simulação interna é permitida, mas a proposta não poderá ser emitida
              enquanto a situação não for “Apto comercialmente”.
            </Alert>
          )}
          {calc.noModel && (
            <Alert kind="warning">
              Serviço sem modelo de precificação aprovado (SaaS): não é calculado por hora técnica e fica fora dos totais.
            </Alert>
          )}
          <Field label="Descrição do item" name="description" defaultValue={values.description} error={e.description} maxLength={300} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Periodicidade"
              name="periodicity"
              required
              defaultValue={values.periodicity}
              error={e.periodicity}
              options={[
                { value: "unica", label: PERIODICITY.unica.label },
                { value: "mensal", label: PERIODICITY.mensal.label },
              ]}
              hint="Valores mensais nunca são somados aos únicos."
            />
            <Field
              label="Quantidade / referência"
              name="quantity_ref"
              required={false}
              defaultValue={values.quantity_ref}
              error={e.quantity_ref}
              hint="Ex.: 12 colaboradores, 1 unidade."
              maxLength={120}
            />
          </div>
          <TextAreaField label="Notas de escopo" name="scope_notes" defaultValue={values.scope_notes} error={e.scope_notes} maxLength={2000} />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-navy">Horas técnicas (h)</legend>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {HOUR_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} name={f.key} required={false} inputMode="decimal" defaultValue={values[f.key]} error={e[f.key]} />
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-navy">Custos diretos (R$)</legend>
          <div className="grid grid-cols-2 gap-4">
            {COST_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} name={f.key} required={false} inputMode="decimal" defaultValue={values[f.key]} error={e[f.key]} />
            ))}
          </div>
          <p className="text-xs text-muted">Vazio ≠ zero: se não houver custo direto, informe 0.</p>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-navy">Ajustes do item (%)</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            {OVERRIDE_FIELDS.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                name={f.key}
                required={false}
                inputMode="decimal"
                defaultValue={values[f.key]}
                error={e[f.key]}
                hint={f.hint}
              />
            ))}
          </div>
          <Field
            label="Justificativa do desconto"
            name="discount_reason"
            required={false}
            defaultValue={values.discount_reason}
            error={e.discount_reason}
            maxLength={500}
          />
        </fieldset>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          <Link href={cancelHref} className="text-center text-sm text-muted hover:text-navy">
            Cancelar
          </Link>
          <div className="sm:ml-auto sm:w-56">
            <SubmitButton pendingText="Salvando…">{submitLabel}</SubmitButton>
          </div>
        </div>
      </div>

      <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start" aria-label="Prévia do cálculo">
        <section className="rounded-xl border border-line bg-white">
          <div className="border-b border-line bg-navy px-4 py-2.5 text-sm font-semibold text-white">Prévia AUDDOC011</div>
          <div className="space-y-3 p-4 text-sm">
            <div data-testid="item-status">
              <ItemStatusPill status={calc.status} />
            </div>
            <dl className="space-y-1.5">
              {[
                ["Horas totais", formatHours(r.hours)],
                ["Custo/hora", formatBRL(r.costPerHour)],
                ["Mão de obra", formatBRL(r.labor)],
                ["Custos diretos", formatBRL(r.directCosts)],
                ["Custo base", formatBRL(r.baseCost)],
                ["Contingência", formatPercent(r.contingency)],
                ["Custo com contingência", formatBRL(r.costWithContingency)],
                ["Soma de percentuais", formatPercent(r.percentSum)],
                ["Preço sugerido", formatBRL(r.suggestedPrice)],
                ["Desconto", formatPercent(r.discount)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right tabular-nums text-ink">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-line pt-2">
                <dt className="font-semibold text-ink">Preço final ({period})</dt>
                <dd className="text-right font-semibold tabular-nums text-navy" data-testid="item-final-price">
                  {formatBRL(r.finalPrice)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Margem efetiva / alvo</dt>
                <dd className="text-right tabular-nums text-ink">
                  {formatPercent(r.effectiveMargin)} / {formatPercent(r.targetMargin)}
                </dd>
              </div>
            </dl>
            {r.reasons.length > 0 && (
              <ul className="list-disc space-y-1 pl-4 text-xs text-warn">
                {r.reasons.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted">Cálculo decimal exato; valores arredondados a centavos apenas na exibição.</p>
          </div>
        </section>
      </aside>
    </form>
  );
}
