import { notFound, redirect } from "next/navigation";
import { currentStep, loadCourse, stepHref } from "@/lib/curso";

/** Abre o módulo na etapa em que o aluno está. */
export default async function ModuloPage({ params }: { params: Promise<{ matricula: string; modulo: string }> }) {
  const { matricula, modulo } = await params;
  const c = await loadCourse(matricula);
  const m = c?.modules.find((x) => x.module_id === modulo);
  if (!c || !m) notFound();
  if (!m.unlocked) redirect(`/curso/${c.enrollmentId}`);
  redirect(stepHref(c.enrollmentId, m.module_id, currentStep(m)));
}
