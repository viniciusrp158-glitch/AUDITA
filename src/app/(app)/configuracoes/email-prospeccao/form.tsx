"use client";

import { useActionState } from "react";
import { Alert, Field, SubmitButton } from "@/components/form";
import { saveEmailConfigAction, type EmailConfigState } from "./actions";

export function EmailConfigForm({
  values,
  hasKey,
}: {
  values: { sender_name: string; sender_email: string; reply_to: string; daily_start: number; daily_max: number; legal_validated_on: string };
  hasKey: boolean;
}) {
  const [state, action] = useActionState<EmailConfigState, FormData>(saveEmailConfigAction, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do remetente" name="sender_name" defaultValue={values.sender_name} error={e.sender_name} placeholder="Vinicius | AUDITA" hint="Como aparece na caixa de entrada de quem recebe." />
        <Field label="E-mail do remetente" name="sender_email" type="email" defaultValue={values.sender_email} error={e.sender_email} hint="Do domínio audita.seg.br, cadastrado como remetente no Brevo." />
        <Field label="Responder para" name="reply_to" type="email" defaultValue={values.reply_to} error={e.reply_to} hint="As respostas das empresas chegam aqui." />
        <Field
          label="Chave do Brevo"
          name="api_key"
          type="password"
          required={false}
          autoComplete="off"
          error={e.api_key}
          placeholder={hasKey ? "•••••••• (já configurada — deixe em branco para manter)" : "Cole aqui a chave de API do Brevo"}
          hint="Guardada cifrada no servidor; nunca é mostrada de novo."
        />
        <Field label="Limite inicial por dia" name="daily_start" type="number" inputMode="numeric" defaultValue={String(values.daily_start)} error={e.daily_start} hint="Aquecimento: sobe 5 por dia útil." />
        <Field label="Limite máximo por dia" name="daily_max" type="number" inputMode="numeric" defaultValue={String(values.daily_max)} error={e.daily_max} hint="Até 100 (decisão do Diretor)." />
        <Field
          label="Data da validação jurídica"
          name="legal_validated_on"
          type="date"
          required={false}
          defaultValue={values.legal_validated_on}
          error={e.legal_validated_on}
          hint="Libera o envio em lote (Avaliação de Legítimo Interesse validada pelo advogado)."
          className="sm:col-span-2"
        />
      </div>
      <SubmitButton pendingText="Salvando…">Salvar configuração</SubmitButton>
    </form>
  );
}
