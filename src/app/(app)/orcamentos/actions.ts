"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { fieldErrors, formToObject } from "@/lib/clients/schema";
import { isProduction } from "@/lib/env";
import { buildDocument } from "@/lib/documents/proposal";
import { renderDocx } from "@/lib/documents/render-docx";
import { renderPdf } from "@/lib/documents/render-pdf";
import { buildResults, verifySnapshot, type QuoteSnapshot } from "@/lib/documents/snapshot";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";
import { todaySaoPaulo } from "@/lib/format";
import { getEmissionBlockers, getQuoteOr404, getVigenteParameterSet, getVigenteTemplate } from "@/lib/pricing/queries";
import { acceptanceSchema, quoteHeaderSchema, quoteItemSchema, reasonSchema, refusalSchema } from "@/lib/pricing/schema";
import { createClient } from "@/lib/supabase/server";

export type QuoteActionState = {
  ok?: string;
  seq?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dbMessage(error: { code?: string; message?: string } | null): string {
  const m = error?.message ?? "";
  if (m.includes("rascunho")) return "Somente cotações em rascunho podem ser alteradas.";
  if (m.includes("versão vigente")) return "A cotação só pode adotar a versão vigente dos parâmetros.";
  if (m.includes("não recebe cotação")) return "Demanda encerrada, não viável ou cancelada não recebe cotação.";
  if (error?.code === "23505") return "Esta demanda já possui cotação.";
  if (error?.code === "42501") return "Você não tem permissão para esta operação.";
  return "Não foi possível salvar. Tente novamente.";
}

/** Cria a cotação da demanda (uma por demanda), já com a versão vigente dos parâmetros e um item do serviço da demanda. */
export async function createQuoteAction(demandId: string): Promise<void> {
  await requireAppUser();
  if (!uuidRe.test(demandId)) redirect("/demandas");
  const supabase = await createClient();
  const existing = await supabase.from("quotes").select("id").eq("demand_id", demandId).maybeSingle();
  if (existing.data) redirect(`/orcamentos/${existing.data.id}`);

  const { data: demand } = await supabase
    .from("demands")
    .select("id, is_test, is_recurring, service_id, services(name, scope_preliminary, scope_limits, modality)")
    .eq("id", demandId)
    .maybeSingle();
  if (!demand) redirect("/demandas");
  const vigente = await getVigenteParameterSet();
  // Campos do modelo pré-preenchidos com o catálogo (AUDDOC010 "Preenchimento e automação"); revisáveis antes da emissão
  const cat = demand.services as unknown as { scope_preliminary: string | null; scope_limits: string | null; modality: string | null } | null;
  const { data, error } = await supabase
    .from("quotes")
    .insert({
      demand_id: demandId,
      parameter_set_id: vigente?.id ?? null,
      is_test: demand.is_test || !isProduction,
      scope_included: cat?.scope_preliminary?.slice(0, 4000) ?? null,
      scope_excluded: cat?.scope_limits?.slice(0, 4000) ?? null,
      location_modality: cat?.modality?.slice(0, 1000) ?? null,
    })
    .select("id")
    .single();
  if (error || !data) redirect(`/demandas/${demandId}?erro_cotacao=${error?.message?.includes("não recebe cotação") ? "encerrada" : "1"}`);

  const svc = demand.services as unknown as { name: string } | null;
  if (demand.service_id && svc) {
    await supabase.from("quote_items").insert({
      quote_id: data.id,
      position: 1,
      service_id: demand.service_id,
      description: svc.name.slice(0, 300),
      periodicity: demand.is_recurring ? "mensal" : "unica",
    });
  }
  revalidatePath(`/demandas/${demandId}`);
  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${data.id}?criada=1`);
}

export async function updateQuoteHeaderAction(id: string, _prev: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  await requireAppUser();
  if (!uuidRe.test(id)) return { error: "Cotação inválida." };
  const values = formToObject(formData);
  const parsed = quoteHeaderSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update(parsed.data).eq("id", id);
  if (error) return { values, error: dbMessage(error) };
  revalidatePath(`/orcamentos/${id}`);
  return { ok: "Conteúdo da proposta salvo.", seq: Date.now() };
}

/** Passa a cotação (rascunho) para a versão vigente atual dos parâmetros. */
export async function adoptVigenteAction(id: string): Promise<void> {
  await requireAppUser();
  if (!uuidRe.test(id)) redirect("/orcamentos");
  const vigente = await getVigenteParameterSet();
  if (vigente) {
    const supabase = await createClient();
    await supabase.from("quotes").update({ parameter_set_id: vigente.id }).eq("id", id);
  }
  revalidatePath(`/orcamentos/${id}`);
  redirect(`/orcamentos/${id}`);
}

export async function saveItemAction(
  quoteId: string,
  itemId: string | null,
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  await requireAppUser();
  if (!uuidRe.test(quoteId) || (itemId !== null && !uuidRe.test(itemId))) return { error: "Item inválido." };
  const values = formToObject(formData);
  const parsed = quoteItemSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };

  const supabase = await createClient();
  if (itemId) {
    const { error } = await supabase.from("quote_items").update(parsed.data).eq("id", itemId).eq("quote_id", quoteId);
    if (error) return { values, error: dbMessage(error) };
  } else {
    const { data: last } = await supabase
      .from("quote_items")
      .select("position")
      .eq("quote_id", quoteId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = Math.min(200, (last?.position ?? 0) + 1);
    const { error } = await supabase.from("quote_items").insert({ ...parsed.data, quote_id: quoteId, position });
    if (error) return { values, error: dbMessage(error) };
  }
  revalidatePath(`/orcamentos/${quoteId}`);
  redirect(`/orcamentos/${quoteId}?item=salvo`);
}

export async function removeItemAction(quoteId: string, itemId: string, formData: FormData): Promise<void> {
  await requireAppUser();
  if (!uuidRe.test(quoteId) || !uuidRe.test(itemId)) redirect("/orcamentos");
  if (formData.get("confirm") !== "on") redirect(`/orcamentos/${quoteId}/itens/${itemId}?confirmar=1`);
  const supabase = await createClient();
  await supabase.from("quote_items").delete().eq("id", itemId).eq("quote_id", quoteId);
  revalidatePath(`/orcamentos/${quoteId}`);
  redirect(`/orcamentos/${quoteId}?item=removido`);
}

// ---------------------------------------------------------------------------
// I6 — revisão, emissão, reabertura e decisão do cliente
// ---------------------------------------------------------------------------

export type FlowState = QuoteActionState & { details?: string[] };

/** Mensagem legível a partir de um erro do fluxo no banco (pendências separadas por " | "). */
function flowError(error: { message?: string } | null, fallback: string): { error: string; details?: string[] } {
  const m = error?.message ?? "";
  if (m.startsWith("Pendências para concluir") || m.startsWith("Emissão bloqueada")) {
    const idx = m.indexOf(": ");
    return { error: m.slice(0, idx + 1), details: m.slice(idx + 2).split(" | ") };
  }
  const known = [
    "Informe o motivo",
    "Todos os itens precisam",
    "Os resultados não correspondem",
    "Resultados calculados com outra versão",
    "Somente",
    "Data do aceite inválida",
    "Informe quem aceitou",
    "Documento de teste exige",
    "Esta cotação não pode",
  ];
  return { error: known.some((k) => m.startsWith(k)) ? m : fallback };
}

export async function reviewQuoteAction(quoteId: string, _prev: FlowState, formData: FormData): Promise<FlowState> {
  await requireAppUser();
  if (!uuidRe.test(quoteId)) return { error: "Cotação inválida." };
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const { quote, items } = await getQuoteOr404(quoteId);
  const ps = quote.pricing_parameter_sets;
  if (!ps) return { error: "Nenhuma versão de parâmetros financeiros adotada." };
  const { results, allReady } = buildResults(ps.id, ps, items.map((i) => ({ ...i, services: i.services })));
  if (!allReady) return { error: "Todos os itens precisam estar PRONTO PARA ANÁLISE INTERNA antes da revisão." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("freeze_quote_revision", { p_quote_id: quoteId, p_results: results, p_reason: reason });
  if (error) return { ...flowError(error, "Não foi possível concluir a revisão."), values: { reason: reason ?? "" } };
  revalidatePath(`/orcamentos/${quoteId}`);
  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${quoteId}?fluxo=revisada`);
}

/** Gera DOCX e PDF a partir do snapshot congelado, guarda no bucket privado e registra a emissão (RF-15, RF-16, RF-17, RF-24). */
export async function emitRevisionAction(quoteId: string, _prev: FlowState): Promise<FlowState> {
  await requireAppUser();
  if (!uuidRe.test(quoteId)) return { error: "Cotação inválida." };
  const supabase = await createClient();
  const { quote } = await getQuoteOr404(quoteId);
  if (quote.status !== "revisada" || !quote.current_revision_id) return { error: "Conclua a revisão antes de emitir." };

  const { data: rev } = await supabase
    .from("quote_revisions")
    .select("id, revision_number, snapshot, is_test")
    .eq("id", quote.current_revision_id)
    .single();
  if (!rev) return { error: "Revisão não encontrada." };

  const blockers = await getEmissionBlockers(rev.id);
  if (blockers.length) return { error: "Emissão bloqueada:", details: blockers };

  const snap = rev.snapshot as QuoteSnapshot;
  const integrity = verifySnapshot(snap);
  if (integrity.length) return { error: "A conferência do snapshot falhou; a emissão foi interrompida.", details: integrity };

  const template = await getVigenteTemplate(snap.quote.model === "ANX02" ? "AUDDOC010-ANX02" : "AUDDOC010-ANX01");
  if (!template) return { error: "Modelo técnico vigente não encontrado." };

  // RF-17: ambiente ou dados de teste ⇒ marca d'água obrigatória
  const watermark = !isProduction || Boolean(rev.is_test) || snap.client.is_test || snap.parameters.is_test;
  const model = buildDocument(snap, {
    issuedOn: todaySaoPaulo(),
    watermark,
    templateRevision: template.document_revision,
    technicalVersion: template.technical_version,
  });
  const [docx, pdf] = await Promise.all([renderDocx(model), renderPdf(model)]);

  const stamp = Date.now();
  const dir = `quotes/${quoteId}/r${String(rev.revision_number).padStart(2, "0")}`;
  const files = [
    { kind: "docx" as const, buf: docx, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    { kind: "pdf" as const, buf: pdf, type: "application/pdf" },
  ];
  const docs: { kind: string; file_name: string; storage_path: string; size_bytes: number; sha256: string }[] = [];
  for (const f of files) {
    const path = `${dir}/${model.fileBase}_${stamp}.${f.kind}`;
    const up = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, f.buf, { contentType: f.type, upsert: false });
    if (up.error) return { error: "Não foi possível armazenar o documento gerado." };
    docs.push({
      kind: f.kind,
      file_name: `${model.fileBase}.${f.kind}`,
      storage_path: path,
      size_bytes: f.buf.length,
      sha256: createHash("sha256").update(f.buf).digest("hex"),
    });
  }

  const { error } = await supabase.rpc("register_emission", {
    p_revision_id: rev.id,
    p_template_id: template.id,
    p_watermark: watermark,
    p_docs: docs,
  });
  if (error) return flowError(error, "Não foi possível registrar a emissão.");
  revalidatePath(`/orcamentos/${quoteId}`);
  revalidatePath(`/demandas/${quote.demand_id}`);
  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${quoteId}?fluxo=emitida`);
}

export async function reopenQuoteAction(quoteId: string, _prev: FlowState, formData: FormData): Promise<FlowState> {
  await requireAppUser();
  if (!uuidRe.test(quoteId)) return { error: "Cotação inválida." };
  const values = formToObject(formData);
  const parsed = reasonSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Informe o motivo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_quote", { p_quote_id: quoteId, p_reason: parsed.data.reason });
  if (error) return { values, ...flowError(error, "Não foi possível reabrir a cotação.") };
  revalidatePath(`/orcamentos/${quoteId}`);
  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${quoteId}?fluxo=reaberta`);
}

export async function decideQuoteAction(
  quoteId: string,
  decision: "aceita" | "recusada" | "cancelada",
  _prev: FlowState,
  formData: FormData,
): Promise<FlowState> {
  await requireAppUser();
  if (!uuidRe.test(quoteId)) return { error: "Cotação inválida." };
  const values = formToObject(formData);
  let args: { p_date: string | null; p_name: string | null; p_reference: string | null; p_note: string | null };
  if (decision === "aceita") {
    const parsed = acceptanceSchema.safeParse(values);
    if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
    args = {
      p_date: parsed.data.accepted_on,
      p_name: parsed.data.accepted_by_name,
      p_reference: parsed.data.decision_reference,
      p_note: parsed.data.decision_note,
    };
  } else {
    const parsed = refusalSchema.safeParse(values);
    if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
    args = { p_date: null, p_name: null, p_reference: parsed.data.decision_reference, p_note: parsed.data.decision_note };
  }
  const supabase = await createClient();
  const { data: q } = await supabase.from("quotes").select("demand_id").eq("id", quoteId).single();
  const { error } = await supabase.rpc("register_quote_decision", { p_quote_id: quoteId, p_decision: decision, ...args });
  if (error) return { values, ...flowError(error, "Não foi possível registrar a decisão.") };
  revalidatePath(`/orcamentos/${quoteId}`);
  if (q) revalidatePath(`/demandas/${q.demand_id}`);
  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${quoteId}?fluxo=${decision}`);
}
