import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CommercialStatus } from "./labels";

export type Service = {
  id: string;
  service_code: string;
  kind: "servico" | "oferta";
  parent_id: string | null;
  name: string;
  family: string;
  norm: string | null;
  grouping: string | null;
  matrix_class: "A" | "B" | "C";
  matrix_class_label: string;
  priority: string | null;
  scope_preliminary: string | null;
  scope_limits: string | null;
  tst_compatibility: string | null;
  modality: string | null;
  evidence_required: string | null;
  technical_responsibility: string | null;
  legal_reference: string | null;
  official_url: string | null;
  docs_received: string;
  rt_confirmed: string;
  resources_confirmed: string;
  audita_notes: string | null;
  commercial_status: CommercialStatus;
  status_basis: string;
  status_reference: string | null;
  status_decided_at: string;
  pricing_model: "hora_tecnica" | "sem_modelo_definido";
  billing_unit_ref: string | null;
  catalog_status: "ativo" | "inativo";
  source_reference: string;
};

export type ServiceListRow = Pick<
  Service,
  "id" | "service_code" | "kind" | "parent_id" | "name" | "family" | "norm" | "matrix_class" | "commercial_status" | "catalog_status" | "pricing_model"
> & { parent_code: string | null };

export type StatusHistoryRow = {
  id: number;
  from_status: CommercialStatus | null;
  to_status: CommercialStatus;
  basis: string;
  reference: string | null;
  decided_at: string;
};

/** Ordenação do catálogo: serviço principal seguido das suas ofertas (ex.: TRN-005 → TRN-NR…). */
export function catalogOrder<T extends { id: string; service_code: string; parent_id: string | null }>(rows: T[]): T[] {
  const byCode = (a: T, b: T) => a.service_code.localeCompare(b.service_code, "pt-BR");
  const parents = rows.filter((r) => !r.parent_id).sort(byCode);
  const out: T[] = [];
  const parentIds = new Set(parents.map((p) => p.id));
  for (const p of parents) {
    out.push(p);
    out.push(...rows.filter((r) => r.parent_id === p.id).sort(byCode));
  }
  // Ofertas cujo serviço principal não está no recorte (ex.: filtro) aparecem no fim
  out.push(...rows.filter((r) => r.parent_id && !parentIds.has(r.parent_id)).sort(byCode));
  return out;
}

export async function listServices(): Promise<{ rows: ServiceListRow[]; error: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, service_code, kind, parent_id, name, family, norm, matrix_class, commercial_status, catalog_status, pricing_model");
  const rows = (data ?? []) as Omit<ServiceListRow, "parent_code">[];
  const codes = new Map(rows.map((r) => [r.id, r.service_code]));
  return {
    rows: catalogOrder(rows.map((r) => ({ ...r, parent_code: r.parent_id ? (codes.get(r.parent_id) ?? null) : null }))),
    error: Boolean(error),
  };
}

export async function getServiceOr404(id: string): Promise<{ service: Service; parentCode: string | null; offers: Pick<Service, "id" | "service_code" | "name" | "commercial_status">[] }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const service = data as Service;
  const [parent, offers] = await Promise.all([
    service.parent_id
      ? supabase.from("services").select("service_code").eq("id", service.parent_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("services").select("id, service_code, name, commercial_status").eq("parent_id", id).order("service_code"),
  ]);
  return {
    service,
    parentCode: (parent.data as { service_code: string } | null)?.service_code ?? null,
    offers: (offers.data ?? []) as Pick<Service, "id" | "service_code" | "name" | "commercial_status">[],
  };
}

export async function getStatusHistory(id: string): Promise<StatusHistoryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_status_history")
    .select("id, from_status, to_status, basis, reference, decided_at")
    .eq("service_id", id)
    .order("id", { ascending: false })
    .limit(100);
  return (data ?? []) as StatusHistoryRow[];
}
