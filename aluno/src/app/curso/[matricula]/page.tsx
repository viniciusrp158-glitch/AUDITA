import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Check, Download, Lock } from "lucide-react";
import { currentStep, fmtDate, loadCourse, minutesLabel, mm, moduleMinutes, resumePoint, stepHref, stepMeta, STEP_LABEL, type Step } from "@/lib/curso";

export const metadata = { title: "Curso" };

const CTA: Record<Step, string> = { apostila: "Ler a apostila", video: "Assistir à videoaula", avaliacao: "Fazer a avaliação" };

export default async function CursoPage({ params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const c = await loadCourse(matricula);
  if (!c || c.blockedReason) notFound();
  const resume = resumePoint(c);
  const started = c.modules.some((m) => m.done_steps.length > 0);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8">
      <div>
        <p className="text-xs font-bold tracking-[0.08em] text-green-dark uppercase">
          {c.courseCode} · versão {c.versionLabel}
        </p>
        <h1 className="mt-1 text-2xl leading-tight font-extrabold text-navy sm:text-[26px]">{c.title}</h1>
        <p className="mt-1.5 text-sm text-muted">
          {[minutesLabel(c.workloadMinutes), `${c.total} módulos`, c.instructor ? `Instrutor: ${c.instructor}` : null, c.accessUntil ? `Acesso até ${fmtDate(c.accessUntil)}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {c.certificateCode ? (
        <section className="flex flex-col gap-4 rounded-2xl bg-navy p-6 text-white sm:flex-row sm:items-center" data-testid="course-done">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-green text-navy">
            <Award size={28} aria-hidden />
          </span>
          <div className="flex-1">
            <p className="text-xl font-extrabold">Curso concluído</p>
            <p className="mt-1 text-sm text-white/80">Seu certificado de curso livre já está disponível. O conteúdo continua aberto para consulta.</p>
          </div>
          <Link href={`/curso/${c.enrollmentId}/certificado`} className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-green px-5 text-[15px] font-extrabold text-navy">
            Ver certificado
          </Link>
        </section>
      ) : (
        resume && (
          <section className="flex flex-col gap-4 rounded-2xl border border-lime-200 bg-white p-5 sm:p-6" data-testid="resume-card">
            <p className="text-[11px] font-bold tracking-[0.08em] text-green-dark uppercase">{started ? "Continuar de onde parei" : "Começar o curso"}</p>
            <p className="text-lg leading-snug font-extrabold text-navy">
              Módulo {mm(resume.module.position)} · {resume.module.title}
            </p>
            <ol className="flex flex-col gap-2">
              {resume.module.required_steps.map((s, i) => {
                const done = resume.module.done_steps.includes(s);
                const now = s === resume.step;
                return (
                  <li key={s} className={`flex items-center gap-2.5 text-sm ${now ? "font-bold text-ink" : done ? "text-ink" : "text-muted"}`}>
                    <span
                      className={`flex size-[22px] shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${done ? "bg-green-dark text-white" : now ? "bg-navy text-white" : "bg-chip text-navy"}`}
                    >
                      {done ? <Check size={13} strokeWidth={3} aria-label="Concluída" /> : i + 1}
                    </span>
                    <span className="flex-1">{STEP_LABEL[s]}</span>
                    <span className="text-xs font-normal text-muted">{stepMeta(resume.module, s)}</span>
                  </li>
                );
              })}
            </ol>
            <Link
              href={stepHref(c.enrollmentId, resume.module.module_id, resume.step)}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-green px-5 text-[15px] font-extrabold text-navy sm:self-start"
              data-testid="resume-button"
            >
              {CTA[resume.step]}
            </Link>
          </section>
        )
      )}

      {c.fichaFileId && (
        <a href={`/treinamentos/arquivo/${c.fichaFileId}?baixar=1`} className="inline-flex items-center gap-2 self-start text-sm font-semibold text-navy hover:underline">
          <Download size={15} aria-hidden /> Ficha técnica do curso (PDF)
        </a>
      )}

      {/* No celular a lateral vira gaveta; aqui fica a lista de módulos, como no protótipo */}
      <section className="lg:hidden">
        <p className="px-1 pb-2 text-xs font-bold tracking-[0.08em] text-muted uppercase">Todos os módulos</p>
        <ol className="overflow-hidden rounded-2xl border border-line bg-white">
          {c.modules.map((m) => {
            const isNow = resume?.module.module_id === m.module_id;
            const row = (
              <span className={`flex items-center gap-3 px-3.5 py-3 ${isNow ? "bg-lime-50" : ""} ${m.unlocked ? "" : "text-muted"}`}>
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${m.completed ? "bg-green-dark text-white" : isNow ? "bg-navy text-white" : "bg-chip text-navy"}`}
                >
                  {m.completed ? <Check size={14} strokeWidth={3} aria-label="Concluído" /> : m.unlocked ? mm(m.position) : <Lock size={12} className="text-lock" aria-label="Bloqueado" />}
                </span>
                <span className={`flex-1 text-sm ${isNow ? "font-bold" : "font-semibold"}`}>
                  {mm(m.position)} · {m.title}
                </span>
                <span className="text-xs text-muted">{minutesLabel(moduleMinutes(m))}</span>
              </span>
            );
            return (
              <li key={m.module_id} className="border-b border-chip last:border-b-0">
                {m.unlocked ? <Link href={stepHref(c.enrollmentId, m.module_id, currentStep(m))}>{row}</Link> : row}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
