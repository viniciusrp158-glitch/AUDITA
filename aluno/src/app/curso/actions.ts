"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbMessage, isUuid, loadCourse, nextAfter, stepHref, type Step } from "@/lib/curso";
import { createClient } from "@/lib/supabase/server";

export type StepState = { error?: string };

/** Concluí a apostila / a videoaula: registra no servidor (que confere a ordem) e segue para a próxima etapa. */
export async function completeStepAction(enrollmentId: string, moduleId: string, step: Extract<Step, "apostila" | "video">): Promise<StepState> {
  if (!isUuid(enrollmentId) || !isUuid(moduleId)) return { error: "Etapa inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("training_complete_step", { p_enrollment_id: enrollmentId, p_module_id: moduleId, p_step: step });
  if (error) return { error: dbMessage(error, "Não foi possível registrar a etapa. Tente de novo.") };
  revalidatePath(`/curso/${enrollmentId}`, "layout");
  const c = await loadCourse(enrollmentId);
  const m = c?.modules.find((x) => x.module_id === moduleId);
  redirect(c && m ? nextAfter(c, m, step) : `/curso/${enrollmentId}`);
}

/** Inicia (ou retoma) a avaliação do módulo. */
export async function startAttemptAction(enrollmentId: string, moduleId: string): Promise<StepState> {
  if (!isUuid(enrollmentId) || !isUuid(moduleId)) return { error: "Avaliação inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("training_attempt_start", { p_enrollment_id: enrollmentId, p_module_id: moduleId });
  if (error || !data) return { error: dbMessage(error, "Não foi possível iniciar a avaliação. Tente de novo.") };
  redirect(`${stepHref(enrollmentId, moduleId, "avaliacao")}/prova/${data}`);
}

/** Salvamento automático de uma resposta durante a prova. */
export async function saveAnswerAction(attemptId: string, questionId: string, choice: string | null, text: string | null): Promise<StepState> {
  if (!isUuid(attemptId) || !isUuid(questionId)) return { error: "Resposta inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("training_attempt_save", { p_attempt_id: attemptId, p_question_id: questionId, p_choice: choice, p_text: text });
  if (error) return { error: dbMessage(error, "Não foi possível salvar a resposta. Confira a conexão.") };
  return {};
}

/** Envia a avaliação (o servidor corrige) e abre o resultado. */
export async function submitAttemptAction(enrollmentId: string, moduleId: string, attemptId: string): Promise<StepState> {
  if (!isUuid(enrollmentId) || !isUuid(moduleId) || !isUuid(attemptId)) return { error: "Avaliação inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("training_attempt_submit", { p_attempt_id: attemptId });
  if (error) return { error: dbMessage(error, "Não foi possível enviar a avaliação. Tente de novo.") };
  revalidatePath(`/curso/${enrollmentId}`, "layout");
  redirect(`${stepHref(enrollmentId, moduleId, "avaliacao")}/resultado/${attemptId}`);
}
