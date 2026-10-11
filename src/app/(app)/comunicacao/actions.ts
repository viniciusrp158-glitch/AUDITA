"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { fieldErrors, formToObject } from "@/lib/clients/schema";
import { BRAND_KEYS, CHANNELS, REVIEW_CHECKLIST, TEMPLATE_KEYS, type AssetVariant } from "@/lib/comunicacao/labels";
import { BRAND_BUCKET } from "@/lib/comunicacao/queries";
import { pngSize } from "@/lib/comunicacao/png";
import { isProduction } from "@/lib/env";
import { safeFileName } from "@/lib/library/labels";
import { ADMIN_ONLY, COMMUNICATE } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type CommState = { ok?: string; seq?: number; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : null));
const optId = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || uuidRe.test(v), "Seleção inválida.");
const check = z.preprocess((v) => v === "on" || v === true, z.boolean());

// ---------------------------------------------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------------------------------------------
const briefingSchema = z.object({
  template: z.enum(TEMPLATE_KEYS as [string, ...string[]], { message: "Escolha o modelo." }),
  brand: z.enum(BRAND_KEYS as [string, ...string[]], { message: "Escolha a marca." }),
  theme: z.string().trim().min(3, "Informe o tema.").max(160),
  objective: opt(500),
  audience: opt(300),
  channel: z.enum(Object.keys(CHANNELS) as [string, ...string[]], { message: "Escolha o canal." }),
  service_id: optId,
  campaign_id: optId,
});

export async function createPieceAction(_prev: CommState, formData: FormData): Promise<CommState> {
  await requireAppUser(COMMUNICATE);
  const values = formToObject(formData);
  const parsed = briefingSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comm_pieces")
    .insert({ ...parsed.data, is_test: !isProduction })
    .select("id")
    .single();
  if (error || !data) return { values, error: "Não foi possível criar a peça." };
  revalidatePath("/comunicacao");
  redirect(`/comunicacao/pecas/${data.id}?criada=1`);
}

const contentSchema = briefingSchema.extend({
  title: opt(90),
  subtitle: opt(160),
  body: opt(700),
  cta: opt(60),
  caption: opt(2200),
  show_slogan: check,
  show_contacts: check,
});

export async function updatePieceAction(id: string, _prev: CommState, formData: FormData): Promise<CommState> {
  await requireAppUser(COMMUNICATE);
  if (!uuidRe.test(id)) return { error: "Peça inválida." };
  const values = formToObject(formData);
  const parsed = contentSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("comm_pieces").update(parsed.data).eq("id", id).eq("status", "rascunho").select("id");
  if (error || !data?.length) return { values, error: "Não foi possível salvar: só rascunhos podem ser alterados." };
  revalidatePath(`/comunicacao/pecas/${id}`);
  revalidatePath("/comunicacao");
  return { ok: "Rascunho salvo. A prévia foi atualizada.", seq: Date.now() };
}

export async function submitPieceAction(id: string): Promise<CommState> {
  await requireAppUser(COMMUNICATE);
  if (!uuidRe.test(id)) return { error: "Peça inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_comm_piece", { p_piece_id: id });
  if (error) return { error: error.message?.includes("título") ? "Informe o título e salve antes de enviar." : "Não foi possível enviar para revisão." };
  revalidatePath(`/comunicacao/pecas/${id}`);
  revalidatePath("/comunicacao");
  redirect(`/comunicacao/pecas/${id}?enviada=1`);
}

const KNOWN_REVIEW_ERRORS = ["Confirme todos", "Logo oficial", "liberado comercialmente", "Contatos oficiais", "Informe o que precisa"];

export async function reviewPieceAction(pieceId: string, versionId: string, _prev: CommState, formData: FormData): Promise<CommState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(pieceId) || !uuidRe.test(versionId)) return { error: "Versão inválida." };
  const decision = String(formData.get("decisao") ?? "");
  const note = String(formData.get("nota") ?? "").trim().slice(0, 1000);
  const checklist = Object.fromEntries(REVIEW_CHECKLIST.map((c) => [c.key, formData.get(`check_${c.key}`) === "on"]));
  if (!["aprovar", "devolver"].includes(decision)) return { error: "Escolha aprovar ou devolver." };
  if (decision === "devolver" && note.length < 5) return { fieldErrors: { nota: "Explique o que precisa ser corrigido." }, error: "Informe o motivo da devolução." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_comm_piece", { p_version_id: versionId, p_decision: decision, p_note: note || null, p_checklist: checklist });
  if (error) {
    const known = KNOWN_REVIEW_ERRORS.find((k) => error.message?.includes(k));
    return { error: known ? error.message : "Não foi possível registrar a revisão." };
  }
  revalidatePath(`/comunicacao/pecas/${pieceId}`);
  revalidatePath("/comunicacao");
  redirect(`/comunicacao/pecas/${pieceId}?${decision === "aprovar" ? "aprovada" : "devolvida"}=1`);
}

export async function reopenPieceAction(id: string, _prev: CommState, formData: FormData): Promise<CommState> {
  await requireAppUser(COMMUNICATE);
  if (!uuidRe.test(id)) return { error: "Peça inválida." };
  const reason = String(formData.get("motivo") ?? "").trim();
  if (reason.length < 5) return { fieldErrors: { motivo: "Informe o motivo (mín. 5 caracteres)." }, error: "Informe o motivo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_comm_piece", { p_piece_id: id, p_reason: reason });
  if (error) return { error: "Somente peças aprovadas podem ser reabertas." };
  revalidatePath(`/comunicacao/pecas/${id}`);
  redirect(`/comunicacao/pecas/${id}?reaberta=1`);
}

export async function cancelPieceAction(id: string, _prev: CommState, formData: FormData): Promise<CommState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(id)) return { error: "Peça inválida." };
  const reason = String(formData.get("motivo") ?? "").trim();
  if (reason.length < 5) return { fieldErrors: { motivo: "Informe o motivo (mín. 5 caracteres)." }, error: "Informe o motivo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_comm_piece", { p_piece_id: id, p_reason: reason });
  if (error) return { error: "Não foi possível cancelar a peça." };
  revalidatePath(`/comunicacao/pecas/${id}`);
  revalidatePath("/comunicacao");
  redirect(`/comunicacao/pecas/${id}?cancelada=1`);
}

// ---------------------------------------------------------------------------------------------------------------
// Campanhas
// ---------------------------------------------------------------------------------------------------------------
const dateOpt = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.");
const campaignSchema = z
  .object({
    name: z.string().trim().min(3, "Informe o nome da campanha.").max(160),
    objective: opt(1000),
    audience: opt(300),
    starts_on: dateOpt,
    ends_on: dateOpt,
    status: z.enum(["planejada", "ativa", "encerrada", "cancelada"]).default("planejada"),
    notes: opt(2000),
  })
  .refine((v) => !v.starts_on || !v.ends_on || v.ends_on >= v.starts_on, { path: ["ends_on"], message: "O fim deve ser igual ou posterior ao início." });

export async function createCampaignAction(_prev: CommState, formData: FormData): Promise<CommState> {
  await requireAppUser(COMMUNICATE);
  const values = formToObject(formData);
  const parsed = campaignSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comm_campaigns")
    .insert({ ...parsed.data, is_test: !isProduction })
    .select("id")
    .single();
  if (error || !data) return { values, error: "Não foi possível criar a campanha." };
  revalidatePath("/comunicacao/campanhas");
  redirect(`/comunicacao/campanhas/${data.id}?criada=1`);
}

export async function updateCampaignAction(id: string, _prev: CommState, formData: FormData): Promise<CommState> {
  await requireAppUser(COMMUNICATE);
  if (!uuidRe.test(id)) return { error: "Campanha inválida." };
  const values = formToObject(formData);
  const parsed = campaignSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { error } = await supabase.from("comm_campaigns").update(parsed.data).eq("id", id);
  if (error) return { values, error: "Não foi possível salvar a campanha." };
  revalidatePath(`/comunicacao/campanhas/${id}`);
  revalidatePath("/comunicacao/campanhas");
  return { ok: "Campanha salva.", seq: Date.now() };
}

// ---------------------------------------------------------------------------------------------------------------
// Biblioteca de marca (somente o administrador envia e aprova)
// ---------------------------------------------------------------------------------------------------------------
const VARIANTS = ["original_png", "png_transparente", "vetor", "pdf_vetorial", "aplicacao", "outro"] as const;
const assetSchema = z.object({
  brand: z.enum(BRAND_KEYS as [string, ...string[]], { message: "Escolha a marca." }),
  variant: z.enum(VARIANTS, { message: "Escolha o tipo de arquivo." }),
  title: z.string().trim().min(3, "Informe o nome do ativo.").max(160),
  notes: opt(2000),
});

export async function createAssetAction(_prev: CommState, formData: FormData): Promise<CommState> {
  await requireAppUser(ADMIN_ONLY);
  const values = formToObject(formData);
  const parsed = assetSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("brand_assets").insert(parsed.data).select("id").single();
  if (error || !data) return { values, error: error?.code === "23505" ? "Já existe um ativo com esta marca, tipo e nome." : "Não foi possível cadastrar o ativo." };
  revalidatePath("/comunicacao/marca");
  redirect(`/comunicacao/marca/${data.id}?criado=1`);
}

const MIME_BY_EXT: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", pdf: "application/pdf" };
const MAX_BRAND_BYTES = 20 * 1024 * 1024;
const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();

const MIME_FOR_VARIANT: Record<AssetVariant, string[]> = {
  original_png: ["image/png"],
  png_transparente: ["image/png"],
  vetor: ["image/svg+xml"],
  pdf_vetorial: ["application/pdf"],
  aplicacao: ["image/png", "image/jpeg", "application/pdf"],
  outro: ["image/png", "image/jpeg", "image/svg+xml", "application/pdf"],
};

export type BrandPrepare = { error?: string; fieldErrors?: Record<string, string>; path?: string; token?: string };

/** Passo 1: valida e gera um link de envio assinado para um caminho definido pelo servidor. */
export async function prepareBrandUploadAction(assetId: string, input: { fileName: string; size: number; source_note: string }): Promise<BrandPrepare> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(assetId)) return { error: "Ativo inválido." };
  if ((input.source_note ?? "").trim().length < 5)
    return { fieldErrors: { source_note: "Informe a origem do arquivo (ex.: arquivo oficial fornecido pela AUDITA)." }, error: "Informe a origem." };
  const supabase = await createClient();
  const { data: asset } = await supabase.from("brand_assets").select("id, variant, status").eq("id", assetId).maybeSingle();
  if (!asset) return { error: "Ativo não encontrado." };
  if (asset.status !== "ativo") return { error: "Ativo inativo não recebe novas versões." };
  const mime = MIME_BY_EXT[extOf(input.fileName)];
  if (!mime || !MIME_FOR_VARIANT[asset.variant as AssetVariant].includes(mime))
    return { fieldErrors: { file: "Tipo de arquivo não aceito para este ativo." }, error: "Arquivo inválido." };
  if (!input.size || input.size > MAX_BRAND_BYTES) return { fieldErrors: { file: "Arquivo vazio ou maior que 20 MB." }, error: "Arquivo inválido." };
  const path = `marca/${assetId}/${Date.now()}_${safeFileName(input.fileName)}`;
  const signed = await supabase.storage.from(BRAND_BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) return { error: "Não foi possível preparar o envio do arquivo." };
  return { path, token: signed.data.token };
}

/** Passo 2: confere o arquivo no servidor (tipo real, tamanho, SHA-256 e dimensões) e registra a versão como rascunho. */
export async function registerBrandVersionAction(
  assetId: string,
  input: { path: string; fileName: string; source_note: string },
): Promise<{ error?: string; duplicateOf?: number }> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(assetId) || !input.path.startsWith(`marca/${assetId}/`)) return { error: "Caminho de arquivo inválido." };
  const mime = MIME_BY_EXT[extOf(input.fileName)];
  if (!mime) return { error: "Tipo de arquivo não aceito." };
  const supabase = await createClient();
  const dl = await supabase.storage.from(BRAND_BUCKET).download(input.path);
  if (dl.error || !dl.data) return { error: "Arquivo não encontrado no armazenamento; envie novamente." };
  const buf = Buffer.from(await dl.data.arrayBuffer());
  const size = mime === "image/png" ? pngSize(buf) : null;
  if (mime === "image/png" && !size) return { error: "O arquivo não é um PNG válido." };
  if (mime === "application/pdf" && buf.subarray(0, 5).toString() !== "%PDF-") return { error: "O arquivo não é um PDF válido." };
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const { data: same } = await supabase.from("brand_asset_versions").select("version").eq("asset_id", assetId).eq("sha256", sha256).limit(1);
  const { error } = await supabase.from("brand_asset_versions").insert({
    asset_id: assetId,
    storage_path: input.path,
    original_name: input.fileName.slice(0, 255),
    mime_type: mime,
    size_bytes: buf.length,
    sha256,
    width: size?.width ?? null,
    height: size?.height ?? null,
    source_note: input.source_note.trim().slice(0, 500),
    is_test: !isProduction,
  });
  if (error) return { error: "Não foi possível registrar a versão." };
  revalidatePath(`/comunicacao/marca/${assetId}`);
  revalidatePath("/comunicacao/marca");
  return { duplicateOf: same?.[0]?.version };
}

export async function approveBrandVersionAction(assetId: string, versionId: string, _prev: CommState, formData: FormData): Promise<CommState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(assetId) || !uuidRe.test(versionId)) return { error: "Versão inválida." };
  if (formData.get("confirm") !== "on")
    return { fieldErrors: { confirm: "Confirme a conferência com o arquivo oficial." }, error: "Confirme antes de aprovar." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_brand_asset_version", { p_id: versionId, p_note: String(formData.get("nota") ?? "").slice(0, 500) || null });
  if (error) return { error: error.message?.includes("inativo") ? "Ativo inativo não recebe versão aprovada." : "Somente versões aguardando aprovação podem ser aprovadas." };
  revalidatePath(`/comunicacao/marca/${assetId}`);
  revalidatePath("/comunicacao/marca");
  redirect(`/comunicacao/marca/${assetId}?aprovada=1`);
}

export async function cancelBrandVersionAction(assetId: string, versionId: string, _prev: CommState, formData: FormData): Promise<CommState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(assetId) || !uuidRe.test(versionId)) return { error: "Versão inválida." };
  const reason = String(formData.get("motivo") ?? "").trim();
  if (reason.length < 5) return { fieldErrors: { motivo: "Informe o motivo (mín. 5 caracteres)." }, error: "Informe o motivo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_brand_asset_version", { p_id: versionId, p_reason: reason });
  if (error) return { error: "Somente versões aguardando aprovação podem ser canceladas." };
  revalidatePath(`/comunicacao/marca/${assetId}`);
  redirect(`/comunicacao/marca/${assetId}?cancelada=1`);
}

export async function setAssetStatusAction(assetId: string, status: "ativo" | "inativo"): Promise<void> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(assetId)) return;
  const supabase = await createClient();
  await supabase.from("brand_assets").update({ status }).eq("id", assetId);
  revalidatePath(`/comunicacao/marca/${assetId}`);
  revalidatePath("/comunicacao/marca");
}
