"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import {
  clientSchema,
  contactSchema,
  fieldErrors,
  formToObject,
  inactivationSchema,
  unitSchema,
} from "@/lib/clients/schema";
import { dbErrorMessage } from "@/lib/db-errors";
import { isProduction } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type SimilarClient = {
  id: string;
  client_code: string;
  legal_name: string;
  trade_name: string | null;
  tax_id: string | null;
  status: string;
  reason: "mesmo_documento" | "nome_semelhante";
};

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  duplicates?: SimilarClient[];
  ok?: string;
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertId(id: string) {
  if (!uuidRe.test(id)) throw new Error("Identificador inválido.");
}

// ---------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAppUser();
  const values = formToObject(formData);
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };

  const supabase = await createClient();

  // FL-01: verificar possível duplicidade antes de cadastrar
  const { data: similar, error: simError } = await supabase.rpc("find_similar_clients", {
    p_name: parsed.data.legal_name,
    p_tax_id: parsed.data.tax_id,
  });
  if (simError) return { values, error: dbErrorMessage(simError) };
  const dups = (similar ?? []) as SimilarClient[];
  if (dups.some((d) => d.reason === "mesmo_documento")) {
    return { values, duplicates: dups, error: "Já existe um cliente com este CNPJ/CPF. Use o cadastro existente." };
  }
  if (dups.length > 0 && values.confirm_not_duplicate !== "on") {
    return { values, duplicates: dups };
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.data, is_test: !isProduction })
    .select("id")
    .single();
  if (error || !data) return { values, error: dbErrorMessage(error) };

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}?criado=1`);
}

export async function updateClientAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAppUser();
  assertId(id);
  const values = formToObject(formData);
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(parsed.data).eq("id", id);
  if (error) return { values, error: dbErrorMessage(error) };

  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  redirect(`/clientes/${id}?salvo=1`);
}

export async function setClientStatusAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAppUser();
  assertId(id);
  const target = formData.get("target");
  const supabase = await createClient();

  if (target === "inativo") {
    const parsed = inactivationSchema.safeParse({ reason: formData.get("reason") });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    const { error } = await supabase
      .from("clients")
      .update({ status: "inativo", inactivation_reason: parsed.data.reason })
      .eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
  } else if (target === "ativo") {
    const { error } = await supabase.from("clients").update({ status: "ativo" }).eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
  } else {
    return { error: "Operação inválida." };
  }
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  return { ok: target === "inativo" ? "Cliente inativado. O código permanece reservado." : "Cliente reativado." };
}

// ---------------------------------------------------------------------------
// Unidades
// ---------------------------------------------------------------------------

export async function saveUnitAction(
  clientId: string,
  unitId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAppUser();
  assertId(clientId);
  if (unitId) assertId(unitId);
  const values = formToObject(formData);
  const parsed = unitSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };

  const supabase = await createClient();
  const { error } = unitId
    ? await supabase.from("client_units").update(parsed.data).eq("id", unitId).eq("client_id", clientId)
    : await supabase.from("client_units").insert({ ...parsed.data, client_id: clientId });
  if (error) return { values, error: dbErrorMessage(error) };

  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?aba=unidades&salvo=1`);
}

export async function setUnitStatusAction(clientId: string, unitId: string, target: "ativo" | "inativo") {
  await requireAppUser();
  assertId(clientId);
  assertId(unitId);
  const supabase = await createClient();
  await supabase.from("client_units").update({ status: target }).eq("id", unitId).eq("client_id", clientId);
  revalidatePath(`/clientes/${clientId}`);
}

// ---------------------------------------------------------------------------
// Contatos
// ---------------------------------------------------------------------------

export async function saveContactAction(
  clientId: string,
  contactId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAppUser();
  assertId(clientId);
  if (contactId) assertId(contactId);
  const values = formToObject(formData);
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };

  const supabase = await createClient();
  if (parsed.data.is_primary) {
    // Apenas um contato principal ativo por cliente
    let q = supabase.from("client_contacts").update({ is_primary: false }).eq("client_id", clientId).eq("is_primary", true);
    if (contactId) q = q.neq("id", contactId);
    const { error: unsetError } = await q;
    if (unsetError) return { values, error: dbErrorMessage(unsetError) };
  }

  const { error } = contactId
    ? await supabase.from("client_contacts").update(parsed.data).eq("id", contactId).eq("client_id", clientId)
    : await supabase.from("client_contacts").insert({ ...parsed.data, client_id: clientId });
  if (error) return { values, error: dbErrorMessage(error) };

  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?aba=contatos&salvo=1`);
}

export async function setContactStatusAction(clientId: string, contactId: string, target: "ativo" | "inativo") {
  await requireAppUser();
  assertId(clientId);
  assertId(contactId);
  const supabase = await createClient();
  const patch = target === "inativo" ? { status: target, is_primary: false } : { status: target };
  await supabase.from("client_contacts").update(patch).eq("id", contactId).eq("client_id", clientId);
  revalidatePath(`/clientes/${clientId}`);
}
