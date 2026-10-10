"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { clientSchema, fieldErrors, formToObject, inactivationSchema } from "@/lib/clients/schema";
import { dbErrorMessage } from "@/lib/db-errors";
import { isProduction } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, SimilarClient } from "../actions";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aprova a solicitação: cria cliente (código CLI), unidades e contatos numa única transação. */
export async function approveRequestAction(requestId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(requestId)) return { error: "Solicitação inválida." };
  const values = formToObject(formData);
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };

  const supabase = await createClient();
  const { data: similar, error: simError } = await supabase.rpc("find_similar_clients", {
    p_name: parsed.data.legal_name,
    p_tax_id: parsed.data.tax_id,
  });
  if (simError) return { values, error: dbErrorMessage(simError) };
  const dups = (similar ?? []) as SimilarClient[];
  if (dups.some((d) => d.reason === "mesmo_documento")) {
    return {
      values,
      duplicates: dups,
      error: "Já existe um cliente com este CNPJ/CPF. Recuse a solicitação (informando o motivo) e atualize o cadastro existente, se necessário.",
    };
  }
  if (dups.length > 0 && values.confirm_not_duplicate !== "on") return { values, duplicates: dups };

  const { data: clientId, error } = await supabase.rpc("approve_registration", {
    p_request_id: requestId,
    p_client: parsed.data,
    p_is_test: !isProduction,
  });
  if (error || !clientId) {
    return { values, error: error?.message?.includes("já analisada") ? "Esta solicitação já foi analisada." : dbErrorMessage(error) };
  }

  revalidatePath("/clientes");
  revalidatePath("/clientes/solicitacoes");
  redirect(`/clientes/${clientId}?criado=1`);
}

export async function rejectRequestAction(requestId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(requestId)) return { error: "Solicitação inválida." };
  const parsed = inactivationSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_registration_requests")
    .update({ status: "recusada", review_note: parsed.data.reason })
    .eq("id", requestId)
    .eq("status", "pendente");
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/clientes/solicitacoes");
  redirect(`/clientes/solicitacoes/${requestId}?recusada=1`);
}
