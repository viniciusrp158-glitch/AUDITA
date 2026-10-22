import { notFound } from "next/navigation";
import { loadCourse, minutesLabel, mm, moduleMinutes, stepHref, stepMeta, stepOpen, STEP_LABEL, currentStep, resumePoint } from "@/lib/curso";
import { StudentHeader } from "../../shell";
import { PlayerShell, type NavCourse } from "./player-shell";

export const dynamic = "force-dynamic";

export default async function CursoLayout({ params, children }: { params: Promise<{ matricula: string }>; children: React.ReactNode }) {
  const { matricula } = await params;
  const c = await loadCourse(matricula);
  if (!c) notFound();
  if (c.blockedReason) {
    return (
      <>
        <StudentHeader />
        <main className="mx-auto max-w-2xl px-4 py-14 text-center sm:px-6">
          <h1 className="text-xl font-semibold text-ink">{c.title}</h1>
          <p className="mt-3 text-sm text-muted" data-testid="course-blocked">
            {c.blockedReason}
          </p>
        </main>
      </>
    );
  }
  const final = c.modules.find((m) => m.pass_score);
  const nav: NavCourse = {
    enrollmentId: c.enrollmentId,
    title: c.title,
    done: c.done,
    total: c.total,
    pct: c.pct,
    caption: ["Conteúdo do curso", `${c.total} ${c.total === 1 ? "módulo" : "módulos"}`, minutesLabel(c.workloadMinutes)].filter(Boolean).join(" · "),
    certificateNote: `Certificado de curso livre liberado ao concluir os ${c.total} módulos${
      final ? ` e acertar pelo menos ${final.pass_score} das ${final.objective_count} questões da avaliação final` : ""
    }.`,
    certificateHref: c.certificateCode ? `/curso/${c.enrollmentId}/certificado` : null,
    resumeModuleId: resumePoint(c)?.module.module_id ?? null,
    modules: c.modules.map((m) => ({
      id: m.module_id,
      n: mm(m.position),
      title: m.title,
      minutes: minutesLabel(moduleMinutes(m)),
      completed: m.completed,
      unlocked: m.unlocked,
      href: stepHref(c.enrollmentId, m.module_id, currentStep(m)),
      steps: m.required_steps.map((s) => ({
        step: s,
        label: STEP_LABEL[s],
        meta: stepMeta(m, s),
        done: m.done_steps.includes(s),
        open: stepOpen(m, s),
        href: stepHref(c.enrollmentId, m.module_id, s),
      })),
    })),
  };
  return <PlayerShell course={nav}>{children}</PlayerShell>;
}
