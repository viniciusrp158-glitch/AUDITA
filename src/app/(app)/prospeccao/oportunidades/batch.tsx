"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { Alert } from "@/components/form";
import { sendBatchAction } from "./actions";

/**
 * Envio em lote do e-mail de apresentação (AUDDOC020 Rev.01): aos próximos do grupo com e-mail próprio, até o limite
 * do dia. Bloqueado com o motivo enquanto faltar configuração ou a validação jurídica.
 */
export function BatchEmailPanel({ group, groupLabel, left, block }: { group: string; groupLabel: string; left: number; block: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [n, setN] = useState(Math.min(20, Math.max(left, 1)));
  const [msg, setMsg] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  if (group === "precisa_contato") return null;
  return (
    <section aria-label="E-mail em lote" className="mb-4 rounded-2xl border border-line bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Mail size={18} className="text-navy" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-ink">
          E-mail de apresentação para os próximos <strong>{groupLabel}</strong> com e-mail próprio
          {!block && <span className="text-muted"> · {left} restante(s) hoje</span>}
        </p>
        {!block && (
          <>
            <label className="flex items-center gap-1 text-sm">
              <span className="sr-only">Quantidade</span>
              <input
                type="number"
                min={1}
                max={left}
                value={n}
                onChange={(e) => setN(Math.min(left, Math.max(1, Number(e.target.value) || 1)))}
                aria-label="Quantidade de e-mails"
                className="w-16 rounded-md border border-line px-2 py-1.5 text-sm tabular-nums"
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await sendBatchAction({ group, max: n });
                  setMsg(r.error ? { kind: "error", text: r.error } : { kind: "info", text: r.ok ?? "Feito." });
                  router.refresh();
                })
              }
              className="rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Enviando…" : `Enviar ${n}`}
            </button>
          </>
        )}
      </div>
      {block && <p className="mt-2 text-xs text-muted">{block}</p>}
      {msg && (
        <div className="mt-2">
          <Alert kind={msg.kind}>{msg.text}</Alert>
        </div>
      )}
    </section>
  );
}
