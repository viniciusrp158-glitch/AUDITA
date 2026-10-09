"use client";

import { useActionState } from "react";
import { Alert, Field, SubmitButton } from "@/components/form";
import type { ActionState } from "../../actions";

export function RejectForm({ action }: { action: (s: ActionState, f: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Motivo da recusa" name="reason" error={state.fieldErrors?.reason} hint="Ex.: cliente já cadastrado (CLI-0001), dados incompletos, envio indevido." />
      <SubmitButton pendingText="Recusando…" variant="danger" full={false}>
        Recusar solicitação
      </SubmitButton>
    </form>
  );
}
