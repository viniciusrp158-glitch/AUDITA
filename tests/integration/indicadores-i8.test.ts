/**
 * I8 — Indicadores (AUDDOC017 RF-29, RF-30, §14, CA-11) por chamada direta à API.
 * Cada número da função do banco é conferido (1) contra um cálculo independente feito aqui a partir das tabelas e
 * (2) pelas variações exatas após criar dados fictícios (cliente, demanda, proposta emitida, aceita, recusada, reaberta).
 * Ambiente de DESENVOLVIMENTO; todos os registros são fictícios e marcados como teste.
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import Decimal from "decimal.js";
import { beforeAll, describe, expect, it } from "vitest";
import { buildDocument } from "@/lib/documents/proposal";
import { renderDocx } from "@/lib/documents/render-docx";
import { renderPdf } from "@/lib/documents/render-pdf";
import { buildResults, type QuoteSnapshot } from "@/lib/documents/snapshot";
import { randomCnpj, uniqueSuffix } from "../helpers/br";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ready = Boolean(url && key && process.env.TEST_ADMIN_EMAIL && process.env.TEST_INTRUSO_EMAIL);

function client() {
  return createClient(url!, key!, { db: { schema: "audita" }, auth: { persistSession: false, autoRefreshToken: false } });
}
async function signedIn(email: string, password: string) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return c;
}
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const spDay = (ts: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(ts));

type Ind = {
  clients_active: number;
  quotes_open_now: number;
  quotes_open: number;
  quotes_by_stage: Record<string, number>;
  quoted: { count: number; once: number; monthly: number };
  accepted: { count: number; once: number; monthly: number; avg_once: number | null; avg_monthly: number | null };
  decisions: { accepted: number; refused: number };
  conversion: number | null;
  demands: { pending: number; overdue: number; received: number };
};

const CONTENT = {
  validity_days: 15,
  objective: "[Teste] Objetivo.",
  scope_included: "[Teste] Escopo.",
  scope_excluded: "[Teste] Exclusões.",
  location_modality: "[Teste] Presencial.",
  schedule: "[Teste] 10 dias.",
  methodology: "[Teste] Metodologia.",
  deliverables: "[Teste] Entregáveis.",
  completion_criteria: "[Teste] Critério.",
  payment_terms: "[Teste] 30 dias.",
  additional_expenses: "[Teste] Não se aplica.",
  cancellation_terms: "[Teste] 48 h.",
};

describe.skipIf(!ready)("I8 — indicadores", () => {
  type C = ReturnType<typeof client>;
  let admin: C;
  let intruso: C;
  let anon: C;
  const tag = uniqueSuffix();
  let serviceId: string;
  const T = today();

  const indicators = async (include = true, c: C = admin) => {
    const r = await c.rpc("dashboard_indicators", { p_from: T, p_to: T, p_include_test: include });
    if (r.error) throw new Error(r.error.message);
    return r.data as Ind;
  };

  /** Cliente com CNPJ e contato, demanda e cotação com item calculável (R$ 4.237,59 com os parâmetros de teste). */
  async function setupQuote(hours = 19) {
    const c = (await admin.from("clients").insert({ legal_name: `[Teste automatizado] Indicadores ${tag}`, tax_id: randomCnpj(), is_test: true }).select("id").single()).data!;
    await admin.from("client_contacts").insert({ client_id: c.id, full_name: "Responsável Fictício", email: "resp@exemplo.test", is_primary: true });
    const d = (await admin.from("demands").insert({ client_id: c.id, summary: `[Teste automatizado] Indicadores ${tag}`, origin: "whatsapp", service_id: serviceId, is_test: true }).select("id").single()).data!;
    const vig = (await admin.from("pricing_parameter_sets").select("id").eq("status", "vigente").single()).data!;
    const q = (await admin.from("quotes").insert({ demand_id: d.id, parameter_set_id: vig.id, is_test: true, ...CONTENT }).select("id").single()).data!;
    const it = (await admin.from("quote_items").insert({ quote_id: q.id, service_id: serviceId, description: "[Teste] Item", periodicity: "unica", hours_execution: hours, cost_other: 250 }).select("id").single()).data!;
    return { clientId: c.id as string, demandId: d.id as string, quoteId: q.id as string, itemId: it.id as string };
  }

  async function freeze(quoteId: string, reason: string | null = null) {
    const q = (await admin.from("quotes").select("parameter_set_id, pricing_parameter_sets!quotes_parameter_set_id_fkey(*)").eq("id", quoteId).single()).data!;
    const items = (await admin.from("quote_items").select("*, services(pricing_model, commercial_status, catalog_status)").eq("quote_id", quoteId)).data!;
    const { results } = buildResults(q.parameter_set_id!, q.pricing_parameter_sets as unknown as Parameters<typeof buildResults>[1], items.map((i) => ({ ...i, services: i.services })));
    const r = await admin.rpc("freeze_quote_revision", { p_quote_id: quoteId, p_results: results, p_reason: reason });
    if (r.error) throw new Error(r.error.message);
    return r.data as string;
  }

  async function emit(quoteId: string) {
    const q = (await admin.from("quotes").select("current_revision_id").eq("id", quoteId).single()).data!;
    const rev = (await admin.from("quote_revisions").select("id, revision_number, snapshot").eq("id", q.current_revision_id!).single()).data!;
    const tpl = (await admin.from("document_templates").select("id").eq("template_code", "AUDDOC010-ANX01").eq("status", "vigente").single()).data!;
    const model = buildDocument(rev.snapshot as QuoteSnapshot, { issuedOn: T, watermark: true, templateRevision: "Rev.00", technicalVersion: "v1" });
    const docs = [];
    for (const [kind, buf, type] of [
      ["docx", await renderDocx(model), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ["pdf", await renderPdf(model), "application/pdf"],
    ] as const) {
      const path = `quotes/${quoteId}/r${String(rev.revision_number).padStart(2, "0")}/${model.fileBase}_${Date.now()}.${kind}`;
      const up = await admin.storage.from("audita-documentos").upload(path, buf, { contentType: type });
      if (up.error) throw new Error(up.error.message);
      docs.push({ kind, file_name: `${model.fileBase}.${kind}`, storage_path: path, size_bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") });
    }
    const r = await admin.rpc("register_emission", { p_revision_id: rev.id, p_template_id: tpl.id, p_watermark: true, p_docs: docs });
    if (r.error) throw new Error(r.error.message);
  }

  const decide = async (quoteId: string, decision: "aceita" | "recusada") => {
    const r = await admin.rpc("register_quote_decision", {
      p_quote_id: quoteId,
      p_decision: decision,
      ...(decision === "aceita" ? { p_date: T, p_name: "Responsável Fictício", p_reference: "[Teste] E-mail" } : { p_note: "[Teste] Preço" }),
    });
    if (r.error) throw new Error(r.error.message);
  };

  beforeAll(async () => {
    admin = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    intruso = await signedIn(process.env.TEST_INTRUSO_EMAIL!, process.env.TEST_INTRUSO_PASSWORD!);
    anon = client();
    serviceId = (await admin.from("services").select("id").eq("service_code", "TRN-001").single()).data!.id;
  });

  it("CA-11: cada número confere com cálculo independente feito a partir das tabelas", async () => {
    const ind = await indicators(true);
    const { count: active } = await admin.from("clients").select("id", { count: "exact", head: true }).eq("status", "ativo");
    expect(ind.clients_active).toBe(active);

    const quotes = (await admin.from("quotes").select("id, status, created_at")).data!;
    expect(ind.quotes_open_now).toBe(quotes.filter((q) => ["rascunho", "revisada", "emitida"].includes(q.status)).length);
    const created = quotes.filter((q) => spDay(q.created_at) === T);
    for (const s of ["rascunho", "revisada", "emitida", "aceita", "recusada", "cancelada"])
      expect(ind.quotes_by_stage[s] ?? 0, s).toBe(created.filter((q) => q.status === s).length);

    // Valor cotado: última revisão emitida hoje por cotação; único e mensal separados
    const revs = (await admin.from("quote_revisions").select("quote_id, status, emitted_at, decided_at, total_once, total_monthly")).data!;
    const latest = (rows: typeof revs, ts: "emitted_at" | "decided_at") => {
      const m = new Map<string, (typeof revs)[number]>();
      for (const r of rows) if (r[ts] && spDay(r[ts]!) === T && (!m.get(r.quote_id) || m.get(r.quote_id)![ts]! < r[ts]!)) m.set(r.quote_id, r);
      return [...m.values()];
    };
    const sum = (rows: typeof revs, f: "total_once" | "total_monthly") => rows.reduce((a, r) => a.plus(r[f] ?? 0), new Decimal(0)).toNumber();
    const emitted = latest(revs, "emitted_at");
    expect(ind.quoted.count).toBe(emitted.length);
    expect(Number(ind.quoted.once)).toBeCloseTo(sum(emitted, "total_once"), 2);
    expect(Number(ind.quoted.monthly)).toBeCloseTo(sum(emitted, "total_monthly"), 2);

    const decided = latest(revs.filter((r) => ["aceita", "recusada"].includes(r.status)), "decided_at");
    const acc = decided.filter((r) => r.status === "aceita");
    expect(ind.accepted.count).toBe(acc.length);
    expect(Number(ind.accepted.once)).toBeCloseTo(sum(acc, "total_once"), 2);
    expect(ind.decisions).toEqual({ accepted: acc.length, refused: decided.length - acc.length });
    if (decided.length === 0) expect(ind.conversion).toBeNull();
    else expect(Number(ind.conversion)).toBeCloseTo(acc.length / decided.length, 4);

    const dem = (await admin.from("demands").select("status, due_on, received_on")).data!;
    const open = dem.filter((d) => !["encerrada", "nao_viavel", "cancelada"].includes(d.status));
    expect(ind.demands.pending).toBe(open.length);
    expect(ind.demands.overdue).toBe(open.filter((d) => d.due_on && d.due_on < T).length);
    expect(ind.demands.received).toBe(dem.filter((d) => d.received_on === T).length);
  });

  it("variações exatas: cliente, demanda, emissão, aceite (sem duplicar revisões) e recusa", async () => {
    const before = await indicators(true);

    const a = await setupQuote(19); // R$ 4.237,59
    await freeze(a.quoteId);
    await emit(a.quoteId);
    const afterEmit = await indicators(true);
    expect(afterEmit.clients_active - before.clients_active).toBe(1);
    expect(afterEmit.demands.received - before.demands.received).toBe(1);
    expect(afterEmit.quoted.count - before.quoted.count).toBe(1);
    expect(new Decimal(afterEmit.quoted.once).minus(before.quoted.once).toFixed(2)).toBe("4237.59");
    expect(Number(afterEmit.quoted.monthly)).toBe(Number(before.quoted.monthly)); // único nunca entra no mensal

    await decide(a.quoteId, "aceita");
    const afterAccept = await indicators(true);
    expect(afterAccept.accepted.count - before.accepted.count).toBe(1);
    expect(new Decimal(afterAccept.accepted.once).minus(before.accepted.once).toFixed(2)).toBe("4237.59");

    // Reabrir a aceita e aceitar a Rev.01 com outro valor: conta uma vez, pelo valor da última revisão aceita
    await admin.rpc("reopen_quote", { p_quote_id: a.quoteId, p_reason: "[Teste] Ajuste de escopo" });
    await admin.from("quote_items").update({ hours_execution: 29 }).eq("id", a.itemId);
    await freeze(a.quoteId, "[Teste] Ajuste de escopo");
    await emit(a.quoteId);
    await decide(a.quoteId, "aceita");
    const rev1 = (await admin.from("quote_revisions").select("total_once").eq("quote_id", a.quoteId).eq("revision_number", 1).single()).data!;
    const afterRev1 = await indicators(true);
    expect(afterRev1.accepted.count - before.accepted.count).toBe(1);
    expect(new Decimal(afterRev1.accepted.once).minus(before.accepted.once).toFixed(2)).toBe(new Decimal(rev1.total_once).toFixed(2));
    expect(afterRev1.quoted.count - before.quoted.count).toBe(1); // a mesma cotação emitida duas vezes conta uma

    // Recusa: entra no denominador da conversão
    const b = await setupQuote(19);
    await freeze(b.quoteId);
    await emit(b.quoteId);
    await decide(b.quoteId, "recusada");
    const afterRefuse = await indicators(true);
    expect(afterRefuse.decisions.refused - before.decisions.refused).toBe(1);
    const den = afterRefuse.decisions.accepted + afterRefuse.decisions.refused;
    expect(Number(afterRefuse.conversion)).toBeCloseTo(afterRefuse.decisions.accepted / den, 4);
  });

  it("dados de teste ficam fora quando pedido; período sem movimento devolve zeros e 'sem dados'", async () => {
    const semTeste = await indicators(false);
    const { count } = await admin.from("clients").select("id", { count: "exact", head: true }).eq("status", "ativo").eq("is_test", false);
    expect(semTeste.clients_active).toBe(count);
    const r = await admin.rpc("dashboard_indicators", { p_from: "2000-01-01", p_to: "2000-01-31", p_include_test: true });
    const old = r.data as Ind;
    expect(old.quoted).toEqual({ count: 0, once: 0, monthly: 0 });
    expect(old.accepted.avg_once).toBeNull();
    expect(old.conversion).toBeNull();
    expect(old.demands.received).toBe(0);
  });

  it("isolamento: não autorizado vê zeros; anônimo não executa", async () => {
    const i = await indicators(true, intruso);
    expect(i.clients_active).toBe(0);
    expect(i.quotes_open_now).toBe(0);
    expect(i.quoted.count).toBe(0);
    expect(i.demands.pending).toBe(0);
    const a = await anon.rpc("dashboard_indicators", { p_from: T, p_to: T, p_include_test: true });
    expect(a.error).not.toBeNull();
  });
});
