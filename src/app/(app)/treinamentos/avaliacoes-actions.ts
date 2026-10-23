"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { fieldErrors, formToObject } from "@/lib/clients/schema";
import { parseGabarito, type ParsedQuestion } from "@/lib/training/gabarito";
import { TRAINING_BUCKET } from "@/lib/training/labels";
import { pdfToText } from "@/lib/training/pdf-text";
import { createClient } from "@/lib/supabase/server";
import type { TrState } from "./actions";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refresh(courseId: string) {
  revalidatePath(`/treinamentos/${courseId}`, "layout");
}

function dbMessage(error: { code?: string; message?: string } | null, fallback: string): string {
  if (error && ["23514", "42501", "22023", "23505"].includes(error.code ?? "") && error.message && !/violates|permission denied/i.test(error.message)) {
    return error.message;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Leitura dos gabaritos (o servidor lê o PDF "Gabarito comentado" já enviado no módulo)
// ---------------------------------------------------------------------------
export type GabaritoReading = {
  moduleId: string;
  position: number;
  title: string;
  fileName: string | null;
  questions: ParsedQuestion[];
  warnings: string[];
  passScore: number | null;
};

async function readModuleGabarito(moduleId: string): Promise<GabaritoReading> {
  const supabase = await createClient();
  const { data: m } = await supabase.from("training_modules").select("id, position, title").eq("id", moduleId).maybeSingle();
  if (!m) return { moduleId, position: 0, title: "", fileName: null, questions: [], warnings: ["Módulo não encontrado."], passScore: null };
  const base = { moduleId, position: m.position as number, title: m.title as string, passScore: null };
  const { data: f } = await supabase
    .from("training_files")
    .select("storage_path, original_name")
    .eq("module_id", moduleId)
    .eq("kind", "gabarito")
    .eq("status", "ativo")
    .maybeSingle();
  if (!f) return { ...base, fileName: null, questions: [], warnings: ["Envie o “Gabarito comentado” do módulo (material do instrutor) para ler as questões."] };
  const { data: blob, error } = await supabase.storage.from(TRAINING_BUCKET).download(f.storage_path);
  if (error || !blob) return { ...base, fileName: f.original_name, questions: [], warnings: ["Não foi possível abrir o gabarito no armazenamento."] };
  let text: string;
  try {
    text = await pdfToText(new Uint8Array(await blob.arrayBuffer()));
  } catch {
    return { ...base, fileName: f.original_name, questions: [], warnings: ["Não foi possível ler o texto do PDF do gabarito."] };
  }
  return { ...base, fileName: f.original_name, ...parseGabarito(text, base.position) };
}

async function activeModules(versionId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("training_modules").select("id").eq("version_id", versionId).eq("status", "ativo").order("position");
  return (data ?? []).map((r) => r.id as string);
}

/** Conferência antes de gravar: lê os gabaritos de um módulo ou de todos os módulos ativos da versão. */
export async function readGabaritosAction(courseId: string, scope: { moduleId?: string; versionId?: string }): Promise<{ error?: string; readings?: GabaritoReading[] }> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId)) return { error: "Treinamento inválido." };
  let ids: string[] = [];
  if (scope.moduleId && uuidRe.test(scope.moduleId)) ids = [scope.moduleId];
  else if (scope.versionId && uuidRe.test(scope.versionId)) ids = await activeModules(scope.versionId);
  if (!ids.length) return { error: "Nenhum módulo para ler." };
  const readings: GabaritoReading[] = [];
  for (const id of ids) readings.push(await readModuleGabarito(id));
  return { readings };
}

/** Grava as questões lidas (lê de novo no servidor; nada vem do navegador). Módulos sem questões ficam de fora. */
export async function importGabaritosAction(courseId: string, moduleIds: string[]): Promise<{ error?: string; ok?: string }> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !moduleIds.length || moduleIds.some((id) => !uuidRe.test(id))) return { error: "Seleção inválida." };
  const supabase = await createClient();
  let total = 0;
  let mods = 0;
  for (const id of moduleIds) {
    const r = await readModuleGabarito(id);
    if (!r.questions.length) continue;
    const { data, error } = await supabase.rpc("training_import_questions", { p_module_id: id, p_items: r.questions });
    if (error) return { error: `M${String(r.position).padStart(2, "0")}: ${dbMessage(error, "não foi possível gravar as questões.")}` };
    // Nota mínima declarada no gabarito (ex.: avaliação final 7/10) entra se a avaliação ainda não tiver uma
    if (r.passScore) await supabase.from("training_assessments").update({ pass_score: r.passScore }).eq("module_id", id).is("pass_score", null);
    total += Number(data ?? 0);
    mods += 1;
  }
  refresh(courseId);
  if (!total) return { error: "Nenhuma questão foi encontrada para gravar." };
  return { ok: `${total} ${total === 1 ? "questão gravada" : "questões gravadas"} em ${mods} ${mods === 1 ? "módulo" : "módulos"}.` };
}

// ---------------------------------------------------------------------------
// Regras da avaliação (tempo, tentativas, intervalo, nota mínima)
// ---------------------------------------------------------------------------
const optInt = (min: number, max: number, msg: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), { message: msg })
    .transform((v) => (v === null ? null : Number(v)));

const assessmentSchema = z.object({
  time_limit_minutes: optInt(1, 600, "De 1 a 600 minutos, ou vazio para sem limite."),
  max_attempts: optInt(1, 50, "De 1 a 50, ou vazio para sem limite."),
  retry_wait_hours: optInt(0, 720, "De 0 a 720 horas.").transform((v) => v ?? 0),
  pass_score: optInt(1, 200, "Número de acertos, ou vazio para avaliação sem nota."),
  shuffle_questions: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export async function updateAssessmentAction(courseId: string, moduleId: string, _prev: TrState, formData: FormData): Promise<TrState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(moduleId)) return { error: "Módulo inválido." };
  const values = formToObject(formData);
  const parsed = assessmentSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { data: cur } = await supabase.from("training_assessments").select("id").eq("module_id", moduleId).maybeSingle();
  const { data, error } = cur
    ? await supabase.from("training_assessments").update(parsed.data).eq("id", cur.id).select("id")
    : await supabase.from("training_assessments").insert({ module_id: moduleId, ...parsed.data }).select("id");
  if (error || !data?.length) return { values, error: dbMessage(error, "Não foi possível salvar as regras da avaliação.") };
  refresh(courseId);
  return { ok: "Regras da avaliação salvas.", seq: Date.now() };
}

// ---------------------------------------------------------------------------
// Edição de uma questão (rascunho)
// ---------------------------------------------------------------------------
const questionSchema = z.object({
  statement: z.string().trim().min(5, "Informe o enunciado.").max(4000),
  feedback: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => (v ? v : null)),
  correct_key: z.string().optional(),
  status: z.enum(["ativo", "inativo"]),
});

export async function updateQuestionAction(courseId: string, questionId: string, _prev: TrState, formData: FormData): Promise<TrState> {
  await requireAppUser(ADMIN_ONLY);
  if (!uuidRe.test(courseId) || !uuidRe.test(questionId)) return { error: "Questão inválida." };
  const values = formToObject(formData);
  const parsed = questionSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { data: cur } = await supabase.from("training_questions").select("kind, options").eq("id", questionId).maybeSingle();
  if (!cur) return { error: "Questão não encontrada." };
  const patch: Record<string, unknown> = { statement: parsed.data.statement, feedback: parsed.data.feedback, status: parsed.data.status };
  if (cur.kind === "objetiva") {
    const options = (cur.options as { key: string; text: string }[]).map((o) => ({ key: o.key, text: String(values[`option_${o.key}`] ?? "").trim() }));
    const fe: Record<string, string> = {};
    for (const o of options) if (o.text.length < 1) fe[`option_${o.key}`] = "Informe a alternativa.";
    if (!options.some((o) => o.key === parsed.data.correct_key)) fe.correct_key = "Escolha a resposta certa.";
    if (Object.keys(fe).length) return { values, fieldErrors: fe, error: "Revise os campos destacados." };
    patch.options = options;
    patch.correct_key = parsed.data.correct_key;
  }
  const { data, error } = await supabase.from("training_questions").update(patch).eq("id", questionId).select("id");
  if (error || !data?.length) return { values, error: dbMessage(error, "Não foi possível salvar a questão.") };
  refresh(courseId);
  return { ok: "Questão salva.", seq: Date.now() };
}
