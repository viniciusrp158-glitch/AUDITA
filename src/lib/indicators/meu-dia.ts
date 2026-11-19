/**
 * "Meu dia" do Início (Frente A, A5): o que pede ação hoje, em listas curtas com atalho para cada registro.
 * Retornos da prospecção (atrasados e de hoje), demandas com prazo vencido ou paradas aguardando o cliente, propostas
 * emitidas vencidas ou a vencer em 7 dias e leads que entraram no funil nos últimos 7 dias. Só leitura, pela RLS.
 */
import "server-only";
import { waitingCutoffIso } from "@/lib/demands/labels";
import { isMobile, isStage, STAGE_LABEL } from "@/lib/prospect/labels";
import { createClient } from "@/lib/supabase/server";

export type DayItem = {
  href: string;
  title: string;
  detail: string;
  when: string;
  late: boolean;
  /** Contato confirmado do lead (retornos): ligação e WhatsApp com um toque, sem abrir a ficha. */
  phone?: string | null;
  whatsapp?: string | null;
};
export type MyDay = {
  followUps: DayItem[];
  followUpsTotal: number;
  demands: DayItem[];
  demandsTotal: number;
  proposals: DayItem[];
  proposalsTotal: number;
  newLeads: number;
};

const LIST = 6;
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const clientName = (c: unknown) => (c && typeof c === "object" && "legal_name" in c ? String((c as { legal_name: string }).legal_name) : "");

export async function getMyDay(today: string, includeTest: boolean): Promise<MyDay> {
  const supabase = await createClient();
  // Fim do dia em São Paulo (UTC−3, sem horário de verão desde 2019)
  const endOfToday = `${addDays(today, 1)}T03:00:00Z`;
  const startOfToday = `${today}T03:00:00Z`;
  const in7 = addDays(today, 7);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  let followQ = supabase
    .from("leads")
    .select("id, legal_name, trade_name, stage, next_action_at, next_action_note, phone_confirmed, whatsapp_confirmed", { count: "exact" })
    .eq("status", "ativo")
    .not("next_action_at", "is", null)
    .lt("next_action_at", endOfToday)
    .order("next_action_at")
    .limit(LIST);
  let overdueQ = supabase
    .from("demands")
    .select("id, demand_code, summary, due_on, clients(legal_name)", { count: "exact" })
    .not("status", "in", "(encerrada,nao_viavel,cancelada)")
    .lt("due_on", today)
    .order("due_on")
    .limit(LIST);
  let waitingQ = supabase
    .from("demands")
    .select("id, demand_code, summary, status_changed_at, clients(legal_name)", { count: "exact" })
    .eq("status", "aguardando_cliente")
    .lt("status_changed_at", waitingCutoffIso())
    .order("status_changed_at")
    .limit(LIST);
  let propQ = supabase
    .from("quote_revisions")
    .select("id, valid_until, quotes!inner(id, quote_code, status, clients(legal_name))", { count: "exact" })
    .eq("status", "emitida")
    .eq("quotes.status", "emitida")
    .lte("valid_until", in7)
    .order("valid_until")
    .limit(LIST);
  let newQ = supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "ativo").gte("created_at", weekAgo);
  if (!includeTest) {
    followQ = followQ.eq("is_test", false);
    overdueQ = overdueQ.eq("is_test", false);
    waitingQ = waitingQ.eq("is_test", false);
    propQ = propQ.eq("is_test", false);
    newQ = newQ.eq("is_test", false);
  }
  const [follow, overdue, waiting, prop, fresh] = await Promise.all([followQ, overdueQ, waitingQ, propQ, newQ]);

  const followUps: DayItem[] = (follow.data ?? []).map((l) => ({
    href: `/prospeccao/leads/${l.id}`,
    title: l.trade_name || l.legal_name,
    detail: l.next_action_note || (isStage(l.stage) ? STAGE_LABEL[l.stage] : ""),
    when: l.next_action_at!,
    late: l.next_action_at! < startOfToday,
    phone: l.phone_confirmed,
    whatsapp: l.whatsapp_confirmed ?? (isMobile(l.phone_confirmed) ? l.phone_confirmed : null),
  }));

  const demands: DayItem[] = [
    ...(overdue.data ?? []).map((d) => ({
      href: `/demandas/${d.id}`,
      title: `${d.demand_code} — ${d.summary}`,
      detail: `${clientName(d.clients)} · prazo vencido`,
      when: d.due_on!,
      late: true,
    })),
    ...(waiting.data ?? []).map((d) => ({
      href: `/demandas/${d.id}`,
      title: `${d.demand_code} — ${d.summary}`,
      detail: `${clientName(d.clients)} · aguardando o cliente`,
      when: d.status_changed_at,
      late: false,
    })),
  ];
  const seen = new Set<string>();
  const uniqueDemands = demands.filter((d) => !seen.has(d.href) && (seen.add(d.href), true)).slice(0, LIST);

  const proposals: DayItem[] = (prop.data ?? []).map((r) => {
    const q = r.quotes as unknown as { id: string; quote_code: string; clients: unknown };
    const late = r.valid_until! < today;
    return {
      href: `/orcamentos/${q.id}`,
      title: q.quote_code,
      detail: `${clientName(q.clients)} · ${late ? "validade vencida, sem decisão" : "vence em breve"}`,
      when: r.valid_until!,
      late,
    };
  });

  return {
    followUps,
    followUpsTotal: follow.count ?? followUps.length,
    demands: uniqueDemands,
    demandsTotal: (overdue.count ?? 0) + (waiting.count ?? 0),
    proposals,
    proposalsTotal: prop.count ?? proposals.length,
    newLeads: fresh.count ?? 0,
  };
}
