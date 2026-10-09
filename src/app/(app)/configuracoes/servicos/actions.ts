"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { fieldErrors, formToObject } from "@/lib/clients/schema";
import { COMMERCIAL_STATUS_KEYS } from "@/lib/services/labels";
import { createClient } from "@/lib/supabase/server";

export type ServiceActionState = {
  ok?: string;
  /** Muda a cada sucesso: usado para limpar o formulário. */
  seq?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const decisionSchema = z.object({
  commercial_status: z.enum(COMMERCIAL_STATUS_KEYS as [string, ...string[]], { message: "Selecione a nova situação." }),
  status_basis: z.string().trim().min(10, "Descreva o fundamento (mínimo de 10 caracteres).").max(2000),
  status_reference: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : null)),
});

/** Registra decisão de situação comercial (AUDDOC005 §14). Fundamento obrigatório; histórico gravado pelo banco. */
export async function decideStatusAction(id: string, _prev: ServiceActionState, formData: FormData): Promise<ServiceActionState> {
  await requireAppUser();
  if (!uuidRe.test(id)) return { error: "Serviço inválido." };
  const values = formToObject(formData);
  const parsed = decisionSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("services").select("commercial_status").eq("id", id).maybeSingle();
  if (!current) return { error: "Serviço não encontrado." };
  if (current.commercial_status === parsed.data.commercial_status) {
    return { values, fieldErrors: { commercial_status: "Escolha uma situação diferente da atual." } };
  }

  const { error } = await supabase.from("services").update(parsed.data).eq("id", id);
  if (error) {
    const msg = error.message?.includes("inativo")
      ? "Serviço inativo no catálogo não pode ser liberado. Reative-o antes."
      : error.message?.includes("fundamento")
        ? "Informe o fundamento da decisão (mínimo de 10 caracteres)."
        : "Não foi possível registrar a decisão.";
    return { values, error: msg };
  }
  revalidatePath(`/configuracoes/servicos/${id}`);
  revalidatePath("/configuracoes/servicos");
  return { ok: "Situação comercial atualizada e registrada no histórico.", seq: Date.now() };
}

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : null));

const verificationSchema = z.object({
  docs_received: z.enum(["nao", "parcial", "sim"]),
  rt_confirmed: z.enum(["nao", "parcial", "sim", "nao_aplicavel"]),
  resources_confirmed: z.enum(["nao", "parcial", "sim", "nao_aplicavel"]),
  billing_unit_ref: opt(120),
  catalog_status: z.enum(["ativo", "inativo"]),
  audita_notes: opt(2000),
});

/** Verificação operacional (colunas J–L e observações da AUDDOC004). Não altera a situação comercial. */
export async function saveVerificationAction(id: string, _prev: ServiceActionState, formData: FormData): Promise<ServiceActionState> {
  await requireAppUser();
  if (!uuidRe.test(id)) return { error: "Serviço inválido." };
  const values = formToObject(formData);
  const parsed = verificationSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };

  const supabase = await createClient();
  const { error } = await supabase.from("services").update(parsed.data).eq("id", id);
  if (error) return { values, error: "Não foi possível salvar a verificação." };
  revalidatePath(`/configuracoes/servicos/${id}`);
  revalidatePath("/configuracoes/servicos");
  return { ok: "Verificação salva." };
}
