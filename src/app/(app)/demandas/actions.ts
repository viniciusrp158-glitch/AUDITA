"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { fieldErrors, formToObject } from "@/lib/clients/schema";
import { demandSchema, eventSchema, statusChangeSchema } from "@/lib/demands/schema";
import { isProduction } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type DemandActionState = {
  ok?: string;
  seq?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

export type ClientLinks = {
  units: { id: string; name: string }[];
  contacts: { id: string; label: string }[];
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dbMessage(error: { code?: string; message?: string } | null): string {
  const m = error?.message ?? "";
  if (m.includes("unidade informada")) return "A unidade informada não pertence a este cliente.";
  if (m.includes("contato informado")) return "O contato informado não pertence a este cliente.";
  if (m.includes("Cliente inativo")) return "Cliente inativo: reative o cadastro antes de registrar a demanda.";
  if (m.includes("demands_due_after_received")) return "O prazo não pode ser anterior ao recebimento.";
  if (error?.code === "42501") return "Você não tem permissão para esta operação.";
  return "Não foi possível salvar. Tente novamente.";
}

/** Unidades e contatos ativos do cliente selecionado (para o formulário). */
export async function loadClientLinksAction(clientId: string): Promise<ClientLinks> {
  await requireAppUser(OPERATE);
  if (!uuidRe.test(clientId)) return { units: [], contacts: [] };
  const supabase = await createClient();
  const [units, contacts] = await Promise.all([
    supabase.from("client_units").select("id, name").eq("client_id", clientId).eq("status", "ativo").order("name"),
    supabase
      .from("client_contacts")
      .select("id, full_name, role_title, is_primary")
      .eq("client_id", clientId)
      .eq("status", "ativo")
      .order("is_primary", { ascending: false })
      .order("full_name"),
  ]);
  return {
    units: (units.data ?? []).map((u) => ({ id: u.id, name: u.name })),
    contacts: (contacts.data ?? []).map((c) => ({
      id: c.id,
      label: `${c.full_name}${c.role_title ? ` — ${c.role_title}` : ""}${c.is_primary ? " (principal)" : ""}`,
    })),
  };
}

export async function createDemandAction(_prev: DemandActionState, formData: FormData): Promise<DemandActionState> {
  await requireAppUser(OPERATE);
  const values = formToObject(formData);
  const parsed = demandSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("demands")
    .insert({ ...parsed.data, is_test: !isProduction })
    .select("id")
    .single();
  if (error || !data) return { values, error: dbMessage(error) };

  revalidatePath("/demandas");
  revalidatePath(`/clientes/${parsed.data.client_id}`);
  redirect(`/demandas/${data.id}?criada=1`);
}

export async function updateDemandAction(id: string, _prev: DemandActionState, formData: FormData): Promise<DemandActionState> {
  await requireAppUser(OPERATE);
  if (!uuidRe.test(id)) return { error: "Demanda inválida." };
  const values = formToObject(formData);
  const parsed = demandSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };

  const supabase = await createClient();
  const { error } = await supabase.from("demands").update(parsed.data).eq("id", id);
  if (error) return { values, error: dbMessage(error) };

  revalidatePath("/demandas");
  revalidatePath(`/demandas/${id}`);
  redirect(`/demandas/${id}?salva=1`);
}

export async function changeStatusAction(id: string, _prev: DemandActionState, formData: FormData): Promise<DemandActionState> {
  await requireAppUser(OPERATE);
  if (!uuidRe.test(id)) return { error: "Demanda inválida." };
  const values = formToObject(formData);
  const parsed = statusChangeSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_demand_status", {
    p_demand_id: id,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
  });
  if (error) {
    const msg = error.message?.includes("já está nesta situação")
      ? "A demanda já está nesta situação."
      : error.message?.includes("motivo")
        ? "Informe o motivo para cancelar ou marcar como não viável."
        : "Não foi possível alterar a situação.";
    return { values, error: msg };
  }
  revalidatePath("/demandas");
  revalidatePath(`/demandas/${id}`);
  return { ok: "Situação atualizada.", seq: Date.now() };
}

export async function addEventAction(id: string, _prev: DemandActionState, formData: FormData): Promise<DemandActionState> {
  await requireAppUser(OPERATE);
  if (!uuidRe.test(id)) return { error: "Demanda inválida." };
  const values = formToObject(formData);
  const parsed = eventSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };

  const supabase = await createClient();
  const { error } = await supabase.from("demand_events").insert({ demand_id: id, ...parsed.data });
  if (error) return { values, error: "Não foi possível registrar o acompanhamento." };
  revalidatePath(`/demandas/${id}`);
  return { ok: "Acompanhamento registrado.", seq: Date.now() };
}
