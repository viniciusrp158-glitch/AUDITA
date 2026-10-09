import "server-only";
import { notFound } from "next/navigation";
import { normalizeSearch } from "@/lib/clients/queries";
import type { CommercialStatus } from "@/lib/services/labels";
import { createClient } from "@/lib/supabase/server";
import { CLOSED_STATUSES, DEMAND_STATUS_KEYS, OPEN_STATUSES, type DemandStatus, type EventType, type Origin } from "./labels";

export const PAGE_SIZE = 25;

type ClientRef = { id: string; client_code: string; legal_name: string; trade_name: string | null; status: string };
type ServiceRef = { id: string; service_code: string; name: string; commercial_status: CommercialStatus; catalog_status: string };

export type DemandListRow = {
  id: string;
  demand_code: string;
  summary: string;
  status: DemandStatus;
  received_on: string;
  due_on: string | null;
  is_recurring: boolean;
  is_test: boolean;
  clients: Pick<ClientRef, "id" | "client_code" | "legal_name" | "trade_name"> | null;
  services: Pick<ServiceRef, "service_code" | "name"> | null;
};

export type Demand = {
  id: string;
  demand_code: string;
  client_id: string;
  unit_id: string | null;
  contact_id: string | null;
  service_id: string | null;
  origin: Origin;
  summary: string;
  description: string | null;
  location: string | null;
  received_on: string;
  due_on: string | null;
  is_recurring: boolean;
  viability_checked: boolean;
  viability_notes: string | null;
  status: DemandStatus;
  status_changed_at: string;
  closed_at: string | null;
  notes: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
  clients: ClientRef;
  client_units: { id: string; name: string } | null;
  client_contacts: { id: string; full_name: string; role_title: string | null; email: string | null; phone: string | null } | null;
  services: ServiceRef | null;
};

export type DemandEvent = {
  id: number;
  event_type: EventType;
  occurred_on: string;
  description: string;
  from_status: DemandStatus | null;
  to_status: DemandStatus | null;
  created_at: string;
};

export async function listDemands({
  q,
  grupo,
  situacao,
  page,
  clientId,
}: {
  q?: string;
  grupo?: "abertas" | "encerradas" | "todas";
  situacao?: string;
  page: number;
  clientId?: string;
}): Promise<{ rows: DemandListRow[]; total: number; error: boolean }> {
  const supabase = await createClient();
  let query = supabase
    .from("demands")
    .select(
      "id, demand_code, summary, status, received_on, due_on, is_recurring, is_test, clients(id, client_code, legal_name, trade_name), services(service_code, name)",
      { count: "exact" },
    )
    .order("received_on", { ascending: false })
    .order("demand_code", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (clientId) query = query.eq("client_id", clientId);
  if (situacao && (DEMAND_STATUS_KEYS as string[]).includes(situacao)) query = query.eq("status", situacao);
  else if (grupo === "abertas") query = query.in("status", OPEN_STATUSES);
  else if (grupo === "encerradas") query = query.in("status", CLOSED_STATUSES);

  const term = normalizeSearch(q ?? "");
  if (term) {
    // Busca no código/resumo da demanda e no cadastro do cliente (nome, código, documento)
    const { data: clients } = await supabase.from("clients").select("id").ilike("search_text", `%${term}%`).limit(200);
    const ids = (clients ?? []).map((c) => c.id);
    const filters = [`search_text.ilike."%${term}%"`];
    if (ids.length) filters.push(`client_id.in.(${ids.join(",")})`);
    query = query.or(filters.join(","));
  }

  const { data, count, error } = await query;
  return { rows: (data ?? []) as unknown as DemandListRow[], total: count ?? 0, error: Boolean(error) };
}

export async function getDemandOr404(id: string): Promise<Demand> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("demands")
    .select(
      "*, clients(id, client_code, legal_name, trade_name, status), client_units(id, name), client_contacts(id, full_name, role_title, email, phone), services(id, service_code, name, commercial_status, catalog_status)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  return data as unknown as Demand;
}

export async function getDemandEvents(id: string): Promise<DemandEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("demand_events")
    .select("id, event_type, occurred_on, description, from_status, to_status, created_at")
    .eq("demand_id", id)
    .order("id", { ascending: false })
    .limit(200);
  return (data ?? []) as DemandEvent[];
}

export type FormOptions = {
  clients: { id: string; label: string; is_test: boolean }[];
  services: { id: string; label: string; family: string; commercial_status: CommercialStatus; catalog_status: string }[];
};

/** Opções do formulário: clientes ativos e catálogo (serviços não liberados aparecem sinalizados). */
export async function getDemandFormOptions(includeClientId?: string | null): Promise<FormOptions> {
  const supabase = await createClient();
  let clientsQuery = supabase.from("clients").select("id, client_code, legal_name, trade_name, is_test, status").order("legal_name");
  clientsQuery = includeClientId ? clientsQuery.or(`status.eq.ativo,id.eq.${includeClientId}`) : clientsQuery.eq("status", "ativo");
  const [clients, services] = await Promise.all([
    clientsQuery.limit(1000),
    supabase.from("services").select("id, service_code, name, family, commercial_status, catalog_status").order("service_code"),
  ]);
  return {
    clients: (clients.data ?? []).map((c) => ({
      id: c.id,
      label: `${c.client_code} — ${c.legal_name}${c.trade_name ? ` (${c.trade_name})` : ""}`,
      is_test: c.is_test,
    })),
    services: (services.data ?? []).map((s) => ({
      id: s.id,
      label: `${s.service_code} — ${s.name}`,
      family: s.family,
      commercial_status: s.commercial_status,
      catalog_status: s.catalog_status,
    })),
  };
}

export async function countDemandsByClient(clientId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("demands").select("id", { count: "exact", head: true }).eq("client_id", clientId);
  return count ?? 0;
}
