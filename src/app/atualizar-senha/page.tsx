"use client";

import { useActionState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Alert, Field, SubmitButton } from "@/components/form";
import { updatePassword, type FormState } from "../login/actions";

export default function AtualizarSenhaPage() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});
  return (
    <AuthShell title="Definir nova senha">
      <form action={action} className="space-y-4" noValidate>
        {state.error && <Alert kind="error">{state.error}</Alert>}
        <Field
          label="Nova senha"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="Mínimo de 12 caracteres, com letras e números."
        />
        <Field label="Confirmar nova senha" name="confirm" type="password" autoComplete="new-password" />
        <SubmitButton pendingText="Salvando…">Salvar senha</SubmitButton>
      </form>
    </AuthShell>
  );
}
