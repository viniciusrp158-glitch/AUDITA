"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Alert, CheckboxField, Field, SubmitButton, TextAreaField } from "@/components/form";
import type { TrState } from "../actions";
import { setSalesOpenAction } from "./actions";

type Action = (s: TrState, f: FormData) => Promise<TrState>;

function Feedback({ state }: { state: TrState }) {
  if (state.error) return <Alert kind="error">{state.error}</Alert>;
  if (state.ok) return <Alert kind="info">{state.ok}</Alert>;
  return null;
}

export function SalesSettingsForm({ action, initial }: { action: Action; initial: Record<string, string> }) {
  const [state, formAction] = useActionState<TrState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? initial;
  return (
    <form action={formAction} noValidate className="space-y-4" data-testid="sales-settings">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Razão social do vendedor" name="seller_name" required={false} defaultValue={v.seller_name} error={e.seller_name} maxLength={200} />
        <Field label="CNPJ" name="seller_document" required={false} defaultValue={v.seller_document} error={e.seller_document} inputMode="numeric" />
        <Field label="E-mail de suporte" name="support_email" type="email" required={false} defaultValue={v.support_email} error={e.support_email} />
        <Field label="Telefone/WhatsApp de suporte" name="support_phone" required={false} defaultValue={v.support_phone} error={e.support_phone} inputMode="tel" hint="Com DDD." />
      </div>
      <CheckboxField name="require_cpf" label="Pedir CPF na compra" defaultChecked={v.require_cpf === "on"} hint="O Mercado Pago costuma pedir o CPF no Pix e no boleto." />
      <TextAreaField
        label="Termos de uso e de compra"
        name="terms_text"
        required={false}
        rows={8}
        maxLength={60000}
        defaultValue={v.terms_text}
        error={e.terms_text}
        hint="Inclua a política de cancelamento e reembolso (7 dias de arrependimento na compra pela internet, art. 49 do CDC). Fica em /treinamentos/termos."
      />
      <TextAreaField
        label="Política de privacidade (LGPD)"
        name="privacy_text"
        required={false}
        rows={8}
        maxLength={60000}
        defaultValue={v.privacy_text}
        error={e.privacy_text}
        hint="Fica em /treinamentos/privacidade. O comprador aceita os dois textos antes de pagar."
      />
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Salvando…">Salvar configurações</SubmitButton>
      </div>
    </form>
  );
}

export function SecretForm({ action, label, hint, current, testId }: { action: Action; label: string; hint: string; current: string | null; testId: string }) {
  const [state, formAction] = useActionState<TrState, FormData>(action, {});
  return (
    <form action={formAction} noValidate className="flex flex-col gap-2" data-testid={testId} autoComplete="off">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <KeyRound size={15} aria-hidden /> {label}
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${current ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn"}`}>{current ? `Cadastrado ${current}` : "Não cadastrado"}</span>
      </p>
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <Field label={current ? "Trocar por" : "Colar aqui"} name="value" type="password" autoComplete="new-password" required={false} error={state.fieldErrors?.value} hint={hint} />
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
      </div>
    </form>
  );
}

export function SalesSwitch({ open, ready }: { open: boolean; ready: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending || (!open && !ready)}
        data-testid="sales-switch"
        onClick={() =>
          start(async () => {
            const r = await setSalesOpenAction(!open);
            setMsg(r.error ? { kind: "error", text: r.error } : { kind: "info", text: r.ok ?? "" });
            if (!r.error) router.refresh();
          })
        }
        className={`inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${open ? "border border-line bg-white text-danger hover:bg-surface" : "bg-navy text-white hover:bg-navy-700"}`}
      >
        {pending ? "Aguarde…" : open ? "Fechar as vendas" : "Abrir as vendas"}
      </button>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
    </div>
  );
}
