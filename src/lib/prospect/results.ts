import "server-only";
/** Resultados da prospecção (AUDDOC020 RP-13): leitura do banco pela RLS de quem consulta + cálculo puro. */
import { isProduction } from "@/lib/env";
import { todaySaoPaulo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { computeResults, CONTACT_KINDS, REPLY_OUTCOMES, type Results } from "./results-calc";

export const PERIODS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "tudo", label: "Desde o início" },
] as const;
export type Period = (typeof PERIODS)[number]["value"];
export const isPeriod = (v: string | undefined): v is Period => PERIODS.some((p) => p.value === v);

/** Início do período (ISO), contando o dia de hoje em São Paulo; null = desde o início. */
export function periodStart(p: Period, today = todaySaoPaulo()): string | null {
  if (p === "tudo") return null;
  const d = new Date(`${today}T00:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() - (Number(p) - 1));
  return d.toISOString();
}

/** A API devolve no máximo 1000 linhas por consulta: busca em páginas (até 20 mil linhas). */
const PAGE = 1000;
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<{ data: T[]; error: boolean }> {
  const out: T[] = [];
  for (let from = 0; from < 20 * PAGE; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { data: out, error: true };
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < PAGE) break;
  }
  return { data: out, error: false };
}

async function load(includeTest: boolean) {
  const supabase = await createClient();
  const leadsQ = (a: number, b: number) => {
    const q = supabase
      .from("leads")
      .select("id, cnpj, legal_name, trade_name, stage, score, score_band, niche_id, created_at, last_activity_at, client_id, chance_group:score_detail->portfolio->>group, ibge_municipalities(name)")
      .eq("status", "ativo");
    return (includeTest ? q : q.eq("is_test", false)).order("id").range(a, b);
  };
  const actsQ = (a: number, b: number) => {
    const q = supabase.from("lead_activities").select("lead_id, kind, outcome, occurred_at");
    return (includeTest ? q : q.eq("is_test", false)).order("id").range(a, b);
  };
  const [leads, acts, hist, runs, niches] = await Promise.all([
    all(leadsQ),
    all(actsQ),
    all((a, b) => supabase.from("lead_stage_history").select("lead_id, to_stage, changed_at").order("id").range(a, b)),
    all((a, b) => supabase.from("prospect_search_runs").select("result_count, ran_at").order("id").range(a, b)),
    supabase.from("prospect_niches").select("id, name"),
  ]);
  return {
    leads: (leads.data ?? []) as unknown as {
      id: string;
      cnpj: string | null;
      legal_name: string;
      trade_name: string | null;
      stage: string;
      score: number | null;
      score_band: string | null;
      niche_id: string | null;
      created_at: string;
      last_activity_at: string | null;
      client_id: string | null;
      chance_group: string | null;
      ibge_municipalities: { name: string } | null;
    }[],
    activities: (acts.data ?? []) as { lead_id: string; kind: string; outcome: string | null; occurred_at: string }[],
    history: (hist.data ?? []) as { lead_id: string; to_stage: string; changed_at: string }[],
    runs: (runs.data ?? []) as { result_count: number; ran_at: string }[],
    nicheName: new Map(((niches.data ?? []) as { id: string; name: string }[]).map((n) => [n.id, n.name])),
    error: leads.error || acts.error || hist.error,
  };
}

export async function getProspectResults(period: Period): Promise<Results & { nicheName: Map<string, string>; error: boolean; includeTest: boolean }> {
  const includeTest = !isProduction;
  const d = await load(includeTest);
  // Histórico só dos leads considerados (o de teste fica de fora na produção)
  const ids = new Set(d.leads.map((l) => l.id));
  const r = computeResults({ leads: d.leads, activities: d.activities, history: d.history.filter((h) => ids.has(h.lead_id)), runs: d.runs }, periodStart(period));
  return { ...r, nicheName: d.nicheName, error: d.error, includeTest };
}

/** Linhas da exportação: um lead por linha, com os números de contato do período. */
export async function getProspectExportRows(period: Period) {
  const d = await load(!isProduction);
  const since = periodStart(period);
  const inP = (iso: string) => !since || iso >= since;
  return d.leads
    .filter((l) => inP(l.created_at))
    .map((l) => {
      const a = d.activities.filter((x) => x.lead_id === l.id && inP(x.occurred_at));
      return {
        ...l,
        niche: l.niche_id ? (d.nicheName.get(l.niche_id) ?? "") : "",
        contacts: a.filter((x) => CONTACT_KINDS.includes(x.kind)).length,
        replies: a.filter((x) => REPLY_OUTCOMES.includes(x.outcome ?? "")).length,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
