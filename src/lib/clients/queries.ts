import "server-only";
import { notFound } from "next/navigation";
import { taxIdSearchDigits } from "@/lib/br";
import { createClient } from "@/lib/supabase/server";

export type Client = {
  id: string;
  client_code: string;
  person_type: "PJ" | "PF";
  legal_name: string;
  trade_name: string | null;
  tax_id: string | null;
  cnae: string | null;
  segment: string | null;
  email: string | null;
  phone: string | null;
  address_zip: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  notes: string | null;
  status: "ativo" | "inativo";
  inactivated_at: string | null;
  inactivation_reason: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientUnit = {
  id: string;
  client_id: string;
  name: string;
  tax_id: string | null;
  address_zip: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  local_contact: string | null;
  notes: string | null;
  status: "ativo" | "inativo";
};

export type ClientContact = {
  id: string;
  client_id: string;
  unit_id: string | null;
  full_name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  purpose: string | null;
  status: "ativo" | "inativo";
};

export type ClientListRow = Pick<
  Client,
  "id" | "client_code" | "legal_name" | "trade_name" | "tax_id" | "segment" | "address_city" | "address_state" | "status" | "is_test"
>;

export const PAGE_SIZE = 25;

/** Normaliza o termo de busca como o banco (minúsculas, sem acento) e remove caracteres especiais. */
export function normalizeSearch(q: string): string {
  return q
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function listClients({
  q,
  situacao,
  page,
}: {
  q?: string;
  situacao?: string;
  page: number;
}): Promise<{ rows: ClientListRow[]; total: number; error: boolean }> {
  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("id, client_code, legal_name, trade_name, tax_id, segment, address_city, address_state, status, is_test", {
      count: "exact",
    })
    .order("legal_name", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (situacao === "inativos") query = query.eq("status", "inativo");
  else if (situacao !== "todos") query = query.eq("status", "ativo");

  const term = normalizeSearch(q ?? "");
  if (term) {
    const digits = taxIdSearchDigits(q);
    const filters = [`search_text.ilike."%${term}%"`];
    if (digits) filters.push(`tax_id.ilike."%${digits}%"`);
    query = query.or(filters.join(","));
  }

  const { data, count, error } = await query;
  return { rows: (data ?? []) as ClientListRow[], total: count ?? 0, error: Boolean(error) };
}

export async function getClientOr404(id: string): Promise<Client> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return data as Client;
}

export async function getClientChildren(id: string) {
  const supabase = await createClient();
  const [units, contacts] = await Promise.all([
    supabase.from("client_units").select("*").eq("client_id", id).order("status").order("name"),
    supabase.from("client_contacts").select("*").eq("client_id", id).order("status").order("is_primary", { ascending: false }).order("full_name"),
  ]);
  return {
    units: (units.data ?? []) as ClientUnit[],
    contacts: (contacts.data ?? []) as ClientContact[],
  };
}

export type HistoryRow = {
  id: number;
  occurred_at: string;
  action: string;
  entity: string;
  summary: Record<string, unknown>;
};

export async function getClientHistory(id: string): Promise<HistoryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, occurred_at, action, entity, summary")
    .eq("parent_entity_id", id)
    .order("id", { ascending: false })
    .limit(100);
  return (data ?? []) as HistoryRow[];
}

export async function countPendingRequests(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("client_registration_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendente");
  return count ?? 0;
}
