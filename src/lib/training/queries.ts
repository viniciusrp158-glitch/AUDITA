import "server-only";
import { notFound } from "next/navigation";
import { normalizeSearch } from "@/lib/clients/queries";
import { createClient } from "@/lib/supabase/server";
import type { FileKind, VersionStatus } from "./labels";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TrainingVersion = {
  id: string;
  version_label: string;
  status: VersionStatus;
  title: string;
  summary: string | null;
  modality: string | null;
  workload_minutes: number | null;
  audience: string | null;
  prerequisites: string | null;
  general_objective: string | null;
  methodology: string | null;
  assessment_rules: string | null;
  resources: string | null;
  references_text: string | null;
  important_notice: string | null;
  instructor_name: string | null;
  status_note: string | null;
  published_at: string | null;
  created_at: string;
};

export type TrainingCourse = {
  id: string;
  course_code: string;
  title: string;
  price: number | null;
  access_days: number | null;
  status: "ativo" | "inativo";
  notes: string | null;
  created_at: string;
};

export type TrainingModule = {
  id: string;
  position: number;
  title: string;
  objective: string | null;
  content_summary: string | null;
  video_minutes: number | null;
  reading_minutes: number | null;
  activity_minutes: number | null;
  video_url: string | null;
  is_orientation: boolean;
  status: "ativo" | "inativo";
};

export type TrainingFile = {
  id: string;
  module_id: string | null;
  kind: FileKind;
  audience: "aluno" | "equipe";
  position: number;
  original_name: string;
  size_bytes: number;
  sha256: string;
  created_at: string;
};

export type CourseListRow = TrainingCourse & { training_versions: Pick<TrainingVersion, "id" | "version_label" | "status" | "workload_minutes">[] };

export async function listCourses(q: string): Promise<{ rows: CourseListRow[]; error: boolean }> {
  const supabase = await createClient();
  let query = supabase
    .from("training_courses")
    .select("id, course_code, title, price, access_days, status, notes, created_at, training_versions(id, version_label, status, workload_minutes)")
    .order("course_code");
  const term = normalizeSearch(q ?? "");
  if (term) query = query.ilike("search_text", `%${term}%`);
  const { data, error } = await query;
  return { rows: (data ?? []) as CourseListRow[], error: Boolean(error) };
}

export type EnrollmentRow = {
  id: string;
  status: "ativa" | "suspensa" | "cancelada" | "concluida";
  starts_on: string;
  access_until: string | null;
  source: "gestao" | "lote" | "compra" | "cortesia";
  status_note: string | null;
  completed_at: string | null;
  created_at: string;
  training_students: { id: string; full_name: string; email: string; company: string | null; cpf: string | null; status: "ativo" | "inativo" } | null;
  training_versions: { version_label: string } | null;
};

export async function listEnrollments(courseId: string): Promise<{ rows: EnrollmentRow[]; error: boolean }> {
  if (!uuidRe.test(courseId)) return { rows: [], error: true };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_enrollments")
    .select(
      "id, status, starts_on, access_until, source, status_note, completed_at, created_at, training_students(id, full_name, email, company, cpf, status), training_versions(version_label)",
    )
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  return { rows: (data ?? []) as unknown as EnrollmentRow[], error: Boolean(error) };
}

/** Versão em foco: a pedida (se for do treinamento); senão o rascunho, a publicada ou a mais recente. */
export function pickVersion(versions: TrainingVersion[], wanted?: string): TrainingVersion | null {
  if (wanted) {
    const v = versions.find((x) => x.id === wanted);
    if (v) return v;
  }
  return (
    versions.find((v) => v.status === "rascunho") ??
    versions.find((v) => v.status === "publicada") ??
    [...versions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ??
    null
  );
}

export async function getCourseDetail(id: string, wantedVersion?: string) {
  if (!uuidRe.test(id)) notFound();
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("training_courses")
    .select("id, course_code, title, price, access_days, status, notes, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!course) notFound();
  const { data: versions } = await supabase
    .from("training_versions")
    .select(
      "id, version_label, status, title, summary, modality, workload_minutes, audience, prerequisites, general_objective, methodology, assessment_rules, resources, references_text, important_notice, instructor_name, status_note, published_at, created_at",
    )
    .eq("course_id", id)
    .order("created_at", { ascending: false });
  const all = (versions ?? []) as TrainingVersion[];
  const version = pickVersion(all, wantedVersion && uuidRe.test(wantedVersion) ? wantedVersion : undefined);
  let modules: TrainingModule[] = [];
  let files: TrainingFile[] = [];
  if (version) {
    const [m, f] = await Promise.all([
      supabase
        .from("training_modules")
        .select("id, position, title, objective, content_summary, video_minutes, reading_minutes, activity_minutes, video_url, is_orientation, status")
        .eq("version_id", version.id)
        .order("position"),
      supabase
        .from("training_files")
        .select("id, module_id, kind, audience, position, original_name, size_bytes, sha256, created_at")
        .eq("version_id", version.id)
        .eq("status", "ativo")
        .order("position")
        .order("original_name"),
    ]);
    modules = (m.data ?? []) as TrainingModule[];
    files = (f.data ?? []) as TrainingFile[];
  }
  return { course: course as TrainingCourse, versions: all, version, modules, files };
}

export type AssessmentQuestion = {
  id: string;
  position: number;
  code: string;
  kind: "objetiva" | "aberta";
  statement: string;
  options: { key: string; text: string }[] | null;
  correct_key: string | null;
  feedback: string | null;
  status: "ativo" | "inativo";
};
export type Assessment = {
  id: string;
  module_id: string;
  time_limit_minutes: number | null;
  max_attempts: number | null;
  retry_wait_hours: number;
  pass_score: number | null;
  shuffle_questions: boolean;
  training_questions: AssessmentQuestion[];
};

/** Avaliações da versão (com as questões), por módulo. */
export async function getAssessments(versionId: string): Promise<Record<string, Assessment>> {
  if (!uuidRe.test(versionId)) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_assessments")
    .select(
      "id, module_id, time_limit_minutes, max_attempts, retry_wait_hours, pass_score, shuffle_questions, training_questions(id, position, code, kind, statement, options, correct_key, feedback, status)",
    )
    .eq("version_id", versionId);
  const out: Record<string, Assessment> = {};
  for (const a of (data ?? []) as Assessment[]) {
    a.training_questions.sort((x, y) => (x.status === y.status ? x.position - y.position : x.status === "ativo" ? -1 : 1));
    out[a.module_id] = a;
  }
  return out;
}

export type EnrollmentProgress = { modules_done: number; modules_total: number; final_score: number | null; final_max_score: number | null; certificate_code: string | null };

/** Andamento de cada matrícula do treinamento (módulos concluídos, nota final e certificado). */
export async function getEnrollmentProgress(courseId: string): Promise<Record<string, EnrollmentProgress>> {
  if (!uuidRe.test(courseId)) return {};
  const supabase = await createClient();
  const { data } = await supabase.rpc("training_enrollment_progress", { p_course_id: courseId });
  const out: Record<string, EnrollmentProgress> = {};
  for (const r of (data ?? []) as (EnrollmentProgress & { enrollment_id: string })[]) out[r.enrollment_id] = r;
  return out;
}
