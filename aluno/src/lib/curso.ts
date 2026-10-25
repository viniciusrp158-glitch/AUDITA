import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Step = "apostila" | "video" | "avaliacao";
export const STEP_LABEL: Record<Step, string> = { apostila: "Apostila", video: "Videoaula", avaliacao: "Avaliação" };
export const STEPS: Step[] = ["apostila", "video", "avaliacao"];

export type OutlineModule = {
  module_id: string;
  position: number;
  title: string;
  objective: string | null;
  content_summary: string | null;
  video_minutes: number | null;
  reading_minutes: number | null;
  activity_minutes: number | null;
  video_url: string | null;
  is_orientation: boolean;
  apostila_file_id: string | null;
  assessment_id: string | null;
  question_count: number;
  objective_count: number;
  time_limit_minutes: number | null;
  pass_score: number | null;
  max_attempts: number | null;
  required_steps: Step[];
  done_steps: Step[];
  completed: boolean;
  unlocked: boolean;
};

export type CourseData = {
  enrollmentId: string;
  status: "ativa" | "suspensa" | "cancelada" | "concluida";
  accessUntil: string | null;
  startsOn: string;
  courseCode: string;
  title: string;
  versionLabel: string;
  workloadMinutes: number | null;
  instructor: string | null;
  modality: string | null;
  notice: string | null;
  fichaFileId: string | null;
  modules: OutlineModule[];
  done: number;
  total: number;
  pct: number;
  /** Pode estudar (matrícula ativa e dentro do prazo). Concluída: só consulta. */
  canStudy: boolean;
  blockedReason: string | null;
  certificateCode: string | null;
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => uuidRe.test(v);

type EnrollmentRow = {
  id: string;
  status: CourseData["status"];
  access_until: string | null;
  access_revoked_at: string | null;
  starts_on: string;
  version_id: string;
  training_courses: { course_code: string; title: string } | null;
  training_versions: {
    title: string;
    version_label: string;
    workload_minutes: number | null;
    instructor_name: string | null;
    modality: string | null;
    important_notice: string | null;
  } | null;
};

/** Curso do aluno da sessão (matrícula, estrutura com o progresso e certificado). Null se a matrícula não for dele. */
export const loadCourse = cache(async (enrollmentId: string): Promise<CourseData | null> => {
  if (!isUuid(enrollmentId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_enrollments")
    .select(
      "id, status, access_until, access_revoked_at, starts_on, version_id, training_courses(course_code, title), training_versions(title, version_label, workload_minutes, instructor_name, modality, important_notice)",
    )
    .eq("id", enrollmentId)
    .maybeSingle();
  const e = data as unknown as EnrollmentRow | null;
  if (!e) return null;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const expired = e.access_until !== null && e.access_until < today;
  const blockedReason =
    e.access_revoked_at !== null
      ? "O acesso a este curso foi encerrado porque a compra foi reembolsada ou estornada."
      : e.status === "suspensa"
      ? "Seu acesso a este curso está suspenso. Fale com a AUDITA para reativar."
      : e.status === "cancelada"
        ? "Esta matrícula foi cancelada."
        : expired
          ? "O prazo de acesso a este curso terminou. Fale com a AUDITA para renovar."
          : null;
  const base = {
    enrollmentId: e.id,
    status: e.status,
    accessUntil: e.access_until,
    startsOn: e.starts_on,
    courseCode: e.training_courses?.course_code ?? "",
    title: e.training_versions?.title ?? e.training_courses?.title ?? "",
    versionLabel: e.training_versions?.version_label ?? "",
    workloadMinutes: e.training_versions?.workload_minutes ?? null,
    instructor: e.training_versions?.instructor_name ?? null,
    modality: e.training_versions?.modality ?? null,
    notice: e.training_versions?.important_notice ?? null,
  };
  if (blockedReason) {
    return { ...base, fichaFileId: null, modules: [], done: 0, total: 0, pct: 0, canStudy: false, blockedReason, certificateCode: null };
  }
  const [outline, ficha, cert] = await Promise.all([
    supabase.rpc("training_outline", { p_enrollment_id: e.id }),
    supabase.from("training_files").select("id").eq("version_id", e.version_id).eq("kind", "ficha_tecnica").eq("status", "ativo").maybeSingle(),
    supabase.from("training_certificates").select("code").eq("enrollment_id", e.id).eq("status", "valido").maybeSingle(),
  ]);
  const modules = (outline.data ?? []) as OutlineModule[];
  const done = modules.filter((m) => m.completed).length;
  return {
    ...base,
    fichaFileId: (ficha.data?.id as string | undefined) ?? null,
    modules,
    done,
    total: modules.length,
    pct: modules.length ? Math.round((done / modules.length) * 100) : 0,
    canStudy: e.status === "ativa",
    blockedReason: null,
    certificateCode: (cert.data?.code as string | undefined) ?? null,
  };
});

/** Etapa liberada: módulo liberado e etapas anteriores do módulo concluídas. */
export function stepOpen(m: OutlineModule, step: Step): boolean {
  if (!m.unlocked || !m.required_steps.includes(step)) return false;
  const idx = m.required_steps.indexOf(step);
  return m.required_steps.slice(0, idx).every((s) => m.done_steps.includes(s));
}

/** Próxima etapa do módulo (a primeira não concluída; se tudo concluído, a última). */
export function currentStep(m: OutlineModule): Step {
  return m.required_steps.find((s) => !m.done_steps.includes(s)) ?? m.required_steps[m.required_steps.length - 1];
}

/** Onde o aluno parou: primeiro módulo liberado ainda não concluído. */
export function resumePoint(c: CourseData): { module: OutlineModule; step: Step } | null {
  const m = c.modules.find((x) => x.unlocked && !x.completed);
  return m ? { module: m, step: currentStep(m) } : null;
}

export const stepHref = (enrollmentId: string, moduleId: string, step: Step) => `/curso/${enrollmentId}/modulo/${moduleId}/${step}`;

/** Depois desta etapa: a próxima do módulo ou a primeira do módulo seguinte. */
export function nextAfter(c: CourseData, m: OutlineModule, step: Step): string {
  const i = m.required_steps.indexOf(step);
  if (i >= 0 && i < m.required_steps.length - 1) return stepHref(c.enrollmentId, m.module_id, m.required_steps[i + 1]);
  const next = c.modules.find((x) => x.position > m.position);
  return next ? stepHref(c.enrollmentId, next.module_id, "apostila") : `/curso/${c.enrollmentId}`;
}

export const mm = (position: number) => String(position).padStart(2, "0");

export function minutesLabel(min: number | null | undefined): string | null {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

export function moduleMinutes(m: OutlineModule): number | null {
  const t = (m.video_minutes ?? 0) + (m.reading_minutes ?? 0) + (m.activity_minutes ?? 0);
  return t || null;
}

export function stepMeta(m: OutlineModule, step: Step): string {
  if (step === "apostila") return ["Leitura", minutesLabel(m.reading_minutes)].filter(Boolean).join(" · ");
  if (step === "video") return ["Vídeo", minutesLabel(m.video_minutes)].filter(Boolean).join(" · ");
  const q = `${m.question_count} ${m.question_count === 1 ? "questão" : "questões"}`;
  return [q, m.time_limit_minutes ? `${m.time_limit_minutes} min` : null].filter(Boolean).join(" · ");
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

/** Mensagem do banco quando é uma regra do curso (as funções explicam o motivo em português). */
export function dbMessage(error: { code?: string; message?: string } | null, fallback: string): string {
  if (error && ["23514", "42501", "22023", "P0002"].includes(error.code ?? "") && error.message && !/violates|permission denied/i.test(error.message)) {
    return error.message;
  }
  return fallback;
}
