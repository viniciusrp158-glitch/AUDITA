/**
 * Resultados da prospecção (AUDDOC020 RP-13) — cálculo puro, sem banco (testado em tests/unit/prospect-resultados.test.ts).
 * Definições (as mesmas das metas da semana):
 *   contato   = WhatsApp, ligação ou e-mail registrado (reunião e anotação não contam como contato);
 *   resposta  = contato com retorno da empresa: tem interesse, reunião marcada, pediu contato depois, reunião realizada
 *               ou pediu para não ser contatado;
 *   reunião   = contato com resultado "reunião marcada".
 * Conversão por etapa: dos leads que entraram no funil no período, quantos chegaram a cada etapa (pelo histórico de
 * etapas, em qualquer data), em percentual sobre os que entraram.
 */
export const CONTACT_KINDS = ["whatsapp", "ligacao", "email"];
export const REPLY_OUTCOMES = ["interesse", "reuniao_marcada", "retornar_depois", "realizada", "nao_contatar"];
/** Ordem do funil (sem "perdido", que é saída). */
export const FUNNEL = ["importado", "qualificado", "primeiro_contato", "aguardando_retorno", "negociacao", "reuniao", "proposta", "cliente"] as const;

export type ResultLead = { id: string; stage: string; score_band: string | null; niche_id: string | null; created_at: string; chance_group?: string | null };
export type ResultActivity = { lead_id: string; kind: string; outcome: string | null; occurred_at: string };
export type ResultStage = { lead_id: string; to_stage: string; changed_at: string };

export type Results = {
  totals: {
    searches: number;
    found: number;
    leads: number;
    qualified: number;
    priority: number;
    contacts: number;
    replies: number;
    meetings: number;
    proposals: number;
    clients: number;
  };
  funnel: { stage: string; reached: number; pct: number }[];
  byNiche: { niche_id: string | null; leads: number; contacted: number; replied: number; proposals: number; clients: number }[];
  /** Chance estimada (grupo da carteira no contato) × resposta real dos leads que entraram no período (RP-23). */
  byChance: { group: string; leads: number; contacted: number; replied: number; meetings: number; clients: number }[];
  /** Registros por canal no período (WhatsApp, ligação, e-mail, reunião), respostas e reuniões marcadas. */
  byChannel: { kind: string; records: number; replies: number; meetings: number }[];
};

const idx = (s: string) => FUNNEL.indexOf(s as (typeof FUNNEL)[number]);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

export function computeResults(
  input: { leads: ResultLead[]; activities: ResultActivity[]; history: ResultStage[]; runs: { result_count: number; ran_at: string }[] },
  since: string | null,
): Results {
  const inPeriod = (iso: string) => !since || iso >= since;
  const cohort = input.leads.filter((l) => inPeriod(l.created_at));
  const acts = input.activities.filter((a) => inPeriod(a.occurred_at));

  // Etapa mais avançada que cada lead já alcançou (histórico + etapa atual)
  const furthest = new Map<string, number>();
  const reach = (id: string, s: string) => {
    const i = idx(s);
    if (i >= 0 && i > (furthest.get(id) ?? -1)) furthest.set(id, i);
  };
  for (const l of input.leads) reach(l.id, l.stage === "identificada" ? "importado" : l.stage);
  for (const h of input.history) reach(h.lead_id, h.to_stage);
  // Propostas e clientes do período: chegaram à etapa dentro do período
  const reachedIn = (stage: string) => new Set(input.history.filter((h) => h.to_stage === stage && inPeriod(h.changed_at)).map((h) => h.lead_id));
  const proposals = reachedIn("proposta");
  const clients = reachedIn("cliente");

  const isContact = (a: ResultActivity) => CONTACT_KINDS.includes(a.kind);
  const isReply = (a: ResultActivity) => REPLY_OUTCOMES.includes(a.outcome ?? "");

  const funnel = FUNNEL.map((s) => {
    const reached = cohort.filter((l) => (furthest.get(l.id) ?? 0) >= idx(s)).length;
    return { stage: s, reached, pct: pct(reached, cohort.length) };
  });

  const niches = new Map<string | null, ResultLead[]>();
  for (const l of cohort) niches.set(l.niche_id, [...(niches.get(l.niche_id) ?? []), l]);
  const contactedIds = new Set(input.activities.filter(isContact).map((a) => a.lead_id));
  const repliedIds = new Set(input.activities.filter(isReply).map((a) => a.lead_id));
  const byNiche = [...niches.entries()]
    .map(([niche_id, ls]) => ({
      niche_id,
      leads: ls.length,
      contacted: ls.filter((l) => contactedIds.has(l.id)).length,
      replied: ls.filter((l) => repliedIds.has(l.id)).length,
      proposals: ls.filter((l) => (furthest.get(l.id) ?? 0) >= idx("proposta")).length,
      clients: ls.filter((l) => (furthest.get(l.id) ?? 0) >= idx("cliente")).length,
    }))
    .sort((a, b) => b.leads - a.leads);

  const channels = new Map<string, ResultActivity[]>();
  for (const a of acts.filter((x) => x.kind !== "anotacao")) channels.set(a.kind, [...(channels.get(a.kind) ?? []), a]);
  const byChannel = [...channels.entries()]
    .map(([kind, as]) => ({
      kind,
      records: as.length,
      replies: as.filter(isReply).length,
      meetings: as.filter((a) => a.outcome === "reuniao_marcada").length,
    }))
    .sort((a, b) => b.records - a.records);

  const meetingIds = new Set(input.activities.filter((a) => a.outcome === "reuniao_marcada").map((a) => a.lead_id));
  const byChance = ["quente", "morno", "frio", "precisa_contato"]
    .map((g) => {
      const ls = cohort.filter((l) => l.chance_group === g);
      return {
        group: g,
        leads: ls.length,
        contacted: ls.filter((l) => contactedIds.has(l.id)).length,
        replied: ls.filter((l) => repliedIds.has(l.id)).length,
        meetings: ls.filter((l) => meetingIds.has(l.id)).length,
        clients: ls.filter((l) => (furthest.get(l.id) ?? 0) >= idx("cliente")).length,
      };
    })
    .filter((x) => x.leads > 0);

  const runs = input.runs.filter((r) => inPeriod(r.ran_at));
  return {
    totals: {
      searches: runs.length,
      found: runs.reduce((s, r) => s + r.result_count, 0),
      leads: cohort.length,
      qualified: cohort.filter((l) => (furthest.get(l.id) ?? 0) >= idx("qualificado")).length,
      priority: cohort.filter((l) => l.score_band === "prioritario").length,
      contacts: acts.filter(isContact).length,
      replies: acts.filter(isReply).length,
      meetings: acts.filter((a) => a.outcome === "reuniao_marcada").length,
      proposals: proposals.size,
      clients: clients.size,
    },
    funnel,
    byChance,
    byNiche,
    byChannel,
  };
}

export { pct as percent };
