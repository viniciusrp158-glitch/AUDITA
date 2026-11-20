"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/form";
import { unsubscribeAction } from "./actions";

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action] = useActionState(unsubscribeAction, {});
  if (state.done)
    return (
      <p role="status" className="rounded-md bg-ok/10 px-4 py-3 text-sm text-ink">
        Pronto. Não vamos mais entrar em contato com a sua empresa. Obrigado pelo retorno.
      </p>
    );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="t" value={token} />
      <p className="text-sm text-ink">Confirme para não receber mais e-mails nem mensagens da AUDITA | SSMA &amp; SGI.</p>
      <SubmitButton pendingText="Registrando…" full>
        Não quero receber mais contatos
      </SubmitButton>
    </form>
  );
}
