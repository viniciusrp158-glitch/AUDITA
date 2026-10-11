"use client";

import { useActionState, useId } from "react";
import { Alert, Field, SelectField, SubmitButton } from "@/components/form";
import { CASH_CATEGORIES, type CashCategory } from "@/lib/execucao/labels";
import type { CashState } from "./actions";

type Action = (s: CashState, f: FormData) => Promise<CashState>;

export function CashEntryForm({ action, today, contracts }: { action: Action; today: string; contracts: { id: string; label: string }[] }) {
  const [state, formAction] = useActionState<CashState, FormData>(action, {});
  const v = state.values ?? { occurred_on: today, category: "recebimento" };
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="space-y-4" data-testid="cash-form" key={state.seq}>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Data efetiva" name="occurred_on" type="date" defaultValue={v.occurred_on} error={e.occurred_on} hint="Quando o dinheiro entrou ou saiu." />
        <SelectField
          label="Tipo"
          name="category"
          required
          defaultValue={v.category}
          error={e.category}
          options={(Object.keys(CASH_CATEGORIES) as CashCategory[]).map((c) => ({ value: c, label: CASH_CATEGORIES[c].label }))}
        />
        <Field label="Valor (R$)" name="amount" inputMode="decimal" defaultValue={v.amount} error={e.amount} placeholder="0,00" />
        <Field label="Descrição" name="description" defaultValue={v.description} error={e.description} maxLength={300} className="sm:col-span-2" />
        <Field label="Quem pagou / recebeu" name="counterparty" required={false} defaultValue={v.counterparty} maxLength={200} />
        <Field label="Comprovante / referência" name="reference" required={false} defaultValue={v.reference} maxLength={200} hint="Ex.: nº do comprovante, NF ou extrato." />
        <SelectField
          label="Serviço contratado (opcional)"
          name="contract_id"
          defaultValue={v.contract_id}
          className="sm:col-span-2"
          options={[{ value: "", label: "Nenhum" }, ...contracts.map((c) => ({ value: c.id, label: c.label }))]}
        />
      </div>
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Lançando…">Lançar movimentação</SubmitButton>
      </div>
    </form>
  );
}

export function ReverseForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<CashState, FormData>(action, {});
  const uid = useId();
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      {state.error && <p className="w-full text-xs text-danger">{state.error}</p>}
      <label className="min-w-0 flex-1 text-xs text-ink" htmlFor={`m-${uid}`}>
        Motivo do estorno
        <input id={`m-${uid}`} name="motivo" maxLength={500} className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm" />
      </label>
      <SubmitButton pendingText="…" variant="secondary" full={false}>
        Estornar
      </SubmitButton>
    </form>
  );
}
