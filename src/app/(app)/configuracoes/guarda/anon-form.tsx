"use client";

import { useActionState, useId } from "react";
import { Alert, CheckboxField, SubmitButton } from "@/components/form";
import type { AnonState } from "./actions";

export function AnonymizeForm({ action }: { action: (prev: AnonState, fd: FormData) => Promise<AnonState> }) {
  const [state, formAction] = useActionState(action, {});
  const id = useId();
  return (
    <form action={formAction} className="mt-2 space-y-2" data-testid="anon-form">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <label htmlFor={`${id}-motivo`} className="block text-xs font-medium text-ink">
        Motivo
      </label>
      <input
        id={`${id}-motivo`}
        name="motivo"
        required
        minLength={5}
        maxLength={500}
        defaultValue="Prazo de guarda vencido (caderno J4)"
        className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
      />
      <CheckboxField name="confirm" label="Confirmo: a anonimização não pode ser desfeita." />
      <SubmitButton pendingText="Anonimizando…" variant="danger">Anonimizar</SubmitButton>
    </form>
  );
}
