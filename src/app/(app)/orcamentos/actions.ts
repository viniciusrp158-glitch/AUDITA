"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { fieldErrors, formToObject } from "@/lib/clients/schema";
import { isProduction } from "@/lib/env";
import { getVigenteParameterSet } from "@/lib/pricing/queries";
import { quoteHeaderSchema, quoteItemSchema } from "@/lib/pricing/schema";
import { createClient } from "@/lib/supabase/server";

export type QuoteActionState = {
  ok?: string;
  seq?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dbMessage(error: { code?: string; message?: string } | null): string {
  const m = error?.message ?? "";
  if (m.includes("rascunho")) return "Somente cotações em rascunho podem ser alteradas.";
  if (m.includes("versão vigente")) return "A cotação só pode adotar a versão vigente dos parâmetros.";
  if (m.includes("não recebe cotação")) return "Demanda encerrada, não viável ou cancelada não recebe cotação.";
  if (error?.code === "23505") return "Esta demanda já possui cotação.";
  if (error?.code === "42501") return "Você não tem permissão para esta operação.";
  return "Não foi possível salvar. Tente novamente.";
}

/** Cria a cotação da demanda (uma por demanda), já com a versão vigente dos parâmetros e um item do serviço da demanda. */
export async function createQuoteAction(demandId: string): Promise<void> {
  await requireAppUser();
  if (!uuidRe.test(demandId)) redirect("/demandas");
  const supabase = await createClient();
  const existing = await supabase.from("quotes").select("id").eq("demand_id", demandId).maybeSingle();
  if (existing.data) redirect(`/orcamentos/${existing.data.id}`);

  const { data: demand } = await supabase
    .from("demands")
    .select("id, is_test, is_recurring, service_id, services(name)")
    .eq("id", demandId)
    .maybeSingle();
  if (!demand) redirect("/demandas");
  const vigente = await getVigenteParameterSet();
  const { data, error } = await supabase
    .from("quotes")
    .insert({ demand_id: demandId, parameter_set_id: vigente?.id ?? null, is_test: demand.is_test || !isProduction })
    .select("id")
    .single();
  if (error || !data) redirect(`/demandas/${demandId}?erro_cotacao=${error?.message?.includes("não recebe cotação") ? "encerrada" : "1"}`);

  const svc = demand.services as unknown as { name: string } | null;
  if (demand.service_id && svc) {
    await supabase.from("quote_items").insert({
      quote_id: data.id,
      position: 1,
      service_id: demand.service_id,
      description: svc.name.slice(0, 300),
      periodicity: demand.is_recurring ? "mensal" : "unica",
    });
  }
  revalidatePath(`/demandas/${demandId}`);
  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${data.id}?criada=1`);
}

export async function updateQuoteHeaderAction(id: string, _prev: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  await requireAppUser();
  if (!uuidRe.test(id)) return { error: "Cotação inválida." };
  const values = formToObject(formData);
  const parsed = quoteHeaderSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update(parsed.data).eq("id", id);
  if (error) return { values, error: dbMessage(error) };
  revalidatePath(`/orcamentos/${id}`);
  return { ok: "Condições salvas.", seq: Date.now() };
}

/** Passa a cotação (rascunho) para a versão vigente atual dos parâmetros. */
export async function adoptVigenteAction(id: string): Promise<void> {
  await requireAppUser();
  if (!uuidRe.test(id)) redirect("/orcamentos");
  const vigente = await getVigenteParameterSet();
  if (vigente) {
    const supabase = await createClient();
    await supabase.from("quotes").update({ parameter_set_id: vigente.id }).eq("id", id);
  }
  revalidatePath(`/orcamentos/${id}`);
  redirect(`/orcamentos/${id}`);
}

export async function saveItemAction(
  quoteId: string,
  itemId: string | null,
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  await requireAppUser();
  if (!uuidRe.test(quoteId) || (itemId !== null && !uuidRe.test(itemId))) return { error: "Item inválido." };
  const values = formToObject(formData);
  const parsed = quoteItemSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };

  const supabase = await createClient();
  if (itemId) {
    const { error } = await supabase.from("quote_items").update(parsed.data).eq("id", itemId).eq("quote_id", quoteId);
    if (error) return { values, error: dbMessage(error) };
  } else {
    const { data: last } = await supabase
      .from("quote_items")
      .select("position")
      .eq("quote_id", quoteId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = Math.min(200, (last?.position ?? 0) + 1);
    const { error } = await supabase.from("quote_items").insert({ ...parsed.data, quote_id: quoteId, position });
    if (error) return { values, error: dbMessage(error) };
  }
  revalidatePath(`/orcamentos/${quoteId}`);
  redirect(`/orcamentos/${quoteId}?item=salvo`);
}

export async function removeItemAction(quoteId: string, itemId: string, formData: FormData): Promise<void> {
  await requireAppUser();
  if (!uuidRe.test(quoteId) || !uuidRe.test(itemId)) redirect("/orcamentos");
  if (formData.get("confirm") !== "on") redirect(`/orcamentos/${quoteId}/itens/${itemId}?confirmar=1`);
  const supabase = await createClient();
  await supabase.from("quote_items").delete().eq("id", itemId).eq("quote_id", quoteId);
  revalidatePath(`/orcamentos/${quoteId}`);
  redirect(`/orcamentos/${quoteId}?item=removido`);
}
