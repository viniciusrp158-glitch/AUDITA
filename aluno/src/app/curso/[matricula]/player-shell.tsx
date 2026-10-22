"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Award, Check, ChevronLeft, ListTree, Lock, X } from "lucide-react";

export type NavStep = { step: "apostila" | "video" | "avaliacao"; label: string; meta: string; done: boolean; open: boolean; href: string };
export type NavModule = {
  id: string;
  n: string;
  title: string;
  minutes: string | null;
  completed: boolean;
  unlocked: boolean;
  href: string;
  steps: NavStep[];
};
export type NavCourse = {
  enrollmentId: string;
  title: string;
  done: number;
  total: number;
  pct: number;
  caption: string;
  certificateNote: string;
  certificateHref: string | null;
  resumeModuleId: string | null;
  modules: NavModule[];
};

/** Lateral do curso: módulos com cadeado/concluído e, no módulo em foco, as etapas (o acompanhamento fica só aqui). */
function CourseNav({ course, currentModule, currentStep }: { course: NavCourse; currentModule: string | null; currentStep: string | null }) {
  const focus = currentModule ?? course.resumeModuleId;
  return (
    <nav aria-label="Conteúdo do curso" className="flex flex-col gap-1.5 px-4 py-5">
      <p className="px-2 pb-2.5 text-xs font-bold tracking-[0.08em] text-muted uppercase">{course.caption}</p>
      <ol className="flex flex-col gap-1.5" data-testid="course-nav">
        {course.modules.map((m) => {
          const isFocus = m.id === focus;
          const state = m.completed ? "done" : !m.unlocked ? "locked" : isFocus ? "current" : "open";
          const badge =
            state === "done"
              ? "bg-green-dark text-white border-transparent"
              : state === "current"
                ? "bg-navy text-white border-transparent"
                : state === "open"
                  ? "bg-white text-navy border-navy"
                  : "bg-chip text-navy border-transparent";
          const head = (
            <span className="flex items-center gap-3">
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-extrabold ${badge}`}>
                {state === "done" ? <Check size={16} strokeWidth={3} aria-label="Concluído" /> : state === "locked" ? <Lock size={14} className="text-lock" aria-label="Bloqueado" /> : m.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold tracking-[0.06em] text-muted uppercase">
                  Módulo {m.n}
                  {m.minutes ? ` · ${m.minutes}` : ""}
                </span>
                <span className={`block text-sm leading-snug font-semibold ${state === "locked" ? "text-muted" : "text-navy"}`}>{m.title}</span>
              </span>
            </span>
          );
          return (
            <li key={m.id} className={`rounded-xl border p-3 ${isFocus && !m.completed ? "border-lime-200 bg-lime-50" : "border-transparent"}`}>
              {m.unlocked ? (
                <Link href={m.href} className="block rounded-lg" aria-current={isFocus ? "true" : undefined}>
                  {head}
                </Link>
              ) : (
                <div aria-disabled="true" title="Conclua o módulo anterior para liberar este">
                  {head}
                </div>
              )}
              {isFocus && m.unlocked && (
                <ul className="mt-3 flex flex-col gap-1 pl-11">
                  {m.steps.map((s) => {
                    const active = currentModule === m.id && currentStep === s.step;
                    const dot = s.done ? "bg-green-dark" : active ? "bg-navy" : "bg-line";
                    const inner = (
                      <>
                        <span className={`size-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
                        <span className="flex-1 text-left">
                          <span className="block text-[13px] font-semibold">
                            {s.label}
                            {s.done && <span className="sr-only"> (concluída)</span>}
                          </span>
                          <span className="block text-xs text-muted">{s.meta}</span>
                        </span>
                      </>
                    );
                    return (
                      <li key={s.step}>
                        {s.open ? (
                          <Link
                            href={s.href}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-ink ${active ? "bg-white shadow-[0_1px_2px_rgba(3,27,53,0.08)]" : "hover:bg-white/70"}`}
                            aria-current={active ? "step" : undefined}
                          >
                            {inner}
                          </Link>
                        ) : (
                          <span className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-muted" aria-disabled="true">
                            {inner}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-2.5 rounded-xl bg-surface p-3.5 text-xs leading-relaxed text-muted">
        {course.certificateHref ? (
          <Link href={course.certificateHref} className="inline-flex items-center gap-1.5 font-semibold text-navy hover:underline">
            <Award size={15} aria-hidden /> Ver meu certificado
          </Link>
        ) : (
          course.certificateNote
        )}
      </div>
    </nav>
  );
}

function parse(pathname: string, enrollmentId: string): { module: string | null; step: string | null } {
  const m = new RegExp(`^/curso/${enrollmentId}/modulo/([0-9a-f-]{36})(?:/(apostila|video|avaliacao))?`).exec(pathname);
  return { module: m?.[1] ?? null, step: m?.[2] ?? null };
}

/** Moldura do player: cabeçalho com o progresso, lateral fixa no computador e gaveta no celular. */
export function PlayerShell({ course, children }: { course: NavCourse; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const cur = parse(pathname, course.enrollmentId);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-30 bg-navy text-white">
        <div className="flex h-16 items-center gap-3 px-4 sm:gap-5 sm:px-6">
          <Link
            href="/meus-cursos"
            aria-label="Voltar para Meus cursos"
            className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-navy-line text-white hover:bg-white/10"
          >
            <ChevronLeft size={18} strokeWidth={2.4} aria-hidden />
          </Link>
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-white/85 sm:text-[15px]">{course.title}</p>
          <div className="hidden items-center gap-2.5 text-[13px] text-white/85 sm:flex" data-testid="course-progress">
            <span>
              {course.done} de {course.total} módulos
            </span>
            <span className="h-2 w-32 overflow-hidden rounded-full bg-navy-line" aria-hidden>
              <span className="block h-2 rounded-full bg-green" style={{ width: `${course.pct}%` }} />
            </span>
            <span className="font-bold text-white">{course.pct}%</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] border border-navy-line px-3 text-sm font-semibold hover:bg-white/10 lg:hidden"
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <ListTree size={17} aria-hidden /> Conteúdo
          </button>
        </div>
        <div className="h-1 bg-navy-line sm:hidden" aria-hidden>
          <div className="h-1 bg-green" style={{ width: `${course.pct}%` }} />
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="no-print sticky top-16 hidden h-[calc(100vh-4rem)] w-[360px] shrink-0 overflow-y-auto border-r border-line bg-white lg:block xl:w-[380px]">
          <CourseNav course={course} currentModule={cur.module} currentStep={cur.step} />
        </aside>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Conteúdo do curso">
            <button type="button" className="absolute inset-0 bg-navy/50" aria-label="Fechar" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 right-0 flex w-[min(380px,92vw)] flex-col overflow-y-auto bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="text-sm font-semibold text-ink">
                  {course.done} de {course.total} módulos concluídos
                </span>
                <button type="button" onClick={() => setOpen(false)} className="flex size-9 items-center justify-center rounded-lg hover:bg-surface" aria-label="Fechar">
                  <X size={18} aria-hidden />
                </button>
              </div>
              <CourseNav course={course} currentModule={cur.module} currentStep={cur.step} />
            </div>
          </div>
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
