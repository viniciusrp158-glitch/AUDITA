"use server";

/**
 * Modo prospecção (AUDDOC020 Rev.01, RP-21/RP-22): a empresa da carteira entra no funil no momento do primeiro contato,
 * o contato fica registrado com o resultado em um toque e o próximo retorno é agendado sozinho.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { todaySaoPaulo } from "@/lib/format";
import { isProduction } from "@/lib/env";
import { ensureLeadFromBase } from "@/lib/prospect/add-leads";
import { blockReason, getEmailQuota, getSender, sendPresentation, syncBounces } from "@/lib/prospect/email-send";
import { companyDisplayName } from "@/lib/prospect/messages";
import { DAILY_GOAL, OUTCOMES } from "@/lib/prospect/labels";
import { createClient } from "@/lib/supabase/server";

export type QuickState = { ok?: string; error?: string; celebrate?: boolean };

const cnpjRe = /^[0-9A-Z]{12}\d{2}$/;
const OUTCOME_VALUES = OUTCOMES.map((o) => o.value) as [string, ...string[]];

/** Dias úteis de espera até o próximo retorno, por resultado do contato (retorno às 9h). */
const FOLLOW_UP: Record<string, { days: number; note: string } | undefined> = {
  enviado: { days: 2, note: "Cobrar resposta da mensagem" },
  sem_resposta: { days: 2, note: "Tentar de novo (outro canal ou horário)" },
  nao_atendeu: { days: 1, note: "Ligar de novo" },
  interesse: { days: 1, note: "Entender a necessidade e marcar conversa" },
  retornar_depois: { days: 7, note: "Retornar como combinado" },
};

/** Soma dias úteis (sem sábado e domingo) a uma data AAAA-MM-DD. */
function addBusinessDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) left -= 1;
  }
  return d.toISOString().slice(0, 10);
}

const ensureLead = ensureLeadFromBase;

const quickSchema = z.object({
  cnpj: z.string().regex(cnpjRe),
  kind: z.enum(["whatsapp", "ligacao", "email"]),
  outcome: z.enum(OUTCOME_VALUES),
  group: z.enum(["quente", "morno", "frio", "precisa_contato"]).optional(),
  score: z.number().int().min(0).max(100).optional(),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""))
    .refine((v) => v === "" || /^\d{10,11}$/.test(v), "Telefone com DDD.")
    .optional(),
});

export async function quickContactAction(input: { cnpj: string; kind: string; outcome: string; phone?: string; group?: string; score?: number }): Promise<QuickState> {
  const user = await requireAppUser(OPERATE);
  const p = quickSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Dados inválidos." };
  const lead = await ensureLead(p.data.cnpj, p.data.group && p.data.score !== undefined ? { group: p.data.group, score: p.data.score } : undefined);
  if ("error" in lead) return lead;
  const supabase = await createClient();
  if (p.data.phone) {
    const mobile = /^\d{2}9\d{8}$/.test(p.data.phone);
    await supabase.from("leads").update({ phone_confirmed: p.data.phone, ...(mobile && { whatsapp_confirmed: p.data.phone }) }).eq("id", lead.id);
  }
  const { error } = await supabase.from("lead_activities").insert({
    lead_id: lead.id,
    kind: p.data.kind,
    outcome: p.data.outcome,
    template_code: p.data.kind === "whatsapp" ? "whatsapp_padrao_diretor" : p.data.kind === "email" ? "email_texto" : null,
  });
  if (error) return { error: error.message.includes("não contatar") ? "Empresa na lista \"não contatar\"." : "Não foi possível registrar o contato." };
  const f = FOLLOW_UP[p.data.outcome];
  if (f) {
    const day = addBusinessDays(todaySaoPaulo(), f.days);
    await supabase.from("leads").update({ next_action_at: new Date(`${day}T09:00:00-03:00`).toISOString(), next_action_note: f.note }).eq("id", lead.id);
  }
  if (p.data.outcome === "enviado" || p.data.outcome === "sem_resposta" || p.data.outcome === "nao_atendeu") {
    await supabase.from("leads").update({ stage: "aguardando_retorno" }).eq("id", lead.id).eq("stage", "primeiro_contato");
  }
  revalidatePath("/prospeccao", "layout");
  if (p.data.outcome === "nao_contatar") return { ok: "Registrado em \"não contatar\"." };
  // Progresso do dia (meta de contatos por dia útil — decisão do Diretor de 19/11/2026)
  const { count } = await supabase
    .from("lead_activities")
    .select("id", { count: "exact", head: true })
    .eq("created_by", user.id)
    .in("kind", ["whatsapp", "ligacao", "email"])
    .gte("occurred_at", new Date(`${todaySaoPaulo()}T00:00:00-03:00`).toISOString());
  const n = count ?? 0;
  if (p.data.outcome === "reuniao_marcada") return { ok: `🎉 Reunião marcada! Excelente. (${n} de ${DAILY_GOAL} contatos hoje)`, celebrate: true };
  if (p.data.outcome === "interesse") return { ok: `🙌 Respondeu com interesse! Retorno agendado para o próximo dia útil. (${n} de ${DAILY_GOAL} hoje)`, celebrate: true };
  if (n === DAILY_GOAL) return { ok: `🔥 Meta do dia batida: ${DAILY_GOAL} contatos! Tudo o que vier agora é bônus.`, celebrate: true };
  return { ok: `Contato registrado (${n} de ${DAILY_GOAL} hoje). Próxima empresa!` };
}

/** "Não é para nós": a empresa sai da carteira e fica no funil como perdida, com o motivo (auditável). */
export async function discardAction(input: { cnpj: string; reason: string }): Promise<QuickState> {
  await requireAppUser(OPERATE);
  if (!cnpjRe.test(input.cnpj)) return { error: "Dados inválidos." };
  const reason = String(input.reason ?? "").trim().slice(0, 200);
  if (reason.length < 3) return { error: "Diga em poucas palavras por que não é para nós." };
  const lead = await ensureLead(input.cnpj);
  if ("error" in lead) return lead;
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ stage: "perdido", lost_reason: `Triagem: ${reason}` }).eq("id", lead.id);
  if (error) return { error: "Não foi possível descartar." };
  revalidatePath("/prospeccao", "layout");
  return { ok: "Empresa descartada." };
}

/** "É da contabilidade" (RP-22): o contato deixa de valer como da empresa em toda a carteira. */
export async function markAccountingAction(input: { cnpj: string; kind: "phone" | "email" }): Promise<QuickState> {
  await requireAppUser(OPERATE);
  if (!cnpjRe.test(input.cnpj) || (input.kind !== "phone" && input.kind !== "email")) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { data: e } = await supabase.from("cnpj_establishments").select("phone1, email").eq("cnpj", input.cnpj).maybeSingle();
  const value = input.kind === "phone" ? e?.phone1 : e?.email?.toLowerCase();
  if (!value) return { error: "Não há esse contato no cadastro." };
  const { error } = await supabase.from("prospect_contact_marks").insert({ kind: input.kind, value, is_test: !isProduction });
  if (error && !error.message.includes("duplicate")) return { error: "Não foi possível marcar." };
  revalidatePath("/prospeccao", "layout");
  return { ok: input.kind === "phone" ? "Telefone marcado como da contabilidade em todas as empresas." : "E-mail marcado como da contabilidade em todas as empresas." };
}

// ---------------------------------------------------------------------------------------------------------------------
// E-mail de apresentação pelo sistema (Brevo) — individual (cartão) e em lote (grupo), AUDDOC020 Rev.01 RP-09
// ---------------------------------------------------------------------------------------------------------------------

async function registerEmailContact(leadId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lead_activities").insert({ lead_id: leadId, kind: "email", outcome: "enviado", template_code: "email_apresentacao" });
  if (error) return false;
  const day = addBusinessDays(todaySaoPaulo(), 2);
  await supabase.from("leads").update({ next_action_at: new Date(`${day}T09:00:00-03:00`).toISOString(), next_action_note: "Cobrar resposta do e-mail de apresentação" }).eq("id", leadId);
  await supabase.from("leads").update({ stage: "aguardando_retorno" }).eq("id", leadId).eq("stage", "primeiro_contato");
  return true;
}

async function suppressed(cnpj: string, email: string) {
  const supabase = await createClient();
  // Duas consultas simples (o e-mail pode ter caracteres que quebrariam um filtro "or")
  const [a, b] = await Promise.all([
    supabase.from("contact_suppressions").select("id").eq("cnpj", cnpj).limit(1),
    supabase.from("contact_suppressions").select("id").eq("email", email.toLowerCase()).limit(1),
  ]);
  return (a.data ?? []).length > 0 || (b.data ?? []).length > 0;
}

async function emailTarget(cnpj: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("prospect_portfolio")
    .select("cnpj, legal_name, trade_name, email, own_email, group_code, score, prospect_niches(code)")
    .eq("cnpj", cnpj)
    .maybeSingle();
  return data as unknown as {
    cnpj: string;
    legal_name: string;
    trade_name: string | null;
    email: string | null;
    own_email: boolean;
    group_code: string;
    score: number;
    prospect_niches: { code: string } | null;
  } | null;
}

/** Cartão: envia o e-mail de apresentação para esta empresa. */
export async function sendEmailAction(input: { cnpj: string; group?: string; score?: number }): Promise<QuickState> {
  const user = await requireAppUser(OPERATE);
  if (!cnpjRe.test(input.cnpj)) return { error: "Dados inválidos." };
  const q = await getEmailQuota();
  const block = blockReason(q);
  if (block) return { error: block };
  const sender = await getSender();
  if (!sender) return { error: "A chave do e-mail não pôde ser aberta no servidor. Revise a configuração." };
  const t = await emailTarget(input.cnpj);
  if (!t?.email) return { error: "Esta empresa não tem e-mail cadastrado." };
  if (await suppressed(t.cnpj, t.email)) return { error: "Empresa ou e-mail na lista \"não contatar\"." };
  const lead = await ensureLeadFromBase(t.cnpj, { group: t.group_code, score: t.score });
  if ("error" in lead) return lead;
  const r = await sendPresentation({
    sender,
    leadId: lead.id,
    cnpj: t.cnpj,
    email: t.email,
    company: companyDisplayName(t.trade_name, t.legal_name),
    nicheCode: t.prospect_niches?.code ?? null,
    userName: user.fullName.split(" ")[0],
    batch: false,
  });
  if (!r.ok) return { error: r.error };
  await registerEmailContact(lead.id);
  revalidatePath("/prospeccao", "layout");
  return { ok: r.status === "simulado" ? "E-mail simulado (ambiente de testes: nada foi enviado). Próxima empresa!" : "📧 E-mail de apresentação enviado. Próxima empresa!" };
}

/** Lote: envia aos próximos do grupo que têm e-mail próprio, até o limite do dia. Exige a validação jurídica. */
export async function sendBatchAction(input: { group: string; max: number }): Promise<QuickState> {
  const user = await requireAppUser(OPERATE);
  if (!["quente", "morno", "frio"].includes(input.group)) return { error: "Grupo inválido." };
  const sender = await getSender();
  if (sender) await syncBounces(sender.apiKey);
  const q = await getEmailQuota();
  const block = blockReason(q, { batch: true });
  if (block) return { error: block };
  if (!sender) return { error: "A chave do e-mail não pôde ser aberta no servidor. Revise a configuração." };
  const left = Math.min(Math.max(1, Math.floor(input.max) || 1), q!.daily_limit - q!.sent_today, 100);
  const supabase = await createClient();
  const { data } = await supabase.rpc("prospect_opportunities", { p_group: input.group, p_limit: 200, p_offset: 0 });
  const niches = new Map(((await supabase.from("prospect_niches").select("id, code")).data ?? []).map((n) => [n.id as string, n.code as string]));
  const candidates = ((data ?? []) as { cnpj: string; legal_name: string; trade_name: string | null; email: string | null; own_email: boolean; niche_id: string; score: number }[]).filter(
    (c) => c.own_email && c.email,
  );
  let sent = 0;
  let simulated = 0;
  let failed = 0;
  for (const c of candidates) {
    if (sent + simulated >= left) break;
    if (await suppressed(c.cnpj, c.email!)) continue;
    const lead = await ensureLeadFromBase(c.cnpj, { group: input.group, score: c.score });
    if ("error" in lead) continue;
    const r = await sendPresentation({
      sender,
      leadId: lead.id,
      cnpj: c.cnpj,
      email: c.email!,
      company: companyDisplayName(c.trade_name, c.legal_name),
      nicheCode: niches.get(c.niche_id) ?? null,
      userName: user.fullName.split(" ")[0],
      batch: true,
    });
    if (!r.ok) {
      failed += 1;
      if (failed >= 3) break; // algo errado na configuração: para o lote
      continue;
    }
    await registerEmailContact(lead.id);
    if (r.status === "simulado") simulated += 1;
    else sent += 1;
  }
  revalidatePath("/prospeccao", "layout");
  if (!sent && !simulated) return { error: failed ? "O Brevo recusou os envios. Confira a configuração do e-mail." : "Nenhuma empresa deste grupo com e-mail próprio para enviar agora." };
  return {
    ok: simulated
      ? `${simulated} e-mail(s) simulado(s) (ambiente de testes: nada foi enviado).`
      : `📧 ${sent} e-mail(s) de apresentação enviado(s)${failed ? `; ${failed} falharam` : ""}.`,
    celebrate: sent > 0,
  };
}
