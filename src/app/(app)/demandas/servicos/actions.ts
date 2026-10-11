"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { fieldErrors, formToObject } from "@/lib/clients/schema";
import { buildContractDocument, type ContractModel } from "@/lib/documents/contracts";
import { renderDocx } from "@/lib/documents/render-docx";
import { renderPdf } from "@/lib/documents/render-pdf";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";
import { isProduction } from "@/lib/env";
import { MANUAL_EVENTS, parseActivities } from "@/lib/execucao/labels";
import { contractDocBase, getChangeOr404, getContractOr404, getOrderOr404 } from "@/lib/execucao/queries";
import { todaySaoPaulo } from "@/lib/format";
import { parseBR } from "@/lib/pricing/engine";
import { ADMIN_ONLY } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type ExecState = { ok?: string; seq?: number; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string>; missing?: string[] };

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : null));
const date = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.");
const money = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim())
  .transform((v, ctx) => {
    if (!v) return null;
    const p = parseBR(v);
    if (p === "invalid" || p === null || Number(p) < 0) {
      ctx.addIssue({ code: "custom", message: "Valor inválido (use 1.234,56)." });
      return z.NEVER;
    }
    return String(p);
  });

function dbMessage(error: { message?: string } | null, fallback: string, known: string[]): string {
  const m = error?.message ?? "";
  return known.some((k) => m.includes(k)) ? m : fallback;
}

// ---------------------------------------------------------------------------------------------------------------
// Serviço contratado
// ---------------------------------------------------------------------------------------------------------------
export async function createContractAction(quoteId: string): Promise<void> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(quoteId)) redirect("/orcamentos");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_service_contract", { p_quote_id: quoteId });
  if (error || !data) redirect(`/orcamentos/${quoteId}?fluxo=servico_erro`);
  revalidatePath("/demandas/servicos");
  redirect(`/demandas/servicos/${data}?criado=1`);
}

const contractSchema = z
  .object({
    modality: z.enum(["pontual", "recorrente"]),
    starts_on: date,
    ends_on: date,
    executor_name: opt(160),
    executor_role: opt(160),
    client_representative: opt(200),
    scope_summary: opt(2000),
    deliverables: opt(2000),
    additional_conditions: opt(2000),
    notes: opt(2000),
  })
  .refine((v) => !v.starts_on || !v.ends_on || v.ends_on >= v.starts_on, { path: ["ends_on"], message: "O término deve ser igual ou posterior ao início." });

export async function updateContractAction(id: string, _prev: ExecState, formData: FormData): Promise<ExecState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(id)) return { error: "Serviço inválido." };
  const values = formToObject(formData);
  const parsed = contractSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { error } = await supabase.from("service_contracts").update(parsed.data).eq("id", id);
  if (error) return { values, error: dbMessage(error, "Não foi possível salvar.", ["encerrado"]) };
  revalidatePath(`/demandas/servicos/${id}`);
  return { ok: "Dados do serviço salvos.", seq: Date.now() };
}

export async function changeContractStatusAction(id: string, _prev: ExecState, formData: FormData): Promise<ExecState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(id)) return { error: "Serviço inválido." };
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("nota") ?? "").trim().slice(0, 1000);
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_service_contract_status", { p_id: id, p_status: status, p_note: note || null });
  if (error) return { error: dbMessage(error, "Não foi possível mudar a situação.", ["motivo", "situação", "encerrado"]) };
  const c = await getContractOr404(id);
  revalidatePath(`/demandas/servicos/${id}`);
  revalidatePath(`/demandas/${c.demand_id}`);
  revalidatePath("/demandas/servicos");
  return { ok: "Situação atualizada (a demanda acompanha).", seq: Date.now() };
}

const eventSchema = z.object({
  event_type: z.enum(MANUAL_EVENTS as [string, ...string[]], { message: "Escolha o tipo." }),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
  description: z.string().trim().min(3, "Descreva o registro.").max(2000),
  channel: opt(200),
  recipient: opt(200),
});

export async function addEventAction(id: string, _prev: ExecState, formData: FormData): Promise<ExecState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(id)) return { error: "Serviço inválido." };
  const values = formToObject(formData);
  const parsed = eventSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { error } = await supabase.from("service_contract_events").insert({ contract_id: id, ...parsed.data });
  if (error) return { values, error: "Não foi possível registrar." };
  revalidatePath(`/demandas/servicos/${id}`);
  return { ok: "Registro incluído na linha do tempo.", seq: Date.now() };
}

// ---------------------------------------------------------------------------------------------------------------
// M05 — OS comercial
// ---------------------------------------------------------------------------------------------------------------
export async function createOrderAction(contractId: string): Promise<void> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(contractId)) redirect("/demandas/servicos");
  const c = await getContractOr404(contractId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_orders")
    .insert({ contract_id: contractId, executor_name: c.executor_name, executor_role: c.executor_role, is_test: c.is_test || !isProduction })
    .select("id")
    .single();
  if (error || !data) redirect(`/demandas/servicos/${contractId}?erro=os`);
  redirect(`/demandas/servicos/${contractId}/os/${data.id}?criada=1`);
}

const orderSchema = z
  .object({
    scheduled_start: date,
    scheduled_end: date,
    time_window: opt(200),
    location: opt(500),
    executor_name: opt(160),
    executor_role: opt(160),
    client_contact: opt(300),
    activities: z.string().max(6000).optional(),
    access_conditions: opt(2000),
    pending_conditions: opt(2000),
    released_by_name: opt(160),
    released_on: date,
  })
  .refine((v) => !v.scheduled_start || !v.scheduled_end || v.scheduled_end >= v.scheduled_start, { path: ["scheduled_end"], message: "O fim deve ser igual ou posterior ao início." });

export async function updateOrderAction(contractId: string, orderId: string, _prev: ExecState, formData: FormData): Promise<ExecState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(contractId) || !uuidRe.test(orderId)) return { error: "OS inválida." };
  const values = formToObject(formData);
  const parsed = orderSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const { activities, ...rest } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_orders")
    .update({ ...rest, activities: parseActivities(activities ?? "") })
    .eq("id", orderId)
    .eq("contract_id", contractId)
    .eq("status", "rascunho")
    .select("id");
  if (error || !data?.length) return { values, error: "Não foi possível salvar: só OS em rascunho podem ser alteradas." };
  revalidatePath(`/demandas/servicos/${contractId}/os/${orderId}`);
  return { ok: "OS salva.", seq: Date.now() };
}

export async function changeOrderStatusAction(contractId: string, orderId: string, _prev: ExecState, formData: FormData): Promise<ExecState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(contractId) || !uuidRe.test(orderId)) return { error: "OS inválida." };
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("nota") ?? "").trim().slice(0, 1000);
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_service_order_status", { p_id: orderId, p_status: status, p_note: note || null });
  if (error) return { error: dbMessage(error, "Não foi possível mudar a situação da OS.", ["Informe", "condicionantes", "atividade", "Somente", "concluída"]) };
  revalidatePath(`/demandas/servicos/${contractId}/os/${orderId}`);
  revalidatePath(`/demandas/servicos/${contractId}`);
  return { ok: "Situação da OS atualizada.", seq: Date.now() };
}

// ---------------------------------------------------------------------------------------------------------------
// M06 — Alteração de escopo
// ---------------------------------------------------------------------------------------------------------------
const changeSchema = z.object({
  reason: z.string().trim().min(5, "Informe o motivo da mudança.").max(1000),
  activities_before: opt(2000),
  activities_after: opt(2000),
  deadline_before: opt(300),
  deadline_after: opt(300),
  value_before: money,
  value_after: money,
  deliverables_before: opt(2000),
  deliverables_after: opt(2000),
  client_approval: opt(500),
  validated_by_name: opt(160),
  validated_on: date,
  documents_update: opt(500),
});

export async function createChangeAction(contractId: string, _prev: ExecState, formData: FormData): Promise<ExecState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(contractId)) return { error: "Serviço inválido." };
  const values = formToObject(formData);
  const parsed = changeSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const c = await getContractOr404(contractId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scope_changes")
    .insert({ contract_id: contractId, ...parsed.data, is_test: c.is_test || !isProduction })
    .select("id")
    .single();
  if (error || !data) return { values, error: dbMessage(error, "Não foi possível registrar a alteração.", ["encerrado"]) };
  redirect(`/demandas/servicos/${contractId}/alteracoes/${data.id}?criada=1`);
}

export async function updateChangeAction(contractId: string, changeId: string, _prev: ExecState, formData: FormData): Promise<ExecState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(contractId) || !uuidRe.test(changeId)) return { error: "Alteração inválida." };
  const values = formToObject(formData);
  const parsed = changeSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scope_changes")
    .update(parsed.data)
    .eq("id", changeId)
    .eq("contract_id", contractId)
    .eq("status", "rascunho")
    .select("id");
  if (error || !data?.length) return { values, error: "Não foi possível salvar: só alterações em rascunho podem ser editadas." };
  revalidatePath(`/demandas/servicos/${contractId}/alteracoes/${changeId}`);
  return { ok: "Alteração salva.", seq: Date.now() };
}

export async function changeChangeStatusAction(contractId: string, changeId: string, _prev: ExecState, formData: FormData): Promise<ExecState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(contractId) || !uuidRe.test(changeId)) return { error: "Alteração inválida." };
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("nota") ?? "").trim().slice(0, 1000);
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_scope_change_status", { p_id: changeId, p_status: status, p_note: note || null });
  if (error) return { error: dbMessage(error, "Não foi possível mudar a situação.", ["Registre", "Informe", "Somente"]) };
  revalidatePath(`/demandas/servicos/${contractId}/alteracoes/${changeId}`);
  revalidatePath(`/demandas/servicos/${contractId}`);
  return { ok: status === "aprovada" ? "Alteração aprovada e registrada na linha do tempo." : "Alteração cancelada.", seq: Date.now() };
}

// ---------------------------------------------------------------------------------------------------------------
// Geração dos documentos M03–M06 (RF-23): campos ausentes listados antes; confirmação para gerar com pendências
// ---------------------------------------------------------------------------------------------------------------
export async function generateDocumentAction(
  contractId: string,
  model: ContractModel,
  sourceId: string | null,
  _prev: ExecState,
  formData: FormData,
): Promise<ExecState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(contractId) || (sourceId && !uuidRe.test(sourceId)) || !["M03", "M04", "M05", "M06"].includes(model)) return { error: "Pedido inválido." };
  const c = await getContractOr404(contractId);
  const b = await contractDocBase(c);
  const input = {
    ...b,
    issuedOn: todaySaoPaulo(),
    test: !isProduction || c.is_test || Boolean(b.proponent?.is_test),
    ...(model === "M05" && sourceId ? { order: await getOrderOr404(contractId, sourceId) } : {}),
    ...(model === "M06" && sourceId ? { change: await getChangeOr404(contractId, sourceId) } : {}),
  };
  if ((model === "M05" && !input.order) || (model === "M06" && !input.change)) return { error: "Origem do documento não encontrada." };
  const order = "order" in input && input.order ? { ...input.order, code: input.order.order_code } : undefined;
  const change = "change" in input && input.change ? { ...input.change, code: input.change.change_code } : undefined;
  const { model: doc, missing } = buildContractDocument(model, { ...input, order, change });
  if (missing.length && formData.get("confirm") !== "on") {
    return { missing, error: `Há ${missing.length} campo(s) sem dados. Confira a lista; para gerar mesmo assim, marque a confirmação — eles sairão como [PENDENTE].` };
  }
  const [docx, pdf] = await Promise.all([renderDocx(doc), renderPdf(doc)]);
  const supabase = await createClient();
  const stamp = Date.now();
  const dir = `contratos/${contractId}/${model}`;
  const paths = { docx: `${dir}/${doc.fileBase}_${stamp}.docx`, pdf: `${dir}/${doc.fileBase}_${stamp}.pdf` };
  const up1 = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(paths.docx, docx, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false });
  const up2 = await supabase.storage.from(DOCUMENTS_BUCKET).upload(paths.pdf, pdf, { contentType: "application/pdf", upsert: false });
  if (up1.error || up2.error) return { error: "Não foi possível armazenar o documento gerado." };
  const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
  const { error } = await supabase.from("contract_documents").insert({
    contract_id: contractId,
    model,
    source_id: sourceId,
    reference: doc.reference.slice(0, 80),
    docx_path: paths.docx,
    pdf_path: paths.pdf,
    docx_sha256: sha(docx),
    pdf_sha256: sha(pdf),
    missing_fields: missing,
    watermark: doc.watermark ?? "",
    is_test: input.test,
  });
  if (error) return { error: "Não foi possível registrar o documento." };
  revalidatePath(`/demandas/servicos/${contractId}`);
  return { ok: `${model} gerado${missing.length ? ` com ${missing.length} campo(s) PENDENTE(S)` : ""}. Baixe na lista de documentos.`, seq: Date.now() };
}
