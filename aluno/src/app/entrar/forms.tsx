"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestReset, setPassword, signIn, type AuthState } from "./actions";

const inputCls = "w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15";

function Submit({ children, pending: pendingText }: { children: React.ReactNode; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-md bg-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:cursor-wait disabled:opacity-70">
      {pending ? pendingText : children}
    </button>
  );
}

function Message({ state }: { state: AuthState }) {
  if (state.error) return <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-md border border-ok/30 bg-ok/5 px-3 py-2 text-sm text-ok">{state.ok}</p>;
  return null;
}

export function SignInForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {notice && !state.error && <p role="status" className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted">{notice}</p>}
      <Message state={state} />
      <label className="block text-sm font-medium text-ink">
        E-mail
        <input name="email" type="email" autoComplete="email" defaultValue={state.email} className={`${inputCls} mt-1`} />
      </label>
      <label className="block text-sm font-medium text-ink">
        Senha
        <input name="password" type="password" autoComplete="current-password" className={`${inputCls} mt-1`} />
      </label>
      <Submit pending="Entrando…">Entrar</Submit>
      <Link href="/esqueci" className="text-center text-sm font-medium text-navy hover:underline">
        Esqueci minha senha
      </Link>
    </form>
  );
}

export function ResetForm() {
  const [state, action] = useActionState<AuthState, FormData>(requestReset, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Message state={state} />
      <label className="block text-sm font-medium text-ink">
        E-mail do cadastro
        <input name="email" type="email" autoComplete="email" defaultValue={state.email} className={`${inputCls} mt-1`} />
      </label>
      <Submit pending="Enviando…">Enviar link</Submit>
      <Link href="/entrar" className="text-center text-sm font-medium text-navy hover:underline">
        Voltar para entrar
      </Link>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState<AuthState, FormData>(setPassword, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Message state={state} />
      <label className="block text-sm font-medium text-ink">
        Nova senha
        <input name="password" type="password" autoComplete="new-password" className={`${inputCls} mt-1`} />
        <span className="mt-1 block text-xs text-muted">Pelo menos 8 caracteres, com letras e números.</span>
      </label>
      <label className="block text-sm font-medium text-ink">
        Repita a senha
        <input name="confirm" type="password" autoComplete="new-password" className={`${inputCls} mt-1`} />
      </label>
      <Submit pending="Salvando…">Salvar senha e entrar</Submit>
    </form>
  );
}
