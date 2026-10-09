"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Alert, CheckboxField, Field, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { formatCep, formatCnae, formatPhone, formatTaxId, UFS } from "@/lib/br";
import type { ActionState } from "./actions";

export type ClientFormValues = Partial<
  Record<
    | "person_type" | "legal_name" | "trade_name" | "tax_id" | "cnae" | "segment" | "email" | "phone" | "notes"
    | "address_zip" | "address_street" | "address_number" | "address_complement" | "address_district"
    | "address_city" | "address_state",
    string | null
  >
>;

const UF_OPTIONS = [{ value: "", label: "—" }, ...UFS.map((u) => ({ value: u, label: u }))];

export function ClientForm({
  action,
  initial,
  submitLabel,
  cancelHref,
  isDev,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: ClientFormValues;
  submitLabel: string;
  cancelHref: string;
  isDev: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const v = { ...formatInitial(initial), ...(state.values ?? {}) };
  const e = state.fieldErrors ?? {};
  const [personType, setPersonType] = useState(v.person_type || "PJ");
  const hasNameDuplicates = (state.duplicates ?? []).length > 0 && !state.error;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}

      {(state.duplicates ?? []).length > 0 && (
        <Alert kind="warning">
          <p className="font-semibold">Possível cadastro duplicado</p>
          <p className="mt-1 text-ink">Encontramos clientes parecidos. Verifique antes de criar um novo:</p>
          <ul className="mt-2 space-y-1 text-ink">
            {state.duplicates!.map((d) => (
              <li key={d.id}>
                <Link href={`/clientes/${d.id}`} className="font-mono text-xs font-semibold text-navy hover:underline" target="_blank">
                  {d.client_code}
                </Link>{" "}
                — {d.legal_name}
                {d.trade_name ? ` (${d.trade_name})` : ""}
                {d.tax_id ? ` · ${formatTaxId(d.tax_id)}` : ""}
                {d.status === "inativo" ? " · inativo" : ""}
                {d.reason === "mesmo_documento" ? " · mesmo documento" : ""}
              </li>
            ))}
          </ul>
          {hasNameDuplicates && (
            <div className="mt-3">
              <CheckboxField
                name="confirm_not_duplicate"
                label="Confirmo que é uma empresa/pessoa diferente e quero cadastrar mesmo assim."
              />
            </div>
          )}
        </Alert>
      )}

      {isDev && (
        <Alert kind="warning">
          Ambiente de desenvolvimento: o cadastro será marcado como <strong>TESTE</strong>. Use apenas dados fictícios.
        </Alert>
      )}

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-navy">Identificação</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              Tipo<span className="text-danger" aria-hidden> *</span>
            </span>
            <select
              name="person_type"
              value={personType}
              onChange={(ev) => setPersonType(ev.target.value)}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
            >
              <option value="PJ">Pessoa jurídica</option>
              <option value="PF">Pessoa física</option>
            </select>
          </label>
          <Field
            className="sm:col-span-2"
            label={personType === "PJ" ? "Razão social" : "Nome completo"}
            name="legal_name"
            defaultValue={v.legal_name}
            error={e.legal_name}
            maxLength={200}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Nome fantasia"
            name="trade_name"
            required={false}
            defaultValue={v.trade_name}
            error={e.trade_name}
            className="sm:col-span-2"
          />
          <Field
            label={personType === "PJ" ? "CNPJ" : "CPF"}
            name="tax_id"
            required={false}
            inputMode="numeric"
            defaultValue={v.tax_id}
            error={e.tax_id}
            hint="Opcional. Validado pelos dígitos verificadores."
            placeholder={personType === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ramo de atividade / segmento" name="segment" required={false} defaultValue={v.segment} error={e.segment} className="sm:col-span-2" />
          <Field label="CNAE principal" name="cnae" required={false} inputMode="numeric" defaultValue={v.cnae} error={e.cnae} placeholder="0000-0/00" />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-navy">Contato geral</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail" name="email" type="email" required={false} defaultValue={v.email} error={e.email} />
          <Field label="Telefone" name="phone" required={false} inputMode="tel" defaultValue={v.phone} error={e.phone} placeholder="(15) 3333-4444" />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-navy">Endereço da sede</legend>
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="CEP" name="address_zip" required={false} inputMode="numeric" defaultValue={v.address_zip} error={e.address_zip} className="sm:col-span-2" placeholder="00000-000" />
          <Field label="Logradouro" name="address_street" required={false} defaultValue={v.address_street} error={e.address_street} className="sm:col-span-4" />
          <Field label="Número" name="address_number" required={false} defaultValue={v.address_number} error={e.address_number} />
          <Field label="Complemento" name="address_complement" required={false} defaultValue={v.address_complement} error={e.address_complement} className="sm:col-span-2" />
          <Field label="Bairro" name="address_district" required={false} defaultValue={v.address_district} error={e.address_district} className="sm:col-span-3" />
          <Field label="Município" name="address_city" required={false} defaultValue={v.address_city} error={e.address_city} className="sm:col-span-4" />
          <SelectField label="UF" name="address_state" options={UF_OPTIONS} defaultValue={v.address_state} error={e.address_state} className="sm:col-span-2" />
        </div>
      </fieldset>

      <TextAreaField label="Observações" name="notes" defaultValue={v.notes} error={e.notes} rows={3} maxLength={4000} />

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <div className="w-full sm:w-auto">
          <SubmitButton pendingText="Salvando…" full={false}>
            {submitLabel}
          </SubmitButton>
        </div>
        <Link href={cancelHref} className="text-sm text-muted hover:text-navy">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function formatInitial(initial?: ClientFormValues): Record<string, string> {
  if (!initial) return { person_type: "PJ" };
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(initial)) out[k] = val ?? "";
  out.tax_id = formatTaxId(initial.tax_id);
  out.address_zip = formatCep(initial.address_zip);
  out.phone = formatPhone(initial.phone);
  out.cnae = formatCnae(initial.cnae);
  return out;
}
