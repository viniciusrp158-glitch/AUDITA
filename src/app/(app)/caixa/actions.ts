"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { fieldErrors, formToObject } from "@/lib/clients/schema";
import { isProduction } from "@/lib/env";
import { todaySaoPaulo } from "@/lib/format";
import { parseBR } from "@/lib/pricing/engine";
import { ADMIN_ONLY } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type CashState = { ok?: string; seq?: number; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const entrySchema = z
  .object({
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data em que o dinheiro entrou ou saiu."),
    category: z.enum(["recebimento", "custo_direto", "fixo", "pro_labore", "tributo", "outro"], { message: "Escolha o tipo." }),
    amount: z.string().transform((v, ctx) => {
      const p = parseBR(v);
      if (p === "invalid" || p === null || Number(p) <= 0) {
        ctx.addIssue({ code: "custom", message: "Informe um valor maior que zero (ex.: 1.234,56)." });
        return z.NEVER;
      }
      return String(p);
    }),
    description: z.string().trim().min(3, "Descreva a movimentação.").max(300),
    counterparty: opt(200),
    reference: opt(200),
    contract_id: z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || uuidRe.test(v), "Seleção inválida."),
  })
  .refine((v) => v.occurred_on <= todaySaoPaulo(), { path: ["occurred_on"], message: "Lance apenas o que já aconteceu (data futura não é permitida)." });

export async function createCashEntryAction(_prev: CashState, formData: FormData): Promise<CashState> {
  await requireAppUser(ADMIN_ONLY);
  const values = formToObject(formData);
  const parsed = entrySchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const d = parsed.data;
  const supabase = await createClient();
  let client_id: string | null = null;
  if (d.contract_id) {
    const { data: c } = await supabase.from("service_contracts").select("client_id").eq("id", d.contract_id).maybeSingle();
    client_id = c?.client_id ?? null;
  }
  const { error } = await supabase.from("cash_entries").insert({
    ...d,
    client_id,
    kind: d.category === "recebimento" ? "recebimento" : "pagamento",
    is_test: !isProduction,
  });
  if (error) return { values, error: error.message?.includes("já ocorridas") ? error.message : "Não foi possível lançar." };
  revalidatePath("/caixa");
  revalidatePath("/");
  return { ok: "Lançamento registrado.", seq: Date.now(), values: { occurred_on: d.occurred_on, category: d.category } };
}

export async function reverseCashEntryAction(id: string, _prev: CashState, formData: FormData): Promise<CashState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(id)) return { error: "Lançamento inválido." };
  const reason = String(formData.get("motivo") ?? "").trim();
  if (reason.length < 5) return { fieldErrors: { motivo: "Informe o motivo (mín. 5 caracteres)." }, error: "Informe o motivo do estorno." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_cash_entry", { p_id: id, p_reason: reason });
  if (error) return { error: "Não foi possível estornar (já estornado?)." };
  revalidatePath("/caixa");
  revalidatePath("/");
  return { ok: "Lançamento estornado.", seq: Date.now() };
}
