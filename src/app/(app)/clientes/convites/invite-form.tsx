"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert, Field, SubmitButton } from "@/components/form";
import { formatDateTime } from "@/lib/format";
import { createInviteAction, type InviteState } from "./actions";

export function InviteForm() {
  const [state, formAction] = useActionState<InviteState, FormData>(createInviteAction, {});
  const [copied, setCopied] = useState(false);
  const created = state.created;

  const message = created
    ? `Olá! Para agilizar seu cadastro na AUDITA, preencha o formulário neste link (válido por 24 horas e para um único envio): ${created.link}`
    : "";

  async function share() {
    if (!created) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Cadastro de cliente — AUDITA", text: message });
        return;
      } catch {
        // cancelado pelo usuário ou indisponível: segue para copiar
      }
    }
    await copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
        <Field label="Enviar para" name="recipient" error={state.fieldErrors?.recipient} placeholder="Empresa ou contato" hint="Para acompanhamento interno." />
        <Field label="Observação" name="note" required={false} placeholder="Opcional" />
        <div className="sm:pb-5">
          <SubmitButton pendingText="Gerando…" full={false}>
            Gerar link
          </SubmitButton>
        </div>
      </form>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {created && (
        <div className="rounded-xl border border-green/40 bg-green/5 p-4">
          <p className="text-sm font-semibold text-ink">Link gerado para {created.recipient}</p>
          <p className="mt-0.5 text-xs text-muted">
            Válido até {formatDateTime(created.expiresAt)} e para um único envio. Por segurança, o link é exibido somente
            agora — se perdê-lo, gere outro.
          </p>
          <code data-testid="invite-link" className="mt-3 block break-all rounded-md border border-line bg-white px-3 py-2 text-xs text-ink">
            {created.link}
          </code>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700">
              <Share2 size={16} /> Compartilhar
            </button>
            <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-navy/40">
              {copied ? <Check size={16} className="text-ok" /> : <Copy size={16} />} {copied ? "Copiado" : "Copiar mensagem"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
