import "server-only";
import { notFound } from "next/navigation";
import { normalizeSearch } from "@/lib/clients/queries";
import { createClient } from "@/lib/supabase/server";
import type { QuoteSnapshot } from "@/lib/documents/snapshot";
import type { ParamStatus, Periodicity, QuoteStatus, RevisionStatus } from "./labels";
import type { ParameterValues, ServiceInfo } from "./quote";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ParameterSet = ParameterValues & {
  id: string;
  version: number;
  label: string;
  status: ParamStatus;
  reference_date: string | null;
  validated_by: string | null;
  notes: string | null;
  is_test: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const PARAM_COLS =
  "id, version, label, status, pro_labore, fixed_costs, billable_hours, taxes, payment_fees, commission, contingency, target_margin, max_discount, reference_date, validated_by, notes, is_test, published_at, created_at, updated_at";

export async function listParameterSets(): Promise<ParameterSet[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("pricing_parameter_sets").select(PARAM_COLS).order("version", { ascending: false });
  // Vigente primeiro, depois rascunhos e, por fim, substituídas da mais recente para a mais antiga
  const rank = { vigente: 0, rascunho: 1, substituido: 2 } as const;
  return ((data ?? []) as ParameterSet[]).sort(
    (a, b) => rank[a.status] - rank[b.status] || (b.published_at ?? "").localeCompare(a.published_at ?? "") || b.version - a.version,
  );
}

export async function getParameterSetOr404(id: string): Promise<ParameterSet> {
  if (!uuidRe.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("pricing_parameter_sets").select(PARAM_COLS).eq("id", id).maybeSingle();
  if (!data) notFound();
  return data as ParameterSet;
}

export async function getVigenteParameterSet(): Promise<ParameterSet | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("pricing_parameter_sets").select(PARAM_COLS).eq("status", "vigente").maybeSingle();
  return (data as ParameterSet | null) ?? null;
}

export type QuoteItem = {
  id: string;
  position: number;
  service_id: string | null;
  description: string;
  periodicity: Periodicity;
  quantity_ref: string | null;
  hours_preparation: string | null;
  hours_execution: string | null;
  hours_delivery: string | null;
  hours_followup: string | null;
  hours_travel: string | null;
  cost_travel: string | null;
  cost_materials: string | null;
  cost_external: string | null;
  cost_other: string | null;
  contingency: string | null;
  margin: string | null;
  discount: string | null;
  discount_reason: string | null;
  scope_notes: string | null;
  services: (NonNullable<ServiceInfo> & { service_code: string; name: string }) | null;
};

export type Quote = {
  id: string;
  quote_code: string;
  demand_id: string;
  client_id: string;
  parameter_set_id: string | null;
  status: QuoteStatus;
  validity_days: number | null;
  payment_terms: string | null;
  notes: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
  current_revision_id: string | null;
  document_model: "ANX01" | "ANX02";
  objective: string | null;
  scope_included: string | null;
  scope_excluded: string | null;
  location_modality: string | null;
  schedule: string | null;
  methodology: string | null;
  deliverables: string | null;
  completion_criteria: string | null;
  additional_expenses: string | null;
  cancellation_terms: string | null;
  next_step: string | null;
  demands: { id: string; demand_code: string; summary: string; status: string; service_id: string | null };
  clients: { id: string; client_code: string; legal_name: string; trade_name: string | null; status: string };
  pricing_parameter_sets: ParameterSet | null;
};

export const CONTENT_COLS =
  "document_model, objective, scope_included, scope_excluded, location_modality, schedule, methodology, deliverables, completion_criteria, additional_expenses, cancellation_terms, next_step";

const ITEM_COLS =
  "id, position, service_id, description, periodicity, quantity_ref, hours_preparation, hours_execution, hours_delivery, hours_followup, hours_travel, cost_travel, cost_materials, cost_external, cost_other, contingency, margin, discount, discount_reason, scope_notes, services(service_code, name, pricing_model, commercial_status, catalog_status)";

export async function getQuoteOr404(id: string): Promise<{ quote: Quote; items: QuoteItem[] }> {
  if (!uuidRe.test(id)) notFound();
  const supabase = await createClient();
  const [q, items] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        `id, quote_code, demand_id, client_id, parameter_set_id, status, validity_days, payment_terms, notes, is_test, created_at, updated_at,
         current_revision_id, ${CONTENT_COLS},
         demands(id, demand_code, summary, status, service_id),
         clients(id, client_code, legal_name, trade_name, status),
         pricing_parameter_sets!quotes_parameter_set_id_fkey(${PARAM_COLS})`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("quote_items").select(ITEM_COLS).eq("quote_id", id).order("position").order("created_at"),
  ]);
  if (!q.data) notFound();
  return { quote: q.data as unknown as Quote, items: (items.data ?? []) as unknown as QuoteItem[] };
}

export async function getQuoteByDemand(demandId: string): Promise<{ id: string; quote_code: string; status: QuoteStatus } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("quotes").select("id, quote_code, status").eq("demand_id", demandId).maybeSingle();
  return (data as { id: string; quote_code: string; status: QuoteStatus } | null) ?? null;
}

export type QuoteListRow = {
  id: string;
  quote_code: string;
  status: QuoteStatus;
  is_test: boolean;
  updated_at: string;
  demands: { demand_code: string; summary: string } | null;
  clients: { client_code: string; legal_name: string; trade_name: string | null } | null;
  quote_items: { count: number }[];
};

export const QUOTES_PAGE_SIZE = 25;

export async function listQuotes({ q, page }: { q?: string; page: number }): Promise<{ rows: QuoteListRow[]; total: number; error: boolean }> {
  const supabase = await createClient();
  let query = supabase
    .from("quotes")
    .select(
      "id, quote_code, status, is_test, updated_at, demands(demand_code, summary), clients(client_code, legal_name, trade_name), quote_items(count)",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range((page - 1) * QUOTES_PAGE_SIZE, page * QUOTES_PAGE_SIZE - 1);
  const term = normalizeSearch(q ?? "");
  if (term) {
    // Código da cotação, código/resumo da demanda ou cadastro do cliente
    const [{ data: clients }, { data: demands }] = await Promise.all([
      supabase.from("clients").select("id").ilike("search_text", `%${term}%`).limit(200),
      supabase.from("demands").select("id").ilike("search_text", `%${term}%`).limit(200),
    ]);
    const filters = [`quote_code.ilike."%${term}%"`];
    const cids = (clients ?? []).map((c) => c.id);
    const dids = (demands ?? []).map((d) => d.id);
    if (cids.length) filters.push(`client_id.in.(${cids.join(",")})`);
    if (dids.length) filters.push(`demand_id.in.(${dids.join(",")})`);
    query = query.or(filters.join(","));
  }

  const { data, count, error } = await query;
  return { rows: (data ?? []) as unknown as QuoteListRow[], total: count ?? 0, error: Boolean(error) };
}

export type ServiceOption = {
  id: string;
  label: string;
  family: string;
  pricing_model: string;
  commercial_status: string;
  catalog_status: string;
};

export async function getServiceOptions(): Promise<ServiceOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("id, service_code, name, family, pricing_model, commercial_status, catalog_status")
    .order("service_code");
  return (data ?? []).map((s) => ({
    id: s.id,
    label: `${s.service_code} — ${s.name}`,
    family: s.family,
    pricing_model: s.pricing_model,
    commercial_status: s.commercial_status,
    catalog_status: s.catalog_status,
  }));
}

export type GeneratedDocument = {
  id: string;
  kind: "docx" | "pdf";
  file_name: string;
  size_bytes: number;
  sha256: string;
  watermark: boolean;
  created_at: string;
};

export type QuoteRevision = {
  id: string;
  revision_number: number;
  status: RevisionStatus;
  snapshot: QuoteSnapshot;
  total_once: string | null;
  total_monthly: string | null;
  reason: string | null;
  reviewed_at: string;
  document_model: "ANX01" | "ANX02" | null;
  is_test_document: boolean | null;
  emitted_at: string | null;
  valid_until: string | null;
  decided_at: string | null;
  accepted_on: string | null;
  accepted_by_name: string | null;
  decision_reference: string | null;
  decision_note: string | null;
  superseded_at: string | null;
  generated_documents: GeneratedDocument[];
};

export async function listRevisions(quoteId: string): Promise<QuoteRevision[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quote_revisions")
    .select(
      "id, revision_number, status, snapshot, total_once, total_monthly, reason, reviewed_at, document_model, is_test_document, emitted_at, valid_until, decided_at, accepted_on, accepted_by_name, decision_reference, decision_note, superseded_at, generated_documents(id, kind, file_name, size_bytes, sha256, watermark, created_at)",
    )
    .eq("quote_id", quoteId)
    .order("revision_number", { ascending: false });
  return (data ?? []) as unknown as QuoteRevision[];
}

export async function getReviewBlockers(quoteId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("quote_review_blockers", { p_quote_id: quoteId });
  return (data as string[] | null) ?? [];
}

export async function getEmissionBlockers(revisionId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("revision_emission_blockers", { p_revision_id: revisionId });
  return (data as string[] | null) ?? [];
}

export async function getVigenteTemplate(code: "AUDDOC010-ANX01" | "AUDDOC010-ANX02") {
  const supabase = await createClient();
  const { data } = await supabase
    .from("document_templates")
    .select("id, template_code, model_code, document_revision, technical_version")
    .eq("template_code", code)
    .eq("status", "vigente")
    .maybeSingle();
  return data as { id: string; template_code: string; model_code: string; document_revision: string; technical_version: string } | null;
}
