/** Lista Mestra (AUDDOC019): consultas e situação da revisão vigente. O documento em si está em master-list-doc.ts. */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { FINGERPRINT_RE, MASTER_LIST_CODE, masterFingerprint, type MasterCourse, type MasterListData, type MasterService } from "./master-list-doc";

export { fingerprintNote, MASTER_LIST_CODE, MASTER_LIST_TITLE, masterListWarnings, renderMasterListDocx } from "./master-list-doc";
export type { MasterListData } from "./master-list-doc";

export type MasterRevision = { id: string; revision: string; status: string; published_at: string | null; approved_by: string | null; approved_on: string | null; fingerprint: string | null };
export type MasterListState = {
  documentId: string | null;
  data: MasterListData;
  fingerprint: string;
  vigente: MasterRevision | null;
  nextRevision: string;
  upToDate: boolean;
  /** Itens criados ou alterados depois da publicação da revisão vigente. */
  changes: string[];
};

export async function loadMasterListData(): Promise<MasterListData> {
  const supabase = await createClient();
  const [services, courses] = await Promise.all([
    supabase
      .from("services")
      .select("service_code, kind, name, family, modality, legal_reference, billing_unit_ref, pricing_model, commercial_status, catalog_status, scope_preliminary, updated_at, created_at")
      .order("service_code"),
    supabase
      .from("training_courses")
      .select("course_code, title, status, price, access_days, updated_at, created_at, training_versions(version_label, status, workload_minutes, published_at)")
      .order("course_code"),
  ]);
  type V = { version_label: string; status: string; workload_minutes: number | null; published_at: string | null };
  return {
    services: (services.data ?? []) as MasterService[],
    courses: ((courses.data ?? []) as (Omit<MasterCourse, "version_label" | "workload_minutes" | "published_at"> & { training_versions: V[] | null })[]).map((c) => {
      const pub = (c.training_versions ?? []).find((v) => v.status === "publicada") ?? null;
      return {
        course_code: c.course_code,
        title: c.title,
        status: c.status,
        price: c.price === null ? null : String(c.price),
        access_days: c.access_days,
        version_label: pub?.version_label ?? null,
        workload_minutes: pub?.workload_minutes ?? null,
        updated_at: c.updated_at,
        created_at: c.created_at,
        published_at: pub?.published_at ?? null,
      };
    }),
  };
}

export async function getMasterListState(): Promise<MasterListState> {
  const supabase = await createClient();
  const [data, doc] = await Promise.all([
    loadMasterListData(),
    supabase.from("library_documents").select("id").eq("doc_code", MASTER_LIST_CODE).maybeSingle(),
  ]);
  const fingerprint = masterFingerprint(data);
  let revisions: MasterRevision[] = [];
  if (doc.data) {
    const { data: revs } = await supabase
      .from("library_revisions")
      .select("id, revision, status, published_at, approved_by, approved_on, notes")
      .eq("document_id", doc.data.id)
      .order("revision", { ascending: false });
    revisions = (revs ?? []).map((r) => ({ ...r, fingerprint: FINGERPRINT_RE.exec(r.notes ?? "")?.[1] ?? null }));
  }
  const vigente = revisions.find((r) => r.status === "vigente") ?? null;
  const lastNumber = revisions.length ? Number(revisions[0].revision.slice(4)) : -1;
  const since = vigente?.published_at ?? null;
  const changed = (created: string, updated: string | null) => Boolean(since && ((updated && updated > since) || created > since));
  const changes = since
    ? [
        ...data.services.filter((s) => changed(s.created_at, s.updated_at)).map((s) => `${s.service_code} — ${s.name} (${s.created_at > since ? "novo" : "alterado"})`),
        ...data.courses
          .filter((c) => changed(c.created_at, c.published_at && c.published_at > c.updated_at ? c.published_at : c.updated_at))
          .map((c) => `${c.course_code} — ${c.title} (${c.created_at > since ? "novo" : "alterado"})`),
      ]
    : [];
  return {
    documentId: doc.data?.id ?? null,
    data,
    fingerprint,
    vigente,
    nextRevision: `Rev.${String(lastNumber + 1).padStart(2, "0")}`,
    upToDate: Boolean(vigente && vigente.fingerprint === fingerprint),
    changes,
  };
}

