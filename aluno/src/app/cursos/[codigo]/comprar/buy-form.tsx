"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { startPurchaseAction, type BuyState } from "./actions";

const inputCls = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[15px] text-ink focus:border-navy focus:outline-none";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center rounded-[10px] bg-green px-5 text-[15px] font-extrabold text-navy disabled:opacity-60" data-testid="go-pay">
      {pending ? "Abrindo o pagamento…" : "Ir para o pagamento"}
    </button>
  );
}

export function BuyForm({ code, requireCpf }: { code: string; requireCpf: boolean }) {
  const [state, action] = useActionState<BuyState, FormData>(startPurchaseAction.bind(null, code), {});
  const v = state.values ?? {};
  return (
    <form action={action} className="mt-5 flex flex-col gap-4" data-testid="buy-form">
      {state.error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Nome completo
        <input name="nome" required autoComplete="name" defaultValue={v.nome} className={inputCls} maxLength={160} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          E-mail
          <input name="email" type="email" required autoComplete="email" defaultValue={v.email} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Repita o e-mail
          <input name="email2" type="email" required autoComplete="off" defaultValue={v.email2} className={inputCls} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {requireCpf && (
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            CPF
            <input name="cpf" required inputMode="numeric" defaultValue={v.cpf} className={inputCls} maxLength={14} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Celular com DDD <span className="font-normal text-muted">(opcional)</span>
          <input name="telefone" type="tel" autoComplete="tel" defaultValue={v.telefone} className={inputCls} maxLength={20} />
        </label>
      </div>
      <label className="flex items-start gap-2.5 text-sm text-ink">
        <input type="checkbox" name="aceite" required defaultChecked={v.aceite === "on"} className="mt-0.5 size-4 shrink-0 accent-navy" />
        <span>
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className="font-semibold text-navy underline">
            Termos de uso e de compra
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="font-semibold text-navy underline">
            Política de privacidade
          </Link>
          .
        </span>
      </label>
      <Submit />
    </form>
  );
}
