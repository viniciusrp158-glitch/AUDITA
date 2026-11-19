/** Resultados da prospecção (AUDDOC020 RP-13): cálculo dos indicadores, conversão por etapa, nicho e canal. */
import { describe, expect, it } from "vitest";
import { computeResults } from "@/lib/prospect/results-calc";

const D = (d: string) => `${d}T12:00:00.000Z`;
const leads = [
  { id: "a", stage: "cliente", score_band: "prioritario", niche_id: "n1", created_at: D("2026-11-10") },
  { id: "b", stage: "perdido", score_band: "alto", niche_id: "n1", created_at: D("2026-11-11") },
  { id: "c", stage: "importado", score_band: "prioritario", niche_id: "n2", created_at: D("2026-11-12") },
  { id: "velho", stage: "proposta", score_band: "baixo", niche_id: "n2", created_at: D("2026-09-01") },
];
const history = [
  ...["importado", "qualificado", "primeiro_contato", "reuniao", "proposta", "cliente"].map((s, i) => ({ lead_id: "a", to_stage: s, changed_at: D(`2026-11-1${i}`) })),
  { lead_id: "b", to_stage: "importado", changed_at: D("2026-11-11") },
  { lead_id: "b", to_stage: "primeiro_contato", changed_at: D("2026-11-12") },
  { lead_id: "b", to_stage: "perdido", changed_at: D("2026-11-13") },
  { lead_id: "c", to_stage: "importado", changed_at: D("2026-11-12") },
  { lead_id: "velho", to_stage: "proposta", changed_at: D("2026-09-20") },
];
const activities = [
  { lead_id: "a", kind: "whatsapp", outcome: "interesse", occurred_at: D("2026-11-11") },
  { lead_id: "a", kind: "ligacao", outcome: "reuniao_marcada", occurred_at: D("2026-11-12") },
  { lead_id: "a", kind: "reuniao", outcome: "realizada", occurred_at: D("2026-11-13") },
  { lead_id: "b", kind: "whatsapp", outcome: "sem_resposta", occurred_at: D("2026-11-12") },
  { lead_id: "b", kind: "anotacao", outcome: null, occurred_at: D("2026-11-12") },
  { lead_id: "velho", kind: "email", outcome: "enviado", occurred_at: D("2026-09-05") },
];
const runs = [{ result_count: 120, ran_at: D("2026-11-09") }, { result_count: 30, ran_at: D("2026-09-01") }];

describe("Resultados da prospecção", () => {
  const r = computeResults({ leads, activities, history, runs }, "2026-11-01T03:00:00.000Z");

  it("indicadores do período", () => {
    expect(r.totals).toEqual({ searches: 1, found: 120, leads: 3, qualified: 2, priority: 2, contacts: 3, replies: 3, meetings: 1, proposals: 1, clients: 1 });
  });
  it("conversão por etapa sobre os leads que entraram no período", () => {
    const f = Object.fromEntries(r.funnel.map((x) => [x.stage, [x.reached, x.pct]]));
    expect(f.importado).toEqual([3, 100]);
    expect(f.primeiro_contato).toEqual([2, 66.7]);
    expect(f.proposta).toEqual([1, 33.3]);
    expect(f.cliente).toEqual([1, 33.3]);
  });
  it("por nicho e por canal", () => {
    expect(r.byNiche).toEqual([
      { niche_id: "n1", leads: 2, contacted: 2, replied: 1, proposals: 1, clients: 1 },
      { niche_id: "n2", leads: 1, contacted: 0, replied: 0, proposals: 0, clients: 0 },
    ]);
    const c = Object.fromEntries(r.byChannel.map((x) => [x.kind, x]));
    expect(c.whatsapp).toMatchObject({ records: 2, replies: 1, meetings: 0 });
    expect(c.ligacao).toMatchObject({ records: 1, replies: 1, meetings: 1 });
    expect(c.reuniao).toMatchObject({ records: 1, replies: 1 });
    expect(c.anotacao).toBeUndefined();
  });
  it("desde o início inclui tudo", () => {
    const t = computeResults({ leads, activities, history, runs }, null).totals;
    expect(t).toMatchObject({ searches: 2, found: 150, leads: 4, contacts: 4, proposals: 2, clients: 1 });
  });
});
