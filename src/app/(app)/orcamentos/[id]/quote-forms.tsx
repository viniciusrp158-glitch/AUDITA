"use client";

import { useActionState } from "react";
import { Alert, Field, SubmitButton, TextAreaField } from "@/components/form";
import type { QuoteActionState } from "../actions";

export function QuoteHeaderForm({
  action,
  initial,
}: {
  action: (s: QuoteActionState, f: FormData) => Promise<QuoteActionState>;
  initial: { validity_days: number | null; payment_terms: string | null; notes: string | null };
}) {
  const [state, formAction] = useActionState<QuoteActionState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {
    validity_days: initial.validity_days?.toString() ?? "",
    payment_terms: initial.payment_terms ?? "",
    notes: initial.notes ?? "",
  };
  return (
    <form action={formAction} noValidate className="space-y-4" key={state.seq ?? 0}>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field label="Validade (dias)" name="validity_days" required={false} inputMode="numeric" defaultValue={v.validity_days} error={e.validity_days} />
        <Field
          label="Condições de pagamento"
          name="payment_terms"
          required={false}
          defaultValue={v.payment_terms}
          error={e.payment_terms}
          maxLength={1000}
          hint="Conforme AUDDOC011 §7; sem condição definida, fica em aberto."
        />
      </div>
      <TextAreaField label="Observações internas" name="notes" defaultValue={v.notes} error={e.notes} maxLength={4000} />
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Salvando…" variant="secondary">
          Salvar condições
        </SubmitButton>
      </div>
    </form>
  );
}
