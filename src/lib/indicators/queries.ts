import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Indicators = {
  period: { from: string; to: string };
  include_test: boolean;
  clients_active: number;
  quotes_by_stage: Partial<Record<"rascunho" | "revisada" | "emitida" | "aceita" | "recusada" | "cancelada", number>>;
  quotes_open: number;
  quotes_open_now: number;
  quoted: { count: number; once: number | string; monthly: number | string };
  accepted: { count: number; once: number | string; monthly: number | string; avg_once: number | string | null; avg_monthly: number | string | null };
  decisions: { accepted: number; refused: number };
  conversion: number | string | null;
  demands: { pending: number; overdue: number; received: number };
};

/** Todos os números vêm da função do banco (AUDDOC017 §14), sob a RLS de quem consulta. */
export async function getIndicators(from: string, to: string, includeTest: boolean): Promise<Indicators | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_indicators", { p_from: from, p_to: to, p_include_test: includeTest });
  if (error || !data) return null;
  return data as Indicators;
}

export type Alert = { kind: "warning" | "info"; text: string; href: string };

/** Alertas úteis do Início (AUDDOC017 §4): parâmetros, propostas vencendo, prazos, cadastros e documentos pendentes. */
export async function getAlerts(today: string, includeTest: boolean): Promise<Alert[]> {
  const supabase = await createClient();
  const in7 = new Date(`${today}T12:00:00Z`);
  in7.setUTCDate(in7.getUTCDate() + 7);
  const limit = in7.toISOString().slice(0, 10);
  let expiringQ = supabase
    .from("quote_revisions")
    .select("id, quotes!inner(status)", { count: "exact", head: true })
    .eq("status", "emitida")
    .eq("quotes.status", "emitida")
    .gte("valid_until", today)
    .lte("valid_until", limit);
  let expiredQ = supabase
    .from("quote_revisions")
    .select("id, quotes!inner(status)", { count: "exact", head: true })
    .eq("status", "emitida")
    .eq("quotes.status", "emitida")
    .lt("valid_until", today);
  let overdueQ = supabase
    .from("demands")
    .select("id", { count: "exact", head: true })
    .not("status", "in", "(encerrada,nao_viavel,cancelada)")
    .lt("due_on", today);
  if (!includeTest) {
    expiringQ = expiringQ.eq("is_test", false);
    expiredQ = expiredQ.eq("is_test", false);
    overdueQ = overdueQ.eq("is_test", false);
  }

  const [vigente, expiring, expired, overdue, requests, drafts] = await Promise.all([
    supabase.from("pricing_parameter_sets").select("id", { count: "exact", head: true }).eq("status", "vigente"),
    expiringQ,
    expiredQ,
    overdueQ,
    supabase.from("client_registration_requests").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("library_revisions").select("id", { count: "exact", head: true }).eq("status", "rascunho"),
  ]);

  const out: Alert[] = [];
  if ((vigente.count ?? 0) === 0)
    out.push({ kind: "warning", text: "Parâmetros financeiros sem versão vigente: orçamentos ficam PENDENTE e sem preço.", href: "/configuracoes/parametros" });
  if (expired.count) out.push({ kind: "warning", text: `${expired.count} proposta(s) emitida(s) com validade vencida, sem decisão do cliente.`, href: "/orcamentos" });
  if (expiring.count) out.push({ kind: "info", text: `${expiring.count} proposta(s) vencem nos próximos 7 dias.`, href: "/orcamentos" });
  if (overdue.count) out.push({ kind: "warning", text: `${overdue.count} demanda(s) em aberto com prazo vencido.`, href: "/demandas" });
  if (requests.count) out.push({ kind: "info", text: `${requests.count} solicitação(ões) de cadastro aguardando análise.`, href: "/clientes/solicitacoes" });
  if (drafts.count) out.push({ kind: "info", text: `${drafts.count} documento(s) da biblioteca em rascunho, aguardando aprovação.`, href: "/biblioteca" });
  return out;
}

export type MonthlyRow = { key: string; label: string; from: string; to: string; ind: Indicators | null };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Evolução mensal para os gráficos: os `months` meses que terminam no mês de `endDate`.
 * Reaproveita a mesma função do banco de cada mês, para que gráfico e indicadores usem a mesma regra (CA-11).
 */
export async function getMonthlySeries(endDate: string, includeTest: boolean, months = 6): Promise<MonthlyRow[]> {
  const [y, m] = endDate.split("-").map(Number);
  const list = Array.from({ length: months }, (_, i) => {
    const first = new Date(Date.UTC(y, m - 1 - (months - 1 - i), 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return {
      key: iso(first).slice(0, 7),
      label: `${MESES[first.getUTCMonth()]}/${String(first.getUTCFullYear()).slice(2)}`,
      from: iso(first),
      to: iso(last),
    };
  });
  const inds = await Promise.all(list.map((p) => getIndicators(p.from, p.to, includeTest)));
  return list.map((p, i) => ({ ...p, ind: inds[i] }));
}
