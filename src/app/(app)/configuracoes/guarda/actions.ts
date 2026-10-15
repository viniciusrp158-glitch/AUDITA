"use server";

import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type AnonState = { ok?: string; error?: string; seq?: number };

const uuidRe = /^[0-9a-f-]{36}$/i;

/** Anonimiza um registro com prazo de guarda vencido (caderno J4; somente o mestre — o banco confere). */
export async function anonymizeAction(kind: string, id: string, _prev: AnonState, formData: FormData): Promise<AnonState> {
  const user = await requireAppUser(ADMIN_ONLY);
  if (!user.isMaster) return { error: "Somente o usuário mestre anonimiza registros." };
  if (!uuidRe.test(id) || !["solicitacao_recusada", "convite_expirado"].includes(kind)) return { error: "Registro inválido." };
  const reason = String(formData.get("motivo") ?? "").trim().slice(0, 500);
  if (reason.length < 5) return { error: "Informe o motivo (mínimo de 5 caracteres)." };
  if (formData.get("confirm") !== "on") return { error: "Confirme que a anonimização não pode ser desfeita." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("anonymize_record", { p_kind: kind, p_id: id, p_reason: reason });
  if (error) {
    const m = error.message ?? "";
    return { error: m.includes("prazo") ? "Registro não encontrado ou ainda dentro do prazo de guarda." : m.includes("mestre") ? "Somente o usuário mestre anonimiza registros." : "Não foi possível anonimizar." };
  }
  revalidatePath("/configuracoes/guarda");
  return { ok: "Registro anonimizado e registrado na trilha de auditoria.", seq: Date.now() };
}
