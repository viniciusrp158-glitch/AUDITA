import "server-only";
/**
 * Ficha 360° do cliente (Frente A, A6): uma linha do tempo única com a prospecção (lead e contatos), as demandas e seus
 * contatos/mudanças de situação, as propostas emitidas e decididas, os serviços contratados e ordens de serviço, e os
 * lançamentos do caixa. Tudo pelas permissões (RLS) de quem consulta: o operador não vê serviços nem caixa, que são
 * só do administrador. Nada é gravado aqui.
 */
import { DEMAND_STATUS, EVENT_TYPES as DEMAND_EVENT_TYPES, type DemandStatus } from "@/lib/demands/labels";
import { CONTRACT_STATUS, ORDER_STATUS, type ContractStatus, type OrderStatus } from "@/lib/execucao/labels";
import { formatBRL } from "@/lib/pricing/engine";
import { REVISION_STATUS, type RevisionStatus } from "@/lib/pricing/labels";
import { KIND_LABEL, OUTCOME_LABEL, STAGE_LABEL, type ActivityKind, type Outcome, type Stage } from "@/lib/prospect/labels";
import { createClient } from "@/lib/supabase/server";

export type TimelineKind = "prospeccao" | "demanda" | "proposta" | "servico" | "financeiro";
export const TIMELINE_KINDS: Record<TimelineKind, string> = {
  prospeccao: "Prospecção",
  demanda: "Demandas",
  proposta: "Propostas",
  servico: "Serviços",
  financeiro: "Caixa",
};

export type TimelineEvent = {
  kind: TimelineKind;
  /** Instante para ordenar (ISO). */
  at: string;
  /** true quando a origem é só a data (sem hora). */
  dayOnly: boolean;
  title: string;
  detail?: string;
  href?: string;
};

export type ClientSummary = {
  openDemands: number;
  quotes: number;
  acceptedRevisions: number;
  activeContracts: number;
  lastContact: string | null;
};

const LIMIT = 200;
/** Data sem hora → meio-dia de São Paulo, só para ordenar junto com os horários. */
const dayAt = (d: string) => `${d.slice(0, 10)}T12:00:00-03:00`;
const money = (once: string | null, monthly: string | null) =>
  [once && Number(once) > 0 && `${formatBRL(once)} único`, monthly && Number(monthly) > 0 && `${formatBRL(monthly)}/mês`].filter(Boolean).join(" + ");

export async function getClientTimeline(clientId: string): Promise<{ events: TimelineEvent[]; summary: ClientSummary; truncated: boolean }> {
  const supabase = await createClient();
  const [leadsQ, demandsQ, quotesQ, contractsQ, cashQ] = await Promise.all([
    supabase.from("leads").select("id, legal_name, trade_name, stage, created_at").eq("client_id", clientId).limit(20),
    supabase.from("demands").select("id, demand_code, summary, status, received_on, closed_at").eq("client_id", clientId).limit(LIMIT),
    supabase.from("quotes").select("id, quote_code, demand_id").eq("client_id", clientId).limit(LIMIT),
    supabase.from("service_contracts").select("id, contract_code, scope_summary, status, starts_on, created_at").eq("client_id", clientId).limit(LIMIT),
    supabase.from("cash_entries").select("id, kind, amount, occurred_on, description, status").eq("client_id", clientId).limit(LIMIT),
  ]);
  const leads = leadsQ.data ?? [];
  const demands = demandsQ.data ?? [];
  const quotes = quotesQ.data ?? [];
  const contracts = contractsQ.data ?? [];
  const cash = cashQ.data ?? [];

  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
  const none = Promise.resolve({ data: [] as never[] });
  const [actsQ, devQ, revsQ, ordersQ] = await Promise.all([
    leads.length
      ? supabase.from("lead_activities").select("lead_id, kind, outcome, note, occurred_at").in("lead_id", ids(leads)).order("occurred_at", { ascending: false }).limit(LIMIT)
      : none,
    demands.length
      ? supabase.from("demand_events").select("demand_id, event_type, occurred_on, description, to_status, created_at").in("demand_id", ids(demands)).in("event_type", ["contato", "visita", "situacao"]).order("created_at", { ascending: false }).limit(LIMIT)
      : none,
    quotes.length
      ? supabase.from("quote_revisions").select("quote_id, revision_number, status, emitted_at, decided_at, total_once, total_monthly").in("quote_id", ids(quotes)).not("emitted_at", "is", null).limit(LIMIT)
      : none,
    contracts.length
      ? supabase.from("service_orders").select("id, order_code, contract_id, scheduled_start, status, created_at").in("contract_id", ids(contracts)).limit(LIMIT)
      : none,
  ]);

  const ev: TimelineEvent[] = [];
  const leadName = new Map(leads.map((l) => [l.id, l.trade_name || l.legal_name]));
  for (const l of leads)
    ev.push({
      kind: "prospeccao",
      at: l.created_at,
      dayOnly: false,
      title: "Entrou na prospecção",
      detail: `${leadName.get(l.id)} · etapa atual: ${STAGE_LABEL[l.stage as Stage] ?? l.stage}`,
      href: `/prospeccao/leads/${l.id}`,
    });
  for (const a of (actsQ.data ?? []) as { lead_id: string; kind: string; outcome: string | null; note: string | null; occurred_at: string }[])
    ev.push({
      kind: "prospeccao",
      at: a.occurred_at,
      dayOnly: false,
      title: `Contato da prospecção — ${KIND_LABEL[a.kind as ActivityKind] ?? a.kind}`,
      detail: [a.outcome && (OUTCOME_LABEL[a.outcome as Outcome] ?? a.outcome), a.note].filter(Boolean).join(" · ") || undefined,
      href: `/prospeccao/leads/${a.lead_id}`,
    });

  const demand = new Map(demands.map((d) => [d.id, d]));
  for (const d of demands) {
    ev.push({ kind: "demanda", at: dayAt(d.received_on), dayOnly: true, title: `Demanda recebida — ${d.demand_code}`, detail: d.summary, href: `/demandas/${d.id}` });
    if (d.closed_at)
      ev.push({
        kind: "demanda",
        at: d.closed_at,
        dayOnly: false,
        title: `Demanda ${DEMAND_STATUS[d.status as DemandStatus]?.label.toLowerCase() ?? "encerrada"} — ${d.demand_code}`,
        detail: d.summary,
        href: `/demandas/${d.id}`,
      });
  }
  for (const e of (devQ.data ?? []) as { demand_id: string; event_type: string; occurred_on: string; description: string; to_status: string | null; created_at: string }[]) {
    const d = demand.get(e.demand_id);
    if (!d) continue;
    // O encerramento já aparece pela data de fechamento da demanda
    if (e.event_type === "situacao" && d.closed_at && e.to_status === d.status) continue;
    ev.push({
      kind: "demanda",
      at: e.event_type === "situacao" ? e.created_at : dayAt(e.occurred_on),
      dayOnly: e.event_type !== "situacao",
      title:
        e.event_type === "situacao"
          ? `${d.demand_code}: situação ${DEMAND_STATUS[e.to_status as DemandStatus]?.label ?? e.to_status}`
          : `${DEMAND_EVENT_TYPES[e.event_type as keyof typeof DEMAND_EVENT_TYPES]} — ${d.demand_code}`,
      detail: e.description,
      href: `/demandas/${d.id}`,
    });
  }

  const quote = new Map(quotes.map((q) => [q.id, q]));
  let accepted = 0;
  for (const r of (revsQ.data ?? []) as {
    quote_id: string;
    revision_number: number;
    status: RevisionStatus;
    emitted_at: string;
    decided_at: string | null;
    total_once: string | null;
    total_monthly: string | null;
  }[]) {
    const q = quote.get(r.quote_id);
    if (!q) continue;
    const label = `${q.quote_code} Rev.${String(r.revision_number).padStart(2, "0")}`;
    const value = money(r.total_once, r.total_monthly) || undefined;
    ev.push({ kind: "proposta", at: r.emitted_at, dayOnly: false, title: `Proposta emitida — ${label}`, detail: value, href: `/orcamentos/${q.id}` });
    if (r.status === "aceita") accepted++;
    if (r.decided_at && (r.status === "aceita" || r.status === "recusada"))
      ev.push({ kind: "proposta", at: r.decided_at, dayOnly: false, title: `Proposta ${REVISION_STATUS[r.status].label.toLowerCase()} — ${label}`, detail: value, href: `/orcamentos/${q.id}` });
  }

  for (const c of contracts)
    ev.push({
      kind: "servico",
      at: c.created_at,
      dayOnly: false,
      title: `Serviço contratado — ${c.contract_code}`,
      detail: [c.scope_summary, `situação: ${CONTRACT_STATUS[c.status as ContractStatus]?.label ?? c.status}`].filter(Boolean).join(" · "),
      href: `/demandas/servicos/${c.id}`,
    });
  for (const o of (ordersQ.data ?? []) as { id: string; order_code: string; contract_id: string; scheduled_start: string | null; status: string; created_at: string }[])
    ev.push({
      kind: "servico",
      at: o.scheduled_start ? dayAt(o.scheduled_start) : o.created_at,
      dayOnly: Boolean(o.scheduled_start),
      title: `Ordem de serviço — ${o.order_code}`,
      detail: ORDER_STATUS[o.status as OrderStatus]?.label ?? o.status,
      href: `/demandas/servicos/${o.contract_id}/os/${o.id}`,
    });

  for (const m of cash)
    ev.push({
      kind: "financeiro",
      at: dayAt(m.occurred_on),
      dayOnly: true,
      title: `${m.kind === "recebimento" ? "Recebimento" : "Pagamento"} ${formatBRL(m.amount)}${m.status === "estornado" ? " (estornado)" : ""}`,
      detail: m.description,
      href: "/caixa",
    });

  ev.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const contacts = ev.filter((e) => e.title.startsWith("Contato") || e.title.startsWith("Visita"));
  return {
    events: ev.slice(0, LIMIT),
    truncated: ev.length > LIMIT,
    summary: {
      openDemands: demands.filter((d) => DEMAND_STATUS[d.status as DemandStatus]?.open).length,
      quotes: quotes.length,
      acceptedRevisions: accepted,
      activeContracts: contracts.filter((c) => ["planejado", "em_execucao", "suspenso"].includes(c.status)).length,
      lastContact: contacts[0]?.at ?? null,
    },
  };
}

export type ClientQuote = { id: string; quote_code: string; status: string; updated_at: string; demands: { demand_code: string; summary: string } | null };

/** Orçamentos do cliente (aba "Demandas e propostas"). */
export async function getClientQuotes(clientId: string): Promise<ClientQuote[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select("id, quote_code, status, updated_at, demands(demand_code, summary)")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as ClientQuote[];
}
