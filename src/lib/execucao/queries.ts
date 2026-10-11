import "server-only";
import { notFound } from "next/navigation";
import type { ContractDocInput } from "@/lib/documents/contracts";
import type { QuoteSnapshot } from "@/lib/documents/snapshot";
import { createClient } from "@/lib/supabase/server";
import type { CashCategory, ChangeStatus, ContractStatus, EventType, OrderStatus } from "./labels";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ServiceContract = {
  id: string;
  contract_code: string;
  quote_id: string;
  revision_id: string;
  client_id: string;
  demand_id: string;
  modality: "pontual" | "recorrente";
  starts_on: string | null;
  ends_on: string | null;
  executor_name: string | null;
  executor_role: string | null;
  client_representative: string | null;
  scope_summary: string | null;
  deliverables: string | null;
  additional_conditions: string | null;
  notes: string | null;
  status: ContractStatus;
  status_note: string | null;
  status_changed_at: string;
  is_test: boolean;
  created_at: string;
  updated_at: string;
  clients?: { client_code: string; legal_name: string } | null;
  quotes?: { quote_code: string } | null;
  demands?: { demand_code: string } | null;
};

export type ContractEvent = {
  id: string;
  event_type: EventType;
  occurred_on: string;
  description: string;
  channel: string | null;
  recipient: string | null;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
};

export type ServiceOrder = {
  id: string;
  order_code: string;
  contract_id: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  time_window: string | null;
  location: string | null;
  executor_name: string | null;
  executor_role: string | null;
  client_contact: string | null;
  activities: { atividade: string; entrega?: string; condicao?: string }[];
  access_conditions: string | null;
  pending_conditions: string | null;
  status: OrderStatus;
  released_by_name: string | null;
  released_on: string | null;
  status_note: string | null;
  is_test: boolean;
  created_at: string;
};

export type ScopeChange = {
  id: string;
  change_code: string;
  contract_id: string;
  reason: string;
  activities_before: string | null;
  activities_after: string | null;
  deadline_before: string | null;
  deadline_after: string | null;
  value_before: string | null;
  value_after: string | null;
  deliverables_before: string | null;
  deliverables_after: string | null;
  client_approval: string | null;
  validated_by_name: string | null;
  validated_on: string | null;
  documents_update: string | null;
  status: ChangeStatus;
  status_note: string | null;
  is_test: boolean;
  created_at: string;
};

export type ContractDocument = {
  id: string;
  model: "M03" | "M04" | "M05" | "M06";
  source_id: string | null;
  reference: string;
  missing_fields: string[];
  watermark: string;
  generated_at: string;
  docx_path: string;
  pdf_path: string;
  docx_sha256: string;
  pdf_sha256: string;
};

export type CashEntry = {
  id: string;
  occurred_on: string;
  kind: "recebimento" | "pagamento";
  category: CashCategory;
  amount: string;
  description: string;
  counterparty: string | null;
  reference: string | null;
  client_id: string | null;
  contract_id: string | null;
  status: "lancado" | "estornado";
  reversal_reason: string | null;
  reversed_at: string | null;
  is_test: boolean;
  created_at: string;
};

const CONTRACT_SELECT = "*, clients(client_code, legal_name), quotes(quote_code), demands(demand_code)";

export async function listContracts(status?: string): Promise<ServiceContract[]> {
  const supabase = await createClient();
  let q = supabase.from("service_contracts").select(CONTRACT_SELECT).order("created_at", { ascending: false }).limit(200);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return (data ?? []) as ServiceContract[];
}

export async function getContractOr404(id: string): Promise<ServiceContract> {
  if (!uuidRe.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("service_contracts").select(CONTRACT_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  return data as ServiceContract;
}

export async function getContractByQuote(quoteId: string): Promise<{ id: string; contract_code: string; status: ContractStatus } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("service_contracts").select("id, contract_code, status").eq("quote_id", quoteId).maybeSingle();
  return (data as { id: string; contract_code: string; status: ContractStatus }) ?? null;
}

export async function listContractsByClient(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("service_contracts").select("id, contract_code, status, starts_on").eq("client_id", clientId).order("created_at", { ascending: false });
  return (data ?? []) as { id: string; contract_code: string; status: ContractStatus; starts_on: string | null }[];
}

export async function getContractDetail(id: string) {
  const supabase = await createClient();
  const [ev, os, alt, docs] = await Promise.all([
    supabase.from("service_contract_events").select("*").eq("contract_id", id).order("created_at", { ascending: false }),
    supabase.from("service_orders").select("*").eq("contract_id", id).order("created_at", { ascending: false }),
    supabase.from("scope_changes").select("*").eq("contract_id", id).order("created_at", { ascending: false }),
    supabase.from("contract_documents").select("*").eq("contract_id", id).order("generated_at", { ascending: false }),
  ]);
  return {
    events: (ev.data ?? []) as ContractEvent[],
    orders: (os.data ?? []) as ServiceOrder[],
    changes: (alt.data ?? []) as ScopeChange[],
    documents: (docs.data ?? []) as ContractDocument[],
  };
}

export async function getOrderOr404(contractId: string, orderId: string): Promise<ServiceOrder> {
  if (!uuidRe.test(orderId)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("service_orders").select("*").eq("id", orderId).eq("contract_id", contractId).maybeSingle();
  if (!data) notFound();
  return data as ServiceOrder;
}

export async function getChangeOr404(contractId: string, changeId: string): Promise<ScopeChange> {
  if (!uuidRe.test(changeId)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("scope_changes").select("*").eq("id", changeId).eq("contract_id", contractId).maybeSingle();
  if (!data) notFound();
  return data as ScopeChange;
}

/** Dados para os modelos M03–M06: cliente, proposta aceita (snapshot congelado) e proponente vigente congelado. */
export async function contractDocBase(c: ServiceContract): Promise<Omit<ContractDocInput, "issuedOn" | "test" | "order" | "change"> & { snapshot: QuoteSnapshot | null }> {
  const supabase = await createClient();
  const [{ data: rev }, { data: cl }, { data: vig }] = await Promise.all([
    supabase
      .from("quote_revisions")
      .select("revision_number, snapshot, total_once, total_monthly, accepted_on, accepted_by_name, decision_reference")
      .eq("id", c.revision_id)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("client_code, legal_name, tax_id, address_street, address_number, address_complement, address_district, address_city, address_state, address_zip")
      .eq("id", c.client_id)
      .maybeSingle(),
    // Contratada: dados institucionais vigentes na data do documento (I9.2); sem versão publicada ⇒ PENDENTE
    supabase.from("institutional_profiles").select("*").eq("status", "vigente").maybeSingle(),
  ]);
  const snap = (rev?.snapshot ?? null) as QuoteSnapshot | null;
  const addr = cl
    ? [
        [cl.address_street, cl.address_number].filter(Boolean).join(", "),
        cl.address_complement,
        cl.address_district,
        [cl.address_city, cl.address_state].filter(Boolean).join("/"),
        cl.address_zip ? `CEP ${String(cl.address_zip).replace(/^(\d{5})(\d{3})$/, "$1-$2")}` : null,
      ]
        .filter((x) => x && String(x).trim())
        .join(", ")
    : null;
  return {
    snapshot: snap,
    contract: {
      code: c.contract_code,
      modality: c.modality,
      starts_on: c.starts_on,
      ends_on: c.ends_on,
      executor_name: c.executor_name,
      executor_role: c.executor_role,
      client_representative: c.client_representative,
      scope_summary: c.scope_summary,
      deliverables: c.deliverables,
      additional_conditions: c.additional_conditions,
    },
    client: {
      code: cl?.client_code ?? "—",
      legal_name: cl?.legal_name ?? "—",
      tax_id: cl?.tax_id ?? null,
      address: addr || null,
      city_uf: cl ? [cl.address_city, cl.address_state].filter(Boolean).join("/") || null : null,
    },
    quote: {
      code: c.quotes?.quote_code ?? snap?.quote.code ?? "—",
      revision: rev?.revision_number ?? 0,
      accepted_on: rev?.accepted_on ?? null,
      accepted_by_name: rev?.accepted_by_name ?? null,
      decision_reference: rev?.decision_reference ?? null,
      total_once: rev?.total_once == null ? null : String(rev.total_once),
      total_monthly: rev?.total_monthly == null ? null : String(rev.total_monthly),
      schedule: snap?.quote.schedule ?? null,
      location_modality: snap?.quote.location_modality ?? null,
      scope_included: snap?.quote.scope_included ?? null,
      scope_excluded: snap?.quote.scope_excluded ?? null,
      service_codes: [...new Set((snap?.items ?? []).map((i) => i.service?.service_code).filter(Boolean))].join(", "),
    },
    proponent: (vig as ContractDocInput["proponent"]) ?? snap?.proponent ?? null,
  };
}

export async function listCashEntries(year: number): Promise<CashEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cash_entries")
    .select("*")
    .gte("occurred_on", `${year}-01-01`)
    .lte("occurred_on", `${year}-12-31`)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as CashEntry[];
}
