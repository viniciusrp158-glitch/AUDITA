"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Alert, Field, SubmitButton } from "@/components/form";
import { requestPasswordReset, type FormState } from "../login/actions";

export default function RecuperarSenhaPage() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <AuthShell title="Recuperar acesso">
      <form action={action} className="space-y-4" noValidate>
        {state.error && <Alert kind="error">{state.error}</Alert>}
        {state.message && <Alert kind="info">{state.message}</Alert>}
        <Field label="E-mail cadastrado" name="email" type="email" autoComplete="username" />
        <SubmitButton pendingText="Enviando…">Enviar link</SubmitButton>
      </form>
      <div className="mt-4 text-center">
        <Link href="/login" className="text-sm text-navy underline-offset-2 hover:underline">
          Voltar ao login
        </Link>
      </div>
    </AuthShell>
  );
}
