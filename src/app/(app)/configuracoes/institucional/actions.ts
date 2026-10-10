"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { fieldErrors, formToObject } from "@/lib/clients/schema";
import { isProduction } from "@/lib/env";
import { ALL_FIELDS, institutionalSchema } from "@/lib/institutional";
import { ADMIN_ONLY } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type InstitutionalState = {
  ok?: string;
  seq?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COPY_KEYS = [...ALL_FIELDS.map((f) => f.key), "show_technical_lead", "full_address_on_proposal", "notes"] as const;

/** Nova versão em rascunho, copiando a vigente (ou vazia). Em desenvolvimento, marcada como teste. */
export async function createInstitutionalDraftAction(): Promise<void> {
  await requireAppUser(ADMIN_ONLY);
  const supabase = await createClient();
  const { data: vigente } = await supabase.from("institutional_profiles").select("*").eq("status", "vigente").maybeSingle();
  const copy = Object.fromEntries(COPY_KEYS.map((k) => [k, vigente?.[k] ?? null]));
  const { data, error } = await supabase
    .from("institutional_profiles")
    .insert({
      ...copy,
      show_technical_lead: Boolean(vigente?.show_technical_lead),
      full_address_on_proposal: vigente ? Boolean(vigente.full_address_on_proposal) : true,
      is_test: !isProduction,
    })
    .select("id")
    .single();
  if (error || !data) redirect("/configuracoes/institucional?erro=1");
  revalidatePath("/configuracoes/institucional");
  redirect(`/configuracoes/institucional/${data.id}`);
}

export async function updateInstitutionalAction(id: string, _prev: InstitutionalState, formData: FormData): Promise<InstitutionalState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(id)) return { error: "Versão inválida." };
  const values = formToObject(formData);
  const parsed = institutionalSchema.safeParse({
    ...Object.fromEntries(COPY_KEYS.map((k) => [k, values[k] ?? ""])),
    show_technical_lead: values.show_technical_lead ?? "",
    full_address_on_proposal: values.full_address_on_proposal ?? "",
  });
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("institutional_profiles")
    .update(parsed.data)
    .eq("id", id)
    .eq("status", "rascunho")
    .select("id");
  if (error || !data?.length) {
    return {
      values,
      error: error?.code === "23514" ? "Algum dado não passou na validação do banco. Revise os campos." : "Não foi possível salvar: só rascunhos podem ser alterados.",
    };
  }
  revalidatePath(`/configuracoes/institucional/${id}`);
  revalidatePath("/configuracoes/institucional");
  return { ok: "Rascunho salvo.", seq: Date.now() };
}

export async function publishInstitutionalAction(id: string, _prev: InstitutionalState, formData: FormData): Promise<InstitutionalState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(id)) return { error: "Versão inválida." };
  if (formData.get("confirm") !== "on") {
    return { fieldErrors: { confirm: "Confirme que os dados conferem com os documentos oficiais." }, error: "Confirme antes de publicar." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_institutional_profile", { p_id: id });
  if (error) return { error: error.message?.includes("Somente rascunhos") ? "Esta versão já foi publicada." : "Não foi possível publicar." };
  revalidatePath("/configuracoes/institucional");
  revalidatePath(`/configuracoes/institucional/${id}`);
  redirect(`/configuracoes/institucional/${id}?publicada=1`);
}
