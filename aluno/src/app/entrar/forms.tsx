"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestReset, setPassword, signIn, type AuthState } from "./actions";

// Campos com 16 px de letra (o iPhone não amplia a tela ao tocar) e 48 px de altura
const inputCls = "min-h-12 w-full rounded-[10px] border-[1.5px] border-line bg-white px-3.5 text-base text-ink outline-none focus:border-green-dark focus:ring-2 focus:ring-green/25";

function Submit({ children, pending: pendingText }: { children: React.ReactNode; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="min-h-12 w-full rounded-full bg-green px-4 text-[15px] font-semibold text-navy shadow-[0_6px_18px_rgba(128,187,8,0.35)] transition hover:bg-[#8cc912] disabled:cursor-wait disabled:opacity-70">
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
      <Link href="/esqueci" className="text-center text-sm font-medium text-navy underline-offset-4 hover:underline">
        Esqueci minha senha
      </Link>
      <p className="border-t border-line pt-4 text-center text-sm text-muted">
        Ainda não é aluno?{" "}
        <Link href="/cursos" className="font-semibold text-green-dark underline-offset-4 hover:underline">
          Conheça os cursos
        </Link>
      </p>
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
      <Link href="/entrar" className="text-center text-sm font-medium text-navy underline-offset-4 hover:underline">
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
