"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { fieldErrors, formToObject } from "@/lib/clients/schema";
import { extOf, LIBRARY_BUCKET, MAX_FILE_BYTES, MIME_BY_EXT, safeFileName } from "@/lib/library/labels";
import { createClient } from "@/lib/supabase/server";

export type LibState = { ok?: string; seq?: number; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const optDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Data inválida." });

const documentSchema = z
  .object({
    doc_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^AUDDOC\d{3}(-ANX\d{2})?$/, "Use o código no formato AUDDOC000 ou AUDDOC000-ANX00."),
    title: z.string().trim().min(3, "Informe o título.").max(300),
    parent_id: z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || uuidRe.test(v), { message: "Documento principal inválido." }),
    family: z.string().trim().min(2, "Informe a família (ex.: Comercial, Serviços).").max(80),
    phase: z.enum(["fase1", "fase2", "fase3"], { message: "Selecione a fase." }),
    visibility: z.enum(["interno", "externo"]).default("interno"),
    notes: optText(2000),
  })
  .superRefine((v, ctx) => {
    const annex = /-ANX\d{2}$/.test(v.doc_code);
    if (annex && !v.parent_id) ctx.addIssue({ code: "custom", path: ["parent_id"], message: "Anexo precisa do documento principal." });
    if (!annex && v.parent_id) ctx.addIssue({ code: "custom", path: ["parent_id"], message: "Somente anexos (…-ANX00) têm documento principal." });
  });

export async function createDocumentAction(_prev: LibState, formData: FormData): Promise<LibState> {
  await requireAppUser();
  const values = formToObject(formData);
  const parsed = documentSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("library_documents")
    .insert({ ...d, kind: d.parent_id ? "anexo" : "documento" })
    .select("id")
    .single();
  if (error || !data)
    return { values, error: error?.code === "23505" ? "Já existe um documento com este código." : "Não foi possível cadastrar o documento." };
  revalidatePath("/biblioteca");
  redirect(`/biblioteca/${data.id}?criado=1`);
}

const revisionMeta = z.object({
  revision: z.string().trim().regex(/^Rev\.\d{2}$/, "Use Rev.00, Rev.01…"),
  approved_by: optText(200),
  approved_on: optDate,
  issued_on: optDate,
  notes: optText(2000),
});

export type PrepareResult = { error?: string; fieldErrors?: Record<string, string>; path?: string; token?: string };

/** Passo 1 do envio: valida e gera um link de envio assinado para um caminho definido pelo servidor. */
export async function prepareUploadAction(
  documentId: string,
  input: { revision: string; fileName: string; size: number; approved_by?: string; approved_on?: string; issued_on?: string; notes?: string },
): Promise<PrepareResult> {
  await requireAppUser();
  if (!uuidRe.test(documentId)) return { error: "Documento inválido." };
  const meta = revisionMeta.safeParse(input);
  if (!meta.success) return { fieldErrors: fieldErrors(meta.error), error: "Revise os campos destacados." };
  const ext = extOf(input.fileName);
  if (!MIME_BY_EXT[ext]) return { fieldErrors: { file: "Tipo de arquivo não aceito (Word, Excel, PowerPoint, PDF ou imagem)." }, error: "Arquivo inválido." };
  if (!input.size || input.size > MAX_FILE_BYTES) return { fieldErrors: { file: "Arquivo vazio ou maior que 50 MB." }, error: "Arquivo inválido." };

  const supabase = await createClient();
  const { data: doc } = await supabase.from("library_documents").select("id, status").eq("id", documentId).maybeSingle();
  if (!doc) return { error: "Documento não encontrado." };
  if (doc.status !== "ativo") return { error: "Documento inativo não recebe novas revisões." };
  const { data: exists } = await supabase
    .from("library_revisions")
    .select("id")
    .eq("document_id", documentId)
    .eq("revision", meta.data.revision)
    .maybeSingle();
  if (exists) return { fieldErrors: { revision: `A ${meta.data.revision} já existe; revisões nunca são substituídas.` }, error: "Revisão já cadastrada." };

  const path = `library/${documentId}/rev${meta.data.revision.slice(4)}/${Date.now()}_${safeFileName(input.fileName)}`;
  const signed = await supabase.storage.from(LIBRARY_BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) return { error: "Não foi possível preparar o envio do arquivo." };
  return { path, token: signed.data.token };
}

/** Passo 2: confere o arquivo enviado (tamanho e SHA-256 calculados no servidor) e registra a revisão como rascunho. */
export async function registerRevisionAction(
  documentId: string,
  input: { path: string; fileName: string; revision: string; approved_by?: string; approved_on?: string; issued_on?: string; notes?: string },
): Promise<{ error?: string; duplicateOf?: string }> {
  await requireAppUser();
  if (!uuidRe.test(documentId)) return { error: "Documento inválido." };
  const meta = revisionMeta.safeParse(input);
  if (!meta.success) return { error: "Dados da revisão inválidos." };
  if (!input.path.startsWith(`library/${documentId}/rev${meta.data.revision.slice(4)}/`)) return { error: "Caminho de arquivo inválido." };
  const ext = extOf(input.fileName);
  const mime = MIME_BY_EXT[ext];
  if (!mime) return { error: "Tipo de arquivo não aceito." };

  const supabase = await createClient();
  const dl = await supabase.storage.from(LIBRARY_BUCKET).download(input.path);
  if (dl.error || !dl.data) return { error: "Arquivo não encontrado no armazenamento; envie novamente." };
  const buf = Buffer.from(await dl.data.arrayBuffer());
  const sha256 = createHash("sha256").update(buf).digest("hex");

  const { data: same } = await supabase.from("library_revisions").select("revision").eq("document_id", documentId).eq("sha256", sha256).limit(1);
  const { error } = await supabase.from("library_revisions").insert({
    document_id: documentId,
    revision: meta.data.revision,
    approved_by: meta.data.approved_by,
    approved_on: meta.data.approved_on,
    issued_on: meta.data.issued_on,
    notes: meta.data.notes,
    storage_path: input.path,
    original_name: input.fileName.slice(0, 255),
    mime_type: mime,
    size_bytes: buf.length,
    sha256,
  });
  if (error) return { error: error.code === "23505" ? "Esta revisão já existe." : "Não foi possível registrar a revisão." };
  revalidatePath(`/biblioteca/${documentId}`);
  revalidatePath("/biblioteca");
  return { duplicateOf: same?.[0]?.revision };
}

const approvalSchema = z.object({
  approved_by: z.string().trim().min(3, "Informe quem aprovou.").max(200),
  approved_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de aprovação."),
  issued_on: optDate,
});

/** Completa a aprovação de um rascunho e publica como vigente (a anterior vira substituída — CA-09). */
export async function publishRevisionAction(documentId: string, revisionId: string, _prev: LibState, formData: FormData): Promise<LibState> {
  await requireAppUser();
  if (!uuidRe.test(documentId) || !uuidRe.test(revisionId)) return { error: "Revisão inválida." };
  const values = formToObject(formData);
  if (values.confirm !== "on") return { values, fieldErrors: { confirm: "Confirme que o arquivo é a versão aprovada." }, error: "Confirme antes de publicar." };
  const parsed = approvalSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const upd = await supabase
    .from("library_revisions")
    .update({ approved_by: parsed.data.approved_by, approved_on: parsed.data.approved_on, issued_on: parsed.data.issued_on ?? parsed.data.approved_on })
    .eq("id", revisionId)
    .eq("document_id", documentId);
  if (upd.error) return { values, error: "Somente rascunhos podem ser publicados." };
  const { error } = await supabase.rpc("publish_library_revision", { p_revision_id: revisionId });
  if (error) return { values, error: error.message?.startsWith("Documento inativo") ? "Documento inativo não recebe revisão vigente." : "Não foi possível publicar." };
  revalidatePath(`/biblioteca/${documentId}`);
  revalidatePath("/biblioteca");
  redirect(`/biblioteca/${documentId}?publicada=1`);
}

export async function cancelRevisionAction(documentId: string, revisionId: string, _prev: LibState, formData: FormData): Promise<LibState> {
  await requireAppUser();
  if (!uuidRe.test(documentId) || !uuidRe.test(revisionId)) return { error: "Revisão inválida." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { fieldErrors: { reason: "Informe o motivo (mín. 5 caracteres)." }, error: "Informe o motivo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_library_revision", { p_revision_id: revisionId, p_reason: reason });
  if (error) return { error: "Somente rascunhos podem ser cancelados." };
  revalidatePath(`/biblioteca/${documentId}`);
  revalidatePath("/biblioteca");
  redirect(`/biblioteca/${documentId}?cancelada=1`);
}
