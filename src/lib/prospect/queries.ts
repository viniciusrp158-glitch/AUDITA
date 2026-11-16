import "server-only";
import { normalizeSearch } from "@/lib/clients/queries";
import { todaySaoPaulo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { isStage, type Stage } from "./labels";
import { scoreCompany, type Company, type Niche, type Score } from "./score";

/** AUDITA PROSPECT — consultas do servidor (RLS: administrador e operador). AUDDOC020 RP-02, RP-05, RP-06, RP-07, RP-13. */

export type SizeCode = Company["sizeCode"];
export const SIZES: SizeCode[] = ["01", "03", "05"];
export const RANGES = [
  { value: 50, label: "Até 50 km de Sorocaba" },
  { value: 100, label: "Até 100 km de Sorocaba" },
  { value: 150, label: "Até 150 km de Sorocaba" },
  { value: 0, label: "Todo o Estado (atendimento on-line)" },
];
/** Candidatos lidos da base por pesquisa: acima disso a pessoa refina os filtros (evita ler milhões de linhas). */
export const CANDIDATE_LIMIT = 1500;
export const RESULTS_PAGE = 50;

export type SearchFilters = {
  niche: string;
  maxKm: number;
  ibge: string | null;
  sizes: SizeCode[];
  withPhone: boolean;
  recent: boolean;
  hideKnown: boolean;
  q: string;
  page: number;
};

export type Establishment = {
  cnpj: string;
  is_headquarters: boolean;
  legal_name: string;
  trade_name: string | null;
  legal_nature: string;
  size_code: SizeCode;
  started_on: string | null;
  cnae_main: string;
  cnae_secondary: string[];
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  zip: string | null;
  ibge_code: string;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  publication: string;
};
const EST_COLUMNS =
  "cnpj, is_headquarters, legal_name, trade_name, legal_nature, size_code, started_on, cnae_main, cnae_secondary, street, number, complement, district, zip, ibge_code, phone1, phone2, email, publication";

export type Municipality = { ibge_code: string; name: string; km_from_base: number | null };
export type SearchRow = Establishment & { municipality: string; km: number | null; score: Score; known: "lead" | "cliente" | "nao_contatar" | null };

const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export async function getNiches(includeInactive = false): Promise<(Niche & { status: string; sortOrder: number; notes: string | null })[]> {
  const supabase = await createClient();
  let q = supabase.from("prospect_niches").select("id, code, name, cnae_prefixes, service_codes, is_entry, status, sort_order, notes").order("sort_order");
  if (!includeInactive) q = q.eq("status", "ativo");
  const { data } = await q;
  return (data ?? []).map((n) => ({
    id: n.id,
    code: n.code,
    name: n.name,
    cnaePrefixes: n.cnae_prefixes,
    serviceCodes: n.service_codes,
    isEntry: n.is_entry,
    status: n.status,
    sortOrder: n.sort_order,
    notes: n.notes,
  }));
}

/** Serviços liberados para venda (catálogo ativo e apto comercialmente): os únicos sugeridos. */
export async function getReleasedServices(): Promise<{ codes: Set<string>; names: Map<string, string> }> {
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("service_code, name").eq("catalog_status", "ativo").eq("commercial_status", "apto_comercialmente");
  return { codes: new Set((data ?? []).map((s) => s.service_code)), names: new Map((data ?? []).map((s) => [s.service_code, s.name])) };
}

export async function getMunicipalities(maxKm = 0): Promise<Municipality[]> {
  const supabase = await createClient();
  let q = supabase.from("ibge_municipalities").select("ibge_code, name, km_from_base").order("name");
  if (maxKm > 0) q = q.lte("km_from_base", maxKm);
  const { data } = await q;
  return (data ?? []).map((m) => ({ ibge_code: m.ibge_code, name: m.name, km_from_base: m.km_from_base === null ? null : Number(m.km_from_base) }));
}

export async function getCurrentPublication(): Promise<{ reference: string; rows_loaded: number; loaded_at: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("cnpj_publications").select("reference, rows_loaded, loaded_at").eq("is_current", true).maybeSingle();
  return data ?? null;
}

/** Quem já está no funil, já é cliente ou pediu para não ser contatado (entre os CNPJs informados). */
async function knownCnpjs(cnpjs: string[]): Promise<Map<string, SearchRow["known"]>> {
  const supabase = await createClient();
  const known = new Map<string, SearchRow["known"]>();
  for (const part of chunk(cnpjs, 150)) {
    const [leads, sup, clients] = await Promise.all([
      supabase.from("leads").select("cnpj, stage").in("cnpj", part),
      supabase.from("contact_suppressions").select("cnpj").in("cnpj", part),
      supabase.from("clients").select("tax_id").in("tax_id", part),
    ]);
    for (const l of leads.data ?? []) known.set(l.cnpj, l.stage === "cliente" ? "cliente" : "lead");
    for (const c of clients.data ?? []) known.set(c.tax_id, "cliente");
    for (const s of sup.data ?? []) known.set(s.cnpj, "nao_contatar");
  }
  return known;
}

export async function searchCompanies(f: SearchFilters): Promise<{
  rows: SearchRow[];
  total: number;
  scored: number;
  truncated: boolean;
  niche: Niche | null;
  error?: string;
}> {
  const supabase = await createClient();
  const [niches, released] = await Promise.all([getNiches(), getReleasedServices()]);
  const niche = niches.find((n) => n.code === f.niche) ?? null;
  if (!niche) return { rows: [], total: 0, scored: 0, truncated: false, niche: null, error: "Escolha um nicho." };

  const muns = f.ibge ? (await getMunicipalities()).filter((m) => m.ibge_code === f.ibge) : await getMunicipalities(f.maxKm);
  const munMap = new Map(muns.map((m) => [m.ibge_code, m]));
  if (!muns.length) return { rows: [], total: 0, scored: 0, truncated: false, niche };

  let q = supabase
    .from("cnpj_establishments")
    .select(EST_COLUMNS, { count: "exact" })
    .or(niche.cnaePrefixes.map((p) => `cnae_main.like.${p}*`).join(","))
    .in("size_code", f.sizes.length ? f.sizes : SIZES);
  if (f.ibge || f.maxKm > 0) q = q.in("ibge_code", muns.map((m) => m.ibge_code));
  if (f.withPhone) q = q.not("phone1", "is", null);
  if (f.recent) {
    const d = new Date(`${todaySaoPaulo()}T12:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    q = q.gte("started_on", d.toISOString().slice(0, 10));
  }
  const term = normalizeSearch(f.q);
  if (term) q = q.like("search_text", `%${term}%`);
  const { data, count, error } = await q.order("started_on", { ascending: false, nullsFirst: false }).limit(CANDIDATE_LIMIT);
  if (error) return { rows: [], total: 0, scored: 0, truncated: false, niche, error: "Não foi possível pesquisar na base. Tente novamente." };

  const list = (data ?? []) as Establishment[];
  const known = await knownCnpjs(list.map((e) => e.cnpj));
  const today = todaySaoPaulo();
  let rows: SearchRow[] = list.map((e) => {
    const m = munMap.get(e.ibge_code);
    const km = m?.km_from_base ?? null;
    return {
      ...e,
      municipality: m?.name ?? "",
      km,
      known: known.get(e.cnpj) ?? null,
      score: scoreCompany(
        { cnaeMain: e.cnae_main, cnaeSecondary: e.cnae_secondary, sizeCode: e.size_code, startedOn: e.started_on, kmFromBase: km, hasPhone: !!(e.phone1 || e.phone2), hasEmail: !!e.email },
        niches,
        released.codes,
        today,
      ),
    };
  });
  if (f.hideKnown) rows = rows.filter((r) => !r.known);
  rows.sort((a, b) => b.score.score - a.score.score || a.legal_name.localeCompare(b.legal_name, "pt-BR"));
  const total = count ?? list.length;
  const start = (Math.max(1, f.page) - 1) * RESULTS_PAGE;
  return { rows: rows.slice(start, start + RESULTS_PAGE), total, scored: rows.length, truncated: total > CANDIDATE_LIMIT, niche };
}

/** Registra a pesquisa executada (histórico, RP-04). */
export async function logSearchRun(filters: SearchFilters, resultCount: number, publication: string | null) {
  const supabase = await createClient();
  await supabase.from("prospect_search_runs").insert({ filters: { ...filters, page: undefined }, result_count: resultCount, publication });
}

// ---------------------------------------------------------------------------------------------------------------
// Funil e ficha
// ---------------------------------------------------------------------------------------------------------------
export type LeadCard = {
  id: string;
  cnpj: string | null;
  legal_name: string;
  trade_name: string | null;
  stage: Stage;
  score: number | null;
  score_band: string | null;
  next_action_at: string | null;
  next_action_note: string | null;
  last_activity_at: string | null;
  owner_id: string | null;
  niche_id: string | null;
  is_test: boolean;
  municipality: string | null;
};
const CARD_COLUMNS =
  "id, cnpj, legal_name, trade_name, stage, score, score_band, next_action_at, next_action_note, last_activity_at, owner_id, niche_id, is_test, ibge_municipalities(name)";

type CardRow = Omit<LeadCard, "municipality"> & { ibge_municipalities: { name: string } | { name: string }[] | null };
const toCard = (r: CardRow): LeadCard => {
  const { ibge_municipalities, ...rest } = r;
  const m = Array.isArray(ibge_municipalities) ? ibge_municipalities[0] : ibge_municipalities;
  return { ...rest, stage: isStage(rest.stage) ? rest.stage : "importado", municipality: m?.name ?? null };
};

export async function listLeads(filters: { owner?: string; niche?: string; q?: string }): Promise<{ rows: LeadCard[]; error?: string }> {
  const supabase = await createClient();
  let q = supabase.from("leads").select(CARD_COLUMNS).eq("status", "ativo");
  if (filters.owner) q = q.eq("owner_id", filters.owner);
  if (filters.niche) q = q.eq("niche_id", filters.niche);
  const term = normalizeSearch(filters.q ?? "");
  if (term) q = q.like("search_text", `%${term}%`);
  const { data, error } = await q.order("score", { ascending: false, nullsFirst: false }).limit(800);
  if (error) return { rows: [], error: "Não foi possível carregar o funil." };
  return { rows: ((data ?? []) as unknown as CardRow[]).map(toCard) };
}

export type LeadDetail = LeadCard & {
  cnae_main: string | null;
  size_code: SizeCode | null;
  ibge_code: string | null;
  lost_reason: string | null;
  score_detail: { items?: { key: string; label: string; points: number; max: number; text: string }[] } | null;
  score_version: string | null;
  suggested_services: string[];
  source: string;
  source_publication: string | null;
  phone_confirmed: string | null;
  whatsapp_confirmed: string | null;
  email_confirmed: string | null;
  contact_person: string | null;
  client_id: string | null;
  created_at: string;
};

export type Activity = { id: string; kind: string; outcome: string | null; note: string | null; template_code: string | null; occurred_at: string; created_by: string | null };
export type StageEvent = { id: string; from_stage: string | null; to_stage: string; reason: string | null; changed_at: string };

export async function getLead(id: string): Promise<{
  lead: LeadDetail;
  activities: Activity[];
  history: StageEvent[];
  company: Establishment | null;
  suppressed: boolean;
  niche: { code: string; name: string } | null;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      `${CARD_COLUMNS}, cnae_main, size_code, ibge_code, lost_reason, score_detail, score_version, suggested_services, source, source_publication, phone_confirmed, whatsapp_confirmed, email_confirmed, contact_person, client_id, created_at`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const lead = { ...(data as unknown as LeadDetail), ...toCard(data as unknown as CardRow) };
  const [acts, hist, company, sup, niche] = await Promise.all([
    supabase.from("lead_activities").select("id, kind, outcome, note, template_code, occurred_at, created_by").eq("lead_id", id).order("occurred_at", { ascending: false }),
    supabase.from("lead_stage_history").select("id, from_stage, to_stage, reason, changed_at").eq("lead_id", id).order("changed_at", { ascending: false }),
    lead.cnpj ? supabase.from("cnpj_establishments").select(EST_COLUMNS).eq("cnpj", lead.cnpj).maybeSingle() : Promise.resolve({ data: null }),
    lead.cnpj ? supabase.from("contact_suppressions").select("id").eq("cnpj", lead.cnpj).limit(1) : Promise.resolve({ data: [] }),
    lead.niche_id ? supabase.from("prospect_niches").select("code, name").eq("id", lead.niche_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    lead,
    activities: (acts.data ?? []) as Activity[],
    history: (hist.data ?? []) as StageEvent[],
    company: (company.data as Establishment | null) ?? null,
    suppressed: (sup.data ?? []).length > 0,
    niche: (niche.data as { code: string; name: string } | null) ?? null,
  };
}

/** Painel: leads por etapa, retornos de hoje/atrasados, parados há mais de 7 dias e atividades da semana. */
export async function getDashboard(): Promise<{
  byStage: Record<Stage, number>;
  due: LeadCard[];
  stale: number;
  week: { contatos: number; respostas: number; reunioes: number };
  suppressions: number;
}> {
  const supabase = await createClient();
  const { rows } = await listLeads({});
  const byStage = Object.fromEntries(["identificada", "importado", "qualificado", "primeiro_contato", "aguardando_retorno", "negociacao", "reuniao", "proposta", "cliente", "perdido"].map((s) => [s, 0])) as Record<Stage, number>;
  for (const r of rows) byStage[r.stage] += 1;
  const endOfToday = new Date(`${todaySaoPaulo()}T23:59:59-03:00`).getTime();
  const open = rows.filter((r) => r.stage !== "cliente" && r.stage !== "perdido");
  const due = open
    .filter((r) => r.next_action_at && new Date(r.next_action_at).getTime() <= endOfToday)
    .sort((a, b) => (a.next_action_at ?? "").localeCompare(b.next_action_at ?? ""));
  const weekAgo = Date.now() - 7 * 86_400_000;
  const stale = open.filter((r) => r.stage !== "identificada" && r.stage !== "importado" && (!r.last_activity_at || new Date(r.last_activity_at).getTime() < weekAgo)).length;
  const since = new Date(weekAgo).toISOString();
  const [acts, sup] = await Promise.all([
    supabase.from("lead_activities").select("kind, outcome").gte("occurred_at", since),
    supabase.from("contact_suppressions").select("id", { count: "exact", head: true }),
  ]);
  const a = acts.data ?? [];
  return {
    byStage,
    due: due.slice(0, 12),
    stale,
    week: {
      contatos: a.filter((x) => ["whatsapp", "ligacao", "email"].includes(x.kind)).length,
      respostas: a.filter((x) => ["interesse", "reuniao_marcada", "retornar_depois", "nao_contatar"].includes(x.outcome ?? "")).length,
      reunioes: a.filter((x) => x.outcome === "reuniao_marcada").length,
    },
    suppressions: sup.count ?? 0,
  };
}
