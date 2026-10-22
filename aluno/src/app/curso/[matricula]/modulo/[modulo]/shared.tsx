import { notFound, redirect } from "next/navigation";
import { currentStep, loadCourse, minutesLabel, mm, moduleMinutes, stepHref, stepOpen, type CourseData, type OutlineModule, type Step } from "@/lib/curso";

/** Carrega o curso e o módulo e confere se a etapa está liberada; senão leva à etapa certa. */
export async function loadStep(params: Promise<{ matricula: string; modulo: string }>, step: Step): Promise<{ c: CourseData; m: OutlineModule }> {
  const { matricula, modulo } = await params;
  const c = await loadCourse(matricula);
  const m = c?.modules.find((x) => x.module_id === modulo);
  if (!c || !m) notFound();
  if (!m.unlocked) redirect(`/curso/${c.enrollmentId}`);
  if (!m.required_steps.includes(step) || !stepOpen(m, step)) redirect(stepHref(c.enrollmentId, m.module_id, currentStep(m)));
  return { c, m };
}

/** Cabeçalho do módulo (sem quadros de etapas: o acompanhamento fica na lateral). */
export function ModuleHeader({ m }: { m: OutlineModule }) {
  const min = minutesLabel(moduleMinutes(m));
  return (
    <div>
      <p className="text-xs font-bold tracking-[0.08em] text-green-dark uppercase">
        Módulo {mm(m.position)}
        {min ? ` · ${min}` : ""}
      </p>
      <h1 className="mt-1 text-[22px] leading-tight font-extrabold text-navy sm:text-[26px]">{m.title}</h1>
      {m.objective && <p className="mt-1.5 max-w-[70ch] text-sm text-muted">Objetivo: {m.objective}</p>}
    </div>
  );
}

export function StepPage({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 sm:px-8 sm:py-7">{children}</div>;
}
