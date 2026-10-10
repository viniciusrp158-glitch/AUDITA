import "server-only";
import { notFound } from "next/navigation";
import { normalizeSearch } from "@/lib/clients/queries";
import { createClient } from "@/lib/supabase/server";
import type { LibRevStatus, Phase } from "./labels";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LibRevision = {
  id: string;
  revision: string;
  status: LibRevStatus;
  approved_by: string | null;
  approved_on: string | null;
  issued_on: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  notes: string | null;
  status_note: string | null;
  published_at: string | null;
  created_at: string;
};

export type LibDocument = {
  id: string;
  doc_code: string;
  title: string;
  kind: "documento" | "anexo";
  parent_id: string | null;
  family: string;
  phase: Phase;
  visibility: "interno" | "externo";
  status: "ativo" | "inativo";
  notes: string | null;
  created_at: string;
  library_revisions: LibRevision[];
};

const REV_COLS =
  "id, revision, status, approved_by, approved_on, issued_on, original_name, mime_type, size_bytes, sha256, notes, status_note, published_at, created_at";
const DOC_COLS = `id, doc_code, title, kind, parent_id, family, phase, visibility, status, notes, created_at, library_revisions(${REV_COLS})`;

export async function listLibrary({
  q,
  fase,
  familia,
}: {
  q?: string;
  fase?: string;
  familia?: string;
}): Promise<{ rows: LibDocument[]; families: string[]; error: boolean }> {
  const supabase = await createClient();
  let query = supabase.from("library_documents").select(DOC_COLS).order("doc_code");
  if (fase) query = query.eq("phase", fase);
  if (familia) query = query.eq("family", familia);
  const term = normalizeSearch(q ?? "");
  if (term) query = query.ilike("search_text", `%${term}%`);
  const [{ data, error }, fam] = await Promise.all([query, supabase.from("library_documents").select("family")]);
  const families = [...new Set((fam.data ?? []).map((f) => f.family as string))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { rows: (data ?? []) as unknown as LibDocument[], families, error: Boolean(error) };
}

export async function getLibDocumentOr404(id: string): Promise<{ doc: LibDocument; parent: { id: string; doc_code: string; title: string } | null; annexes: { id: string; doc_code: string; title: string }[] }> {
  if (!uuidRe.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("library_documents").select(DOC_COLS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const doc = data as unknown as LibDocument;
  doc.library_revisions.sort((a, b) => b.revision.localeCompare(a.revision));
  const [parent, annexes] = await Promise.all([
    doc.parent_id ? supabase.from("library_documents").select("id, doc_code, title").eq("id", doc.parent_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("library_documents").select("id, doc_code, title").eq("parent_id", doc.id).order("doc_code"),
  ]);
  return { doc, parent: (parent.data as { id: string; doc_code: string; title: string } | null) ?? null, annexes: (annexes.data ?? []) as { id: string; doc_code: string; title: string }[] };
}

/** Modelos técnicos do sistema gerados a partir deste arquivo (mesmo SHA-256) — RF-21. */
export async function templatesBySha(shas: string[]): Promise<Record<string, string[]>> {
  if (!shas.length) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("document_templates").select("template_code, technical_version, source_sha256").in("source_sha256", shas);
  const out: Record<string, string[]> = {};
  for (const t of data ?? []) (out[t.source_sha256] ??= []).push(`${t.template_code} ${t.technical_version}`);
  return out;
}

export async function listParentOptions(): Promise<{ id: string; label: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("library_documents").select("id, doc_code, title").eq("kind", "documento").order("doc_code");
  return (data ?? []).map((d) => ({ id: d.id, label: `${d.doc_code} — ${d.title}` }));
}

/** Revisão vigente; senão a mais recente. */
export function currentRevision(d: LibDocument): LibRevision | null {
  const revs = [...d.library_revisions].sort((a, b) => b.revision.localeCompare(a.revision));
  return revs.find((r) => r.status === "vigente") ?? revs.find((r) => r.status === "rascunho") ?? revs[0] ?? null;
}
