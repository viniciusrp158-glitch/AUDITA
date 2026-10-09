"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, CheckboxField, Field, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { formatCep, formatCnpj, formatPhone, UFS } from "@/lib/br";
import type { ClientContact, ClientUnit } from "@/lib/clients/queries";
import type { ActionState } from "../actions";

const UF_OPTIONS = [{ value: "", label: "—" }, ...UFS.map((u) => ({ value: u, label: u }))];

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function UnitForm({ action, unit, cancelHref }: { action: Action; unit?: ClientUnit; cancelHref: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const init: Record<string, string> = unit
    ? {
        name: unit.name,
        tax_id: unit.tax_id ? formatCnpj(unit.tax_id) : "",
        address_zip: formatCep(unit.address_zip),
        address_street: unit.address_street ?? "",
        address_number: unit.address_number ?? "",
        address_complement: unit.address_complement ?? "",
        address_district: unit.address_district ?? "",
        address_city: unit.address_city ?? "",
        address_state: unit.address_state ?? "",
        local_contact: unit.local_contact ?? "",
        notes: unit.notes ?? "",
      }
    : {};
  const v = { ...init, ...(state.values ?? {}) };
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nome da unidade" name="name" defaultValue={v.name} error={e.name} className="sm:col-span-2" placeholder="Ex.: Matriz, Filial Votorantim" />
        <Field label="CNPJ da unidade" name="tax_id" required={false} inputMode="numeric" defaultValue={v.tax_id} error={e.tax_id} />
      </div>
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label="CEP" name="address_zip" required={false} inputMode="numeric" defaultValue={v.address_zip} error={e.address_zip} className="sm:col-span-2" />
        <Field label="Logradouro" name="address_street" required={false} defaultValue={v.address_street} error={e.address_street} className="sm:col-span-4" />
        <Field label="Número" name="address_number" required={false} defaultValue={v.address_number} error={e.address_number} />
        <Field label="Complemento" name="address_complement" required={false} defaultValue={v.address_complement} error={e.address_complement} className="sm:col-span-2" />
        <Field label="Bairro" name="address_district" required={false} defaultValue={v.address_district} error={e.address_district} className="sm:col-span-3" />
        <Field label="Município" name="address_city" required={false} defaultValue={v.address_city} error={e.address_city} className="sm:col-span-4" />
        <SelectField label="UF" name="address_state" options={UF_OPTIONS} defaultValue={v.address_state} error={e.address_state} className="sm:col-span-2" />
      </div>
      <Field label="Contato local" name="local_contact" required={false} defaultValue={v.local_contact} error={e.local_contact} hint="Ex.: portaria, responsável pelo acesso." />
      <TextAreaField label="Observações" name="notes" defaultValue={v.notes} error={e.notes} rows={2} />
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Salvando…" full={false}>
          {unit ? "Salvar unidade" : "Adicionar unidade"}
        </SubmitButton>
        <Link href={cancelHref} className="text-sm text-muted hover:text-navy">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

export function ContactForm({
  action,
  contact,
  units,
  cancelHref,
}: {
  action: Action;
  contact?: ClientContact;
  units: ClientUnit[];
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const init: Record<string, string> = contact
    ? {
        full_name: contact.full_name,
        role_title: contact.role_title ?? "",
        email: contact.email ?? "",
        phone: formatPhone(contact.phone),
        unit_id: contact.unit_id ?? "",
        purpose: contact.purpose ?? "",
        is_primary: contact.is_primary ? "on" : "",
      }
    : {};
  const v = { ...init, ...(state.values ?? {}) };
  const e = state.fieldErrors ?? {};
  const unitOptions = [
    { value: "", label: "Cliente (geral)" },
    ...units.filter((u) => u.status === "ativo" || u.id === v.unit_id).map((u) => ({ value: u.id, label: u.name })),
  ];
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" name="full_name" defaultValue={v.full_name} error={e.full_name} />
        <Field label="Cargo / função" name="role_title" required={false} defaultValue={v.role_title} error={e.role_title} />
        <Field label="E-mail" name="email" type="email" required={false} defaultValue={v.email} error={e.email} />
        <Field label="Telefone" name="phone" required={false} inputMode="tel" defaultValue={v.phone} error={e.phone} />
        <SelectField label="Vínculo" name="unit_id" options={unitOptions} defaultValue={v.unit_id} error={e.unit_id} />
        <Field label="Finalidade do contato" name="purpose" required={false} defaultValue={v.purpose} error={e.purpose} hint="Ex.: comercial, financeiro, técnico (LGPD: só o necessário)." />
      </div>
      <CheckboxField name="is_primary" label="Contato principal do cliente" defaultChecked={v.is_primary === "on"} />
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Salvando…" full={false}>
          {contact ? "Salvar contato" : "Adicionar contato"}
        </SubmitButton>
        <Link href={cancelHref} className="text-sm text-muted hover:text-navy">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

export function ClientStatusForm({ action, status }: { action: Action; status: "ativo" | "inativo" }) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      {status === "ativo" ? (
        <>
          <input type="hidden" name="target" value="inativo" />
          <Field
            label="Motivo da inativação"
            name="reason"
            error={state.fieldErrors?.reason}
            hint="O cadastro e o histórico são preservados; o código CLI não será reutilizado."
          />
          <SubmitButton pendingText="Inativando…" variant="danger" full={false}>
            Inativar cliente
          </SubmitButton>
        </>
      ) : (
        <>
          <input type="hidden" name="target" value="ativo" />
          <SubmitButton pendingText="Reativando…" variant="secondary" full={false}>
            Reativar cliente
          </SubmitButton>
        </>
      )}
    </form>
  );
}
