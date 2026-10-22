import { notFound, redirect } from "next/navigation";
import { isUuid, stepHref } from "@/lib/curso";
import { createClient } from "@/lib/supabase/server";
import { QuizRunner, type QuizQuestion } from "../../../../../../quiz-runner";
import { loadStep, ModuleHeader, StepPage } from "../../../shared";

export const metadata = { title: "Avaliação" };

type View = { id: string; status: "em_andamento" | "enviada"; module_id: string; enrollment_id: string; deadline_at: string | null; now: string; questions: QuizQuestion[] };

export default async function ProvaPage({ params }: { params: Promise<{ matricula: string; modulo: string; tentativa: string }> }) {
  const p = await params;
  const { c, m } = await loadStep(Promise.resolve(p), "avaliacao");
  if (!isUuid(p.tentativa)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("training_attempt_view", { p_attempt_id: p.tentativa });
  const v = data as View | null;
  if (error || !v || v.module_id !== m.module_id || v.enrollment_id !== c.enrollmentId) notFound();
  const base = stepHref(c.enrollmentId, m.module_id, "avaliacao");
  if (v.status === "enviada") redirect(`${base}/resultado/${v.id}`);
  return (
    <StepPage>
      <ModuleHeader m={m} />
      <QuizRunner enrollmentId={c.enrollmentId} moduleId={m.module_id} attemptId={v.id} questions={v.questions} deadlineAt={v.deadline_at} serverNow={v.now} />
    </StepPage>
  );
}
