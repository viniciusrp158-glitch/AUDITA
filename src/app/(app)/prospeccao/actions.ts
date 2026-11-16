"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { isProduction } from "@/lib/env";
import { todaySaoPaulo } from "@/lib/format";
import { getNiches, getReleasedServices } from "@/lib/prospect/queries";
import { isStage, OUTCOMES } from "@/lib/prospect/labels";
import { scoreCompany } from "@/lib/prospect/score";
import { createClient } from "@/lib/supabase/server";

export type ProspectState = { ok?: string; error?: string; fieldErrors?: Record<string, string> };

const uuid = z.string().uuid();
const cnpjRe = /^[0-9A-Z]{12}\d{2}$/;

function dbMessage(error: { code?: string; message?: string } | null): string {
  const m = error?.message ?? "";
  if (m.includes("não contatar")) return "Empresa na lista \"não contatar\": o contato pelo sistema está bloqueado.";
  if (m.includes("data futura")) return "A data do contato não pode ser futura. Use o próximo retorno para agendar.";
  if (m.includes("convertido em cliente")) return "Lead convertido em cliente não muda de etapa.";
  if (m.includes("leads_lost_reason")) return "Informe o motivo para marcar como perdido ou desqualificado.";
  if (m.includes("leads_client_stage")) return "Para \"Cliente conquistado\", converta o lead em cliente.";
  if (error?.code === "42501") return "Você não tem permissão para esta operação.";
  return "Não foi possível salvar. Tente novamente.";
}

/** Envia as empresas selecionadas na pesquisa ao funil, já qualificadas (RP-05, RP-06). */
export async function addLeadsAction(_prev: ProspectState, formData: FormData): Promise<ProspectState> {
  await requireAppUser(OPERATE);
  const cnpjs = [...new Set(formData.getAll("cnpj").map(String))].filter((c) => cnpjRe.test(c)).slice(0, 100);
  if (!cnpjs.length) return { error: "Selecione ao menos uma empresa." };
  const supabase = await createClient();
  const [niches, released, est] = await Promise.all([
    getNiches(),
    getReleasedServices(),
    supabase
      .from("cnpj_establishments")
      .select("cnpj, legal_name, trade_name, size_code, started_on, cnae_main, cnae_secondary, ibge_code, phone1, phone2, email, publication, ibge_municipalities(km_from_base)")
      .in("cnpj", cnpjs),
  ]);
  if (est.error) return { error: "Não foi possível ler a base de empresas." };
  const today = todaySaoPaulo();
  let added = 0;
  let skipped = 0;
  for (const e of est.data ?? []) {
    const mun = Array.isArray(e.ibge_municipalities) ? e.ibge_municipalities[0] : e.ibge_municipalities;
    const km = mun?.km_from_base == null ? null : Number(mun.km_from_base);
    const s = scoreCompany(
      { cnaeMain: e.cnae_main, cnaeSecondary: e.cnae_secondary, sizeCode: e.size_code, startedOn: e.started_on, kmFromBase: km, hasPhone: !!(e.phone1 || e.phone2), hasEmail: !!e.email },
      niches,
      released.codes,
      today,
    );
    const { error } = await supabase.from("leads").insert({
      cnpj: e.cnpj,
      legal_name: e.legal_name,
      trade_name: e.trade_name,
      cnae_main: e.cnae_main,
      size_code: e.size_code,
      ibge_code: e.ibge_code,
      niche_id: s.niche?.id ?? null,
      stage: "importado",
      score: s.score,
      score_band: s.band,
      score_detail: { items: s.items },
      score_version: s.version,
      suggested_services: s.suggestedServices,
      source: "receita",
      source_publication: e.publication,
      is_test: !isProduction,
    });
    if (error) skipped += 1;
    else added += 1;
  }
  revalidatePath("/prospeccao", "layout");
  if (!added) return { error: "Nenhuma empresa entrou no funil (já estavam no funil ou estão em \"não contatar\")." };
  return { ok: `${added} ${added === 1 ? "empresa entrou" : "empresas entraram"} no funil como "Lead importado".${skipped ? ` ${skipped} já estava(m) no funil ou em "não contatar".` : ""}` };
}

const stageSchema = z.object({
  id: uuid,
  stage: z.string().refine(isStage, "Etapa inválida."),
  lost_reason: z.string().trim().max(500).optional(),
});

export async function moveStageAction(_prev: ProspectState, formData: FormData): Promise<ProspectState> {
  await requireAppUser(OPERATE);
  const p = stageSchema.safeParse({ id: formData.get("id"), stage: formData.get("stage"), lost_reason: formData.get("lost_reason") || undefined });
  if (!p.success) return { error: "Dados inválidos." };
  if (p.data.stage === "perdido" && (p.data.lost_reason ?? "").length < 3) return { fieldErrors: { lost_reason: "Informe o motivo." }, error: "Informe o motivo para marcar como perdido." };
  if (p.data.stage === "cliente") return { error: "Use \"Converter em cliente\" para concluir." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ stage: p.data.stage, lost_reason: p.data.stage === "perdido" ? p.data.lost_reason : null })
    .eq("id", p.data.id);
  if (error) return { error: dbMessage(error) };
  revalidatePath("/prospeccao", "layout");
  return { ok: "Etapa atualizada." };
}

const OUTCOME_VALUES = OUTCOMES.map((o) => o.value) as [string, ...string[]];
const activitySchema = z
  .object({
    id: uuid,
    kind: z.enum(["whatsapp", "ligacao", "email", "reuniao", "anotacao"]),
    outcome: z.enum(OUTCOME_VALUES).optional(),
    note: z.string().trim().max(2000).optional(),
    template_code: z.string().max(60).optional(),
    next_action_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/)
      .optional(),
    next_action_note: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.kind === "anotacao" || !!v.outcome, { message: "Informe como foi o contato.", path: ["outcome"] });

/** Registra contato ou anotação e agenda o próximo retorno (RP-08, RP-09). */
export async function registerActivityAction(_prev: ProspectState, formData: FormData): Promise<ProspectState> {
  await requireAppUser(OPERATE);
  const opt = (k: string) => (formData.get(k) ? String(formData.get(k)) : undefined);
  const p = activitySchema.safeParse({
    id: formData.get("id"),
    kind: formData.get("kind"),
    outcome: opt("outcome"),
    note: opt("note"),
    template_code: opt("template_code"),
    next_action_at: opt("next_action_at"),
    next_action_note: opt("next_action_note"),
  });
  if (!p.success) {
    const fe: Record<string, string> = {};
    for (const i of p.error.issues) fe[String(i.path[0] ?? "form")] = i.message;
    return { fieldErrors: fe, error: "Revise os campos destacados." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("lead_activities").insert({
    lead_id: p.data.id,
    kind: p.data.kind,
    outcome: p.data.kind === "anotacao" ? null : p.data.outcome,
    note: p.data.note ?? null,
    template_code: p.data.template_code ?? null,
  });
  if (error) return { error: dbMessage(error) };
  if (p.data.next_action_at && p.data.outcome !== "nao_contatar") {
    const at = p.data.next_action_at.length === 10 ? `${p.data.next_action_at}T09:00` : p.data.next_action_at;
    await supabase
      .from("leads")
      .update({ next_action_at: new Date(`${at}:00-03:00`).toISOString(), next_action_note: p.data.next_action_note ?? null })
      .eq("id", p.data.id);
  }
  if (p.data.outcome === "enviado" || p.data.outcome === "sem_resposta") {
    await supabase.from("leads").update({ stage: "aguardando_retorno" }).eq("id", p.data.id).eq("stage", "primeiro_contato");
  }
  revalidatePath("/prospeccao", "layout");
  return { ok: p.data.outcome === "nao_contatar" ? "Registrado. A empresa entrou em \"não contatar\" e saiu do funil." : "Contato registrado." };
}

const phone = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v === "" || /^\d{10,13}$/.test(v), "Telefone com DDD.");
const contactSchema = z.object({
  id: uuid,
  contact_person: z.string().trim().max(120).optional(),
  phone_confirmed: phone.optional(),
  whatsapp_confirmed: phone.optional(),
  email_confirmed: z.string().trim().toLowerCase().max(254).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido.").optional(),
});

/** Contato confirmado pela pessoa (o cadastro da Receita costuma trazer o do contador). */
export async function updateContactAction(_prev: ProspectState, formData: FormData): Promise<ProspectState> {
  await requireAppUser(OPERATE);
  const p = contactSchema.safeParse(Object.fromEntries(["id", "contact_person", "phone_confirmed", "whatsapp_confirmed", "email_confirmed"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!p.success) {
    const fe: Record<string, string> = {};
    for (const i of p.error.issues) fe[String(i.path[0] ?? "form")] = i.message;
    return { fieldErrors: fe, error: "Revise os campos destacados." };
  }
  const supabase = await createClient();
  const nz = (v?: string) => (v ? v : null);
  const { error } = await supabase
    .from("leads")
    .update({
      contact_person: nz(p.data.contact_person),
      phone_confirmed: nz(p.data.phone_confirmed),
      whatsapp_confirmed: nz(p.data.whatsapp_confirmed),
      email_confirmed: nz(p.data.email_confirmed),
    })
    .eq("id", p.data.id);
  if (error) return { error: dbMessage(error) };
  revalidatePath("/prospeccao", "layout");
  return { ok: "Contato confirmado salvo." };
}

/** "Não contatar" (opt-out): registro imutável; a empresa sai do funil (RP-11). */
export async function suppressAction(_prev: ProspectState, formData: FormData): Promise<ProspectState> {
  await requireAppUser(OPERATE);
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!uuid.safeParse(id).success) return { error: "Dados inválidos." };
  if (reason.length < 3) return { fieldErrors: { reason: "Informe o motivo." }, error: "Informe o motivo." };
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("cnpj, is_test").eq("id", id).maybeSingle();
  if (!lead?.cnpj) return { error: "Lead sem CNPJ: marque como perdido com o motivo." };
  const { error } = await supabase.from("contact_suppressions").insert({ cnpj: lead.cnpj, reason: reason.slice(0, 500), is_test: lead.is_test });
  if (error) return { error: dbMessage(error) };
  revalidatePath("/prospeccao", "layout");
  redirect(`/prospeccao/leads/${id}?ok=nao-contatar`);
}
