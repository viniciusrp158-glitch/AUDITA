"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { buyerIpHeaders, vitrine } from "@/lib/vitrine";

export type BuyState = { error?: string; values?: Record<string, string> };

/** Registra o pedido e leva o comprador à página de pagamento do Mercado Pago. */
export async function startPurchaseAction(code: string, _prev: BuyState, formData: FormData): Promise<BuyState> {
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  if (values.email.trim().toLowerCase() !== (values.email2 ?? "").trim().toLowerCase()) return { values, error: "Os e-mails não conferem." };
  const r = await vitrine<{ ir_para: string }>(
    "comprar",
    {
      codigo: code,
      nome: values.nome,
      email: values.email,
      cpf: values.cpf || null,
      telefone: values.telefone || null,
      aceite: values.aceite === "on",
      novidades: values.novidades === "on",
    },
    buyerIpHeaders(await headers()),
  );
  if (r.error || !r.data?.ir_para) return { values, error: r.error ?? "Não foi possível iniciar o pagamento." };
  redirect(r.data.ir_para);
}
