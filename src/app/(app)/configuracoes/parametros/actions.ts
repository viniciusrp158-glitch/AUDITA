"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { fieldErrors, formToObject } from "@/lib/clients/schema";
import { isProduction } from "@/lib/env";
import { PARAM_FIELDS } from "@/lib/pricing/labels";
import { getVigenteParameterSet } from "@/lib/pricing/queries";
import { parameterSetSchema } from "@/lib/pricing/schema";
import { createClient } from "@/lib/supabase/server";

export type ParamActionState = {
  ok?: string;
  seq?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nova versão em rascunho, copiando a vigente (ou vazia, se ainda não houver). */
export async function createParameterDraftAction(): Promise<void> {
  await requireAppUser();
  const supabase = await createClient();
  const vigente = await getVigenteParameterSet();
  const copy = Object.fromEntries(PARAM_FIELDS.map((f) => [f.key, vigente?.[f.key] ?? null]));
  const { data, error } = await supabase
    .from("pricing_parameter_sets")
    .insert({
      ...copy,
      label: vigente ? `Revisão da versão ${vigente.version}` : "Parâmetros iniciais",
      reference_date: null,
      is_test: !isProduction,
    })
    .select("id")
    .single();
  if (error || !data) redirect("/configuracoes/parametros?erro=1");
  revalidatePath("/configuracoes/parametros");
  redirect(`/configuracoes/parametros/${data.id}`);
}

export async function updateParameterSetAction(id: string, _prev: ParamActionState, formData: FormData): Promise<ParamActionState> {
  await requireAppUser();
  if (!uuidRe.test(id)) return { error: "Versão inválida." };
  const values = formToObject(formData);
  const parsed = parameterSetSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { error } = await supabase.from("pricing_parameter_sets").update(parsed.data).eq("id", id).eq("status", "rascunho");
  if (error) {
    return {
      values,
      error: error.code === "42501" ? "Parâmetros publicados não podem ser alterados; crie uma nova versão." : "Não foi possível salvar.",
    };
  }
  revalidatePath(`/configuracoes/parametros/${id}`);
  revalidatePath("/configuracoes/parametros");
  return { ok: "Rascunho salvo.", seq: Date.now() };
}

export async function publishParameterSetAction(id: string, _prev: ParamActionState, formData: FormData): Promise<ParamActionState> {
  await requireAppUser();
  if (!uuidRe.test(id)) return { error: "Versão inválida." };
  if (formData.get("confirm") !== "on") {
    return { fieldErrors: { confirm: "Confirme a validação dos valores." }, error: "Confirme antes de publicar." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_parameter_set", { p_id: id });
  if (error) return { error: error.message?.includes("Somente rascunhos") ? "Esta versão já foi publicada." : "Não foi possível publicar." };
  revalidatePath("/configuracoes/parametros");
  revalidatePath(`/configuracoes/parametros/${id}`);
  revalidatePath("/orcamentos");
  redirect(`/configuracoes/parametros/${id}?publicada=1`);
}
