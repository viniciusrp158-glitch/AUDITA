"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { startPurchaseAction, type BuyState } from "./actions";

// 16 px e 48 px de altura (Audita Academy): o iPhone não amplia a tela ao tocar no campo
const inputCls = "min-h-12 w-full rounded-[10px] border-[1.5px] border-line bg-white px-3.5 text-base text-ink outline-none focus:border-green-dark focus:ring-2 focus:ring-green/25";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center rounded-full bg-green px-5 text-[15px] font-semibold text-navy shadow-[0_6px_18px_rgba(128,187,8,0.35)] hover:bg-[#8cc912] disabled:opacity-60" data-testid="go-pay">
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
        <input type="checkbox" name="aceite" required defaultChecked={v.aceite === "on"} className="mt-0.5 size-5 shrink-0 accent-green-dark" />
        <span>
          Li e concordo com os{" "}
          <Link href="/termos" target="_blank" className="font-semibold text-navy underline">
            Termos de Uso e de Compra
          </Link>
          , incluindo a política de cancelamento e reembolso, e declaro estar ciente da{" "}
          <Link href="/privacidade" target="_blank" className="font-semibold text-navy underline">
            Política de Privacidade
          </Link>
          .
        </span>
      </label>
      <label className="flex items-start gap-2.5 text-sm text-ink">
        <input type="checkbox" name="novidades" defaultChecked={v.novidades === "on"} className="mt-0.5 size-5 shrink-0 accent-green-dark" />
        <span>
          Quero receber novidades e ofertas de cursos da AUDITA por e-mail ou WhatsApp.{" "}
          <span className="text-muted">(Opcional; posso cancelar quando quiser.)</span>
        </span>
      </label>
      <Submit />
    </form>
  );
}
