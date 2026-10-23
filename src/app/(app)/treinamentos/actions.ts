"use server";

import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { fieldErrors, formToObject } from "@/lib/clients/schema";
import { extOf, safeFileName } from "@/lib/library/labels";
import { FILE_KINDS, isFileKind, MAX_FILE_BYTES, MIME_BY_EXT, TRAINING_BUCKET, YOUTUBE_RE, type FileKind } from "@/lib/training/labels";
import { createClient } from "@/lib/supabase/server";

export type TrState = { ok?: string; seq?: number; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optText = (max: number) => z.string().trim().max(max, `Até ${max} caracteres.`).optional().transform((v) => (v ? v : null));
const optInt = (min: number, max: number, msg: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), { message: msg })
    .transform((v) => (v === null ? null : Number(v)));

function refresh(courseId: string) {
  revalidatePath(`/treinamentos/${courseId}`);
  revalidatePath("/treinamentos");
}

/** Mensagem do banco quando é uma regra de negócio (23514/42501/22023); senão a mensagem padrão. */
function dbMessage(error: { code?: string; message?: string } | null, fallback: string): string {
  if (error && ["23514", "42501", "22023"].includes(error.code ?? "") && error.message && !/violates|permission denied/i.test(error.message)) {
    return error.message;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Novo treinamento
// ---------------------------------------------------------------------------
const createSchema = z.object({
  course_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,4}[0-9]{2,3}$/, "Use letras e números, como no material: L01, NR35A01…"),
  title: z.string().trim().min(5, "Informe o título do treinamento.").max(200),
  version_label: z.string().trim().regex(/^[0-9]{1,2}\.[0-9]{1,2}$/, "Use o formato 1.0, 1.2…"),
});

export async function createCourseAction(_prev: TrState, formData: FormData): Promise<TrState> {
  await requireAppUser(ADMIN_ONLY);
  const values = formToObject(formData);
  const parsed = createSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("training_create_course", {
    p_code: parsed.data.course_code,
    p_title: parsed.data.title,
    p_version: parsed.data.version_label,
  });
  if (error || !data)
    return { values, error: error?.code === "23505" ? "Já existe um treinamento com este código." : "Não foi possível cadastrar o treinamento." };
  revalidatePath("/treinamentos");
  redirect(`/treinamentos/${data}?criado=1`);
}

// ---------------------------------------------------------------------------
// Ficha técnica (da versão em rascunho)
// ---------------------------------------------------------------------------
const fichaSchema = z.object({
  title: z.string().trim().min(5, "Informe o título.").max(200),
  summary: optText(1000),
  modality: optText(300),
  workload_minutes: optInt(1, 60000, "Informe a carga horária em minutos (ex.: 240 para 4 h)."),
  audience: optText(2000),
  prerequisites: optText(2000),
  general_objective: optText(2000),
  methodology: optText(4000),
  assessment_rules: optText(4000),
  resources: optText(2000),
  references_text: optText(4000),
  important_notice: optText(2000),
  instructor_name: optText(200),
});

export async function updateFichaAction(courseId: string, versionId: string, _prev: TrState, formData: FormData): Promise<TrState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(versionId)) return { error: "Versão inválida." };
  const values = formToObject(formData);
  const parsed = fichaSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("training_versions").update(parsed.data).eq("id", versionId).eq("course_id", courseId).select("id");
  if (error || !data?.length) return { values, error: dbMessage(error, "Não foi possível salvar a ficha técnica.") };
  refresh(courseId);
  return { ok: "Ficha técnica salva.", seq: Date.now() };
}

// ---------------------------------------------------------------------------
// Venda: preço, prazo de acesso e situação (valem para todas as versões; podem mudar a qualquer momento)
// ---------------------------------------------------------------------------
function parsePrice(v: string): Decimal | null | "invalid" {
  const s = v.trim().replace(/^R\$\s*/i, "");
  if (!s) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(s)) return "invalid";
  return new Decimal(s.replace(/\./g, "").replace(",", "."));
}

export async function updateCommercialAction(courseId: string, _prev: TrState, formData: FormData): Promise<TrState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId)) return { error: "Treinamento inválido." };
  const values = formToObject(formData);
  const price = parsePrice(values.price ?? "");
  const errors: Record<string, string> = {};
  if (price === "invalid") errors.price = "Use o formato 197,00 (deixe vazio enquanto o preço estiver pendente).";
  const access = (values.access_days ?? "").trim();
  if (access && (!/^\d+$/.test(access) || Number(access) < 1 || Number(access) > 3650)) errors.access_days = "Informe de 1 a 3650 dias (vazio = a definir).";
  const status = values.status === "inativo" ? "inativo" : "ativo";
  const title = (values.title ?? "").trim();
  if (title.length < 5 || title.length > 200) errors.title = "Informe o título (5 a 200 caracteres).";
  if (Object.keys(errors).length) return { values, fieldErrors: errors, error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("training_courses")
    .update({
      title,
      price: price === null ? null : (price as Decimal).toFixed(2),
      access_days: access ? Number(access) : null,
      status,
      notes: (values.notes ?? "").trim() || null,
    })
    .eq("id", courseId);
  if (error) return { values, error: "Não foi possível salvar." };
  refresh(courseId);
  return { ok: "Dados de venda salvos.", seq: Date.now() };
}

// ---------------------------------------------------------------------------
// Módulos
// ---------------------------------------------------------------------------
export async function addModuleAction(courseId: string, versionId: string, _prev: TrState, formData: FormData): Promise<TrState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(versionId)) return { error: "Versão inválida." };
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 3 || title.length > 200) return { values: { title }, fieldErrors: { title: "Informe o título do módulo (3 a 200 caracteres)." }, error: "Revise o título." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("training_add_module", { p_version_id: versionId, p_title: title });
  if (error) return { values: { title }, error: dbMessage(error, "Não foi possível incluir o módulo.") };
  refresh(courseId);
  return { ok: `Módulo "${title}" incluído.`, seq: Date.now() };
}

const moduleSchema = z.object({
  title: z.string().trim().min(3, "Informe o título do módulo.").max(200),
  objective: optText(2000),
  content_summary: optText(4000),
  video_minutes: optInt(0, 600, "De 0 a 600 minutos."),
  reading_minutes: optInt(0, 600, "De 0 a 600 minutos."),
  activity_minutes: optInt(0, 600, "De 0 a 600 minutos."),
  video_url: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || YOUTUBE_RE.test(v), { message: "Cole o link do YouTube (youtube.com/watch?v=… ou youtu.be/…)." }),
});

export async function updateModuleAction(courseId: string, moduleId: string, _prev: TrState, formData: FormData): Promise<TrState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(moduleId)) return { error: "Módulo inválido." };
  const values = formToObject(formData);
  const parsed = moduleSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("training_modules").update(parsed.data).eq("id", moduleId).select("id");
  if (error || !data?.length) return { values, error: dbMessage(error, "Não foi possível salvar o módulo.") };
  refresh(courseId);
  return { ok: "Módulo salvo.", seq: Date.now() };
}

/** Troca do link da videoaula em versão publicada (única alteração permitida depois da publicação). */
export async function replaceVideoLinkAction(courseId: string, moduleId: string, _prev: TrState, formData: FormData): Promise<TrState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(moduleId)) return { error: "Módulo inválido." };
  const url = String(formData.get("video_url") ?? "").trim();
  if (!YOUTUBE_RE.test(url)) return { values: { video_url: url }, fieldErrors: { video_url: "Cole o link do YouTube (youtube.com/watch?v=… ou youtu.be/…)." } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("training_replace_video_url", { p_module_id: moduleId, p_url: url });
  if (error) return { values: { video_url: url }, error: dbMessage(error, "Não foi possível trocar o link.") };
  refresh(courseId);
  revalidatePath(`/treinamentos/${courseId}/modulo/${moduleId}`);
  return { ok: "Link da videoaula trocado. Os alunos já veem o novo vídeo.", seq: Date.now() };
}

export async function moveModuleAction(courseId: string, moduleId: string, direction: -1 | 1): Promise<{ error?: string }> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(moduleId)) return { error: "Módulo inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("training_move_module", { p_module_id: moduleId, p_direction: direction });
  if (error) return { error: dbMessage(error, "Não foi possível mover o módulo.") };
  refresh(courseId);
  return {};
}

export async function setModuleStatusAction(courseId: string, moduleId: string, status: "ativo" | "inativo"): Promise<{ error?: string }> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(moduleId)) return { error: "Módulo inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("training_modules").update({ status }).eq("id", moduleId).select("id");
  if (error || !data?.length) return { error: dbMessage(error, "Não foi possível alterar o módulo.") };
  refresh(courseId);
  return {};
}

// ---------------------------------------------------------------------------
// Arquivos (envio direto ao bucket privado por link assinado; o servidor confere e registra)
// ---------------------------------------------------------------------------
export type PrepareResult = { error?: string; path?: string; token?: string };

export async function prepareTrainingUploadAction(
  courseId: string,
  versionId: string,
  input: { kind: string; moduleId: string | null; fileName: string; size: number },
): Promise<PrepareResult> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(versionId) || (input.moduleId && !uuidRe.test(input.moduleId))) return { error: "Destino inválido." };
  if (!isFileKind(input.kind)) return { error: "Tipo de material inválido." };
  const info = FILE_KINDS[input.kind];
  if ((info.scope === "modulo") !== Boolean(input.moduleId)) return { error: "Destino inválido para este material." };
  const ext = extOf(input.fileName);
  if (!info.accept.includes(ext)) return { error: `Envie ${info.accept.map((e) => e.toUpperCase()).join(" ou ")}.` };
  if (!input.size || input.size > MAX_FILE_BYTES) return { error: "Arquivo vazio ou maior que 50 MB." };
  const supabase = await createClient();
  const { data: v } = await supabase.from("training_versions").select("id, status").eq("id", versionId).eq("course_id", courseId).maybeSingle();
  if (!v) return { error: "Versão não encontrada." };
  if (v.status !== "rascunho") return { error: "Versão publicada não recebe arquivos; crie uma nova versão." };
  const path = `training/${courseId}/${Date.now()}${Math.random().toString(36).slice(2, 8)}_${safeFileName(input.fileName)}`;
  const signed = await supabase.storage.from(TRAINING_BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) return { error: "Não foi possível preparar o envio do arquivo." };
  return { path, token: signed.data.token };
}

/** Ordem das imagens de slides pelo número no nome (L01_M02_Slide_05.png → 5). */
function slidePosition(name: string): number | null {
  const m = /(\d{1,3})\.[A-Za-z]+$/.exec(name);
  return m ? Math.max(1, Math.min(999, Number(m[1]))) : null;
}

export async function registerTrainingFileAction(
  courseId: string,
  versionId: string,
  input: { kind: string; moduleId: string | null; path: string; fileName: string },
): Promise<{ error?: string }> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(versionId) || (input.moduleId && !uuidRe.test(input.moduleId))) return { error: "Destino inválido." };
  if (!isFileKind(input.kind)) return { error: "Tipo de material inválido." };
  const kind: FileKind = input.kind;
  if (!input.path.startsWith(`training/${courseId}/`)) return { error: "Caminho de arquivo inválido." };
  const mime = MIME_BY_EXT[extOf(input.fileName)];
  if (!mime || !FILE_KINDS[kind].accept.includes(extOf(input.fileName))) return { error: "Tipo de arquivo não aceito." };

  const supabase = await createClient();
  const dl = await supabase.storage.from(TRAINING_BUCKET).download(input.path);
  if (dl.error || !dl.data) return { error: "Arquivo não encontrado no armazenamento; envie novamente." };
  const buf = Buffer.from(await dl.data.arrayBuffer());
  const sha256 = createHash("sha256").update(buf).digest("hex");

  let position = 1;
  if (FILE_KINDS[kind].multiple) {
    const fromName = slidePosition(input.fileName);
    if (fromName) position = fromName;
    else {
      const { data: last } = await supabase
        .from("training_files")
        .select("position")
        .eq("version_id", versionId)
        .eq("module_id", input.moduleId!)
        .eq("kind", kind)
        .eq("status", "ativo")
        .order("position", { ascending: false })
        .limit(1);
      position = (last?.[0]?.position ?? 0) + 1;
    }
  } else {
    // Troca: o arquivo anterior do mesmo tipo fica como "removido" (nunca é apagado)
    let prev = supabase.from("training_files").update({ status: "removido" }).eq("version_id", versionId).eq("kind", kind).eq("status", "ativo");
    prev = input.moduleId ? prev.eq("module_id", input.moduleId) : prev.is("module_id", null);
    const { error: prevErr } = await prev;
    if (prevErr) return { error: dbMessage(prevErr, "Não foi possível substituir o arquivo anterior.") };
  }

  const { error } = await supabase.from("training_files").insert({
    version_id: versionId,
    module_id: input.moduleId,
    kind,
    position,
    storage_path: input.path,
    original_name: input.fileName.slice(0, 255),
    mime_type: mime,
    size_bytes: buf.length,
    sha256,
  });
  if (error) return { error: dbMessage(error, "Não foi possível registrar o arquivo.") };
  refresh(courseId);
  return {};
}

export async function removeFileAction(courseId: string, fileId: string): Promise<{ error?: string }> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(fileId)) return { error: "Arquivo inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("training_files").update({ status: "removido" }).eq("id", fileId).select("id");
  if (error || !data?.length) return { error: dbMessage(error, "Não foi possível remover o arquivo.") };
  refresh(courseId);
  return {};
}

// ---------------------------------------------------------------------------
// Versões
// ---------------------------------------------------------------------------
export async function publishVersionAction(courseId: string, versionId: string, _prev: TrState, formData: FormData): Promise<TrState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(versionId)) return { error: "Versão inválida." };
  if (formData.get("confirm") !== "on") return { fieldErrors: { confirm: "Confirme que os materiais foram revisados." }, error: "Confirme antes de publicar." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("training_publish_version", { p_version_id: versionId });
  if (error) return { error: dbMessage(error, "Não foi possível publicar a versão.") };
  refresh(courseId);
  redirect(`/treinamentos/${courseId}?aba=versoes&publicada=1`);
}

export async function cancelVersionAction(courseId: string, versionId: string, _prev: TrState, formData: FormData): Promise<TrState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(versionId)) return { error: "Versão inválida." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { fieldErrors: { reason: "Informe o motivo (mín. 5 caracteres)." }, error: "Informe o motivo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("training_cancel_version", { p_version_id: versionId, p_reason: reason });
  if (error) return { error: dbMessage(error, "Não foi possível cancelar o rascunho.") };
  refresh(courseId);
  redirect(`/treinamentos/${courseId}?aba=versoes&cancelada=1`);
}

export async function newVersionAction(courseId: string, _prev: TrState, formData: FormData): Promise<TrState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId)) return { error: "Treinamento inválido." };
  const label = String(formData.get("version_label") ?? "").trim();
  if (!/^[0-9]{1,2}\.[0-9]{1,2}$/.test(label)) return { values: { version_label: label }, fieldErrors: { version_label: "Use o formato 1.3, 2.0…" }, error: "Revise o número da versão." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("training_new_version", { p_course_id: courseId, p_label: label });
  if (error)
    return { values: { version_label: label }, error: error.code === "23505" ? "Esta versão já existe." : dbMessage(error, "Não foi possível criar a versão.") };
  refresh(courseId);
  redirect(`/treinamentos/${courseId}?aba=modulos&nova=1`);
}

// ---------------------------------------------------------------------------
// Alunos e matrículas (a conta e o convite são feitos pela função "alunos", com a chave privilegiada só no Supabase)
// ---------------------------------------------------------------------------
export type EnrollResult = { email: string; nome: string; situacao: "convidado" | "conta_existente" | "ja_matriculado" | "erro"; mensagem?: string };

async function callAlunos(body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { status: 401, data: { erro: "Sessão expirada. Entre novamente." } };
  const { data, error } = await supabase.functions.invoke("alunos", { body, headers: { Authorization: `Bearer ${session.access_token}` } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    try {
      const payload = ctx ? await ctx.json() : null;
      return { status: ctx?.status ?? 500, data: payload ?? { erro: "Falha ao falar com o serviço de alunos." } };
    } catch {
      return { status: 500, data: { erro: "Falha ao falar com o serviço de alunos." } };
    }
  }
  return { status: 200, data: (data ?? {}) as Record<string, unknown> };
}

const accessDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Data inválida." });

export async function enrollStudentsAction(
  courseId: string,
  input: { alunos: { nome: string; email: string; cpf?: string; empresa?: string; telefone?: string }[]; acesso_ate?: string; origem: "gestao" | "lote" | "cortesia" },
): Promise<{ error?: string; resultados?: EnrollResult[] }> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId)) return { error: "Treinamento inválido." };
  const date = accessDate.safeParse(input.acesso_ate);
  if (!date.success) return { error: "Data de acesso inválida." };
  if (!input.alunos.length) return { error: "Informe pelo menos um aluno." };
  if (input.alunos.length > 500) return { error: "No máximo 500 alunos por envio; divida a planilha." };
  const r = await callAlunos({ acao: "matricular", curso_id: courseId, acesso_ate: date.data, origem: input.origem, alunos: input.alunos });
  if (r.status !== 200) return { error: String(r.data.erro ?? "Não foi possível matricular.") };
  refresh(courseId);
  return { resultados: (r.data.resultados as EnrollResult[]) ?? [] };
}

export async function enrollmentInviteStatus(courseId: string): Promise<Record<string, { senha_criada: boolean; ultimo_acesso: string | null }>> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId)) return {};
  const r = await callAlunos({ acao: "situacao", curso_id: courseId });
  return r.status === 200 ? ((r.data.situacao as Record<string, { senha_criada: boolean; ultimo_acesso: string | null }>) ?? {}) : {};
}

export async function resendInviteAction(courseId: string, studentId: string): Promise<{ error?: string; ok?: string }> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(studentId)) return { error: "Aluno inválido." };
  const r = await callAlunos({ acao: "reenviar", aluno_id: studentId });
  if (r.status !== 200) return { error: String(r.data.erro ?? "Não foi possível reenviar o convite.") };
  return { ok: "Convite reenviado." };
}

export async function updateEnrollmentAction(
  courseId: string,
  enrollmentId: string,
  change: { status?: "ativa" | "suspensa" | "cancelada"; access_until?: string | null; note?: string },
): Promise<{ error?: string }> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(enrollmentId)) return { error: "Matrícula inválida." };
  const patch: Record<string, unknown> = {};
  if (change.status) {
    if (change.status === "cancelada" && (change.note ?? "").trim().length < 5) return { error: "Informe o motivo do cancelamento (mín. 5 caracteres)." };
    patch.status = change.status;
    if (change.note) patch.status_note = change.note.trim().slice(0, 1000);
  }
  if (change.access_until !== undefined) {
    if (change.access_until && !/^\d{4}-\d{2}-\d{2}$/.test(change.access_until)) return { error: "Data inválida." };
    patch.access_until = change.access_until || null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("training_enrollments").update(patch).eq("id", enrollmentId).eq("course_id", courseId).select("id");
  if (error || !data?.length) {
    const msg = error?.code === "23514" && error.message.includes("data") ? "O prazo não pode ser anterior ao início." : dbMessage(error, "Não foi possível alterar a matrícula.");
    return { error: msg };
  }
  refresh(courseId);
  return {};
}
