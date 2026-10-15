"use client";

import { useActionState } from "react";
import { Alert, CheckboxField, SubmitButton } from "@/components/form";
import { confirmEnrollAction, disableMfaAction, startEnrollAction, verifyLoginAction, type MfaState } from "@/lib/mfa-actions";

const codeInput = (id: string) => (
  <input
    id={id}
    name="codigo"
    inputMode="numeric"
    autoComplete="one-time-code"
    pattern="[0-9]{6}"
    maxLength={6}
    required
    className="w-40 rounded-md border border-line bg-white px-3 py-2 text-center text-lg tracking-[0.3em]"
  />
);

/** Ativação: gera o QR Code, a pessoa lê no aplicativo autenticador e confirma com o código. */
export function MfaEnroll() {
  const [started, start] = useActionState(startEnrollAction, {});
  const [confirmed, confirm] = useActionState(
    (prev: MfaState, fd: FormData) => confirmEnrollAction({ ...prev, factorId: prev.factorId ?? started.factorId }, fd),
    {},
  );
  if (confirmed.ok) return <Alert kind="info">{confirmed.ok}</Alert>;
  return (
    <div className="space-y-3" data-testid="mfa-enroll">
      {started.error && <Alert kind="error">{started.error}</Alert>}
      {!started.factorId ? (
        <form action={start}>
          <SubmitButton pendingText="Gerando…">Ativar verificação em duas etapas</SubmitButton>
        </form>
      ) : (
        <form action={confirm} className="space-y-3">
          <p className="text-sm text-ink">
            1. Abra um aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou similar) e leia o QR Code.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={started.qr} alt="QR Code para o aplicativo autenticador" width={180} height={180} className="rounded-md border border-line bg-white p-2" />
          <p className="break-all text-xs text-muted">
            Sem câmera? Digite a chave: <span className="font-mono text-ink" data-testid="mfa-secret">{started.secret}</span>
          </p>
          <label htmlFor="mfa-code" className="block text-sm text-ink">
            2. Digite o código de 6 números que aparece no aplicativo:
          </label>
          {codeInput("mfa-code")}
          {confirmed.error && <Alert kind="error">{confirmed.error}</Alert>}
          <SubmitButton pendingText="Confirmando…">Confirmar e ativar</SubmitButton>
        </form>
      )}
    </div>
  );
}

export function MfaDisable() {
  const [state, action] = useActionState(disableMfaAction, {});
  if (state.ok) return <Alert kind="info">{state.ok}</Alert>;
  return (
    <form action={action} className="space-y-2" data-testid="mfa-disable">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <CheckboxField name="confirm" label="Desativar a verificação em duas etapas (não recomendado para o usuário mestre)." />
      <SubmitButton pendingText="Desativando…" variant="secondary">
        Desativar
      </SubmitButton>
    </form>
  );
}

export function MfaVerifyLogin() {
  const [state, action] = useActionState(verifyLoginAction, {});
  return (
    <form action={action} className="space-y-3" data-testid="mfa-verify">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <label htmlFor="mfa-login-code" className="block text-sm font-medium text-ink">
        Código do aplicativo autenticador
      </label>
      {codeInput("mfa-login-code")}
      <SubmitButton pendingText="Verificando…" full>
        Verificar
      </SubmitButton>
    </form>
  );
}
