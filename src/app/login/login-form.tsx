"use client";

import { useActionState } from "react";
import { Alert, Field, SubmitButton } from "@/components/form";
import { signIn, type FormState } from "./actions";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error ? <Alert kind="error">{state.error}</Alert> : notice ? <Alert kind="info">{notice}</Alert> : null}
      <Field label="E-mail" name="email" type="email" autoComplete="username" />
      <Field label="Senha" name="password" type="password" autoComplete="current-password" />
      <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
    </form>
  );
}
