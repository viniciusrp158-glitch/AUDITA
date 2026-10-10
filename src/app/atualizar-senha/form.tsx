"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Alert, Field, SubmitButton } from "@/components/form";
import { updatePassword, type FormState } from "../login/actions";

export function UpdatePasswordForm({ first }: { first: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});
  return (
    <AuthShell title="Definir nova senha">
      <form action={action} className="space-y-4" noValidate>
        {first && (
          <Alert kind="info">
            Primeiro acesso com senha provisória: defina agora a sua senha pessoal para continuar.
          </Alert>
        )}
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
      {!first && (
        <div className="mt-4 text-center">
          <Link href="/conta" className="text-sm text-navy underline-offset-2 hover:underline">
            Cancelar e voltar ao sistema
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
