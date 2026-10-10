/**
 * I6 — Revisões imutáveis, emissão (DOCX/PDF em bucket privado) e decisão do cliente, por chamada direta à API.
 * AUDDOC017 RF-14, RF-15, RF-16, RF-17, RF-22, RF-24, CA-04, CA-08, CA-10.
 * Ambiente de DESENVOLVIMENTO; todos os registros são fictícios e marcados como teste.
 * Usa serviços liberados de forma fictícia no ambiente de desenvolvimento (decisão do Diretor de 09/10/2026).
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildDocument } from "@/lib/documents/proposal";
import { renderDocx } from "@/lib/documents/render-docx";
import { renderPdf } from "@/lib/documents/render-pdf";
import { buildResults, verifySnapshot, type QuoteSnapshot } from "@/lib/documents/snapshot";
import { randomCnpj, uniqueSuffix } from "../helpers/br";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ready = Boolean(url && key && process.env.TEST_ADMIN_EMAIL && process.env.TEST_INTRUSO_EMAIL);
const BUCKET = "audita-documentos";

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
const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const TEST_PARAMS = {
  pro_labore: 8000,
  fixed_costs: 2000,
  billable_hours: 100,
  taxes: 0.112,
  payment_fees: 0.0299,
  commission: 0.05,
  contingency: 0.1,
  target_margin: 0.25,
  max_discount: 0.1,
};

const CONTENT = {
  validity_days: 15,
  objective: "[Teste] Objetivo fictício.",
  scope_included: "[Teste] Escopo incluído.",
  scope_excluded: "[Teste] Exclusões.",
  location_modality: "[Teste] Presencial.",
  schedule: "[Teste] Em até 10 dias.",
  methodology: "[Teste] Metodologia.",
  deliverables: "[Teste] Entregáveis.",
  completion_criteria: "[Teste] Critério.",
  payment_terms: "[Teste] 30 dias.",
  additional_expenses: "[Teste] Não se aplica.",
  cancellation_terms: "[Teste] 48 h.",
  next_step: "[Teste] Agendar.",
};

describe.skipIf(!ready)("I6 — revisões, emissão e decisão", () => {
  type C = ReturnType<typeof client>;
  let admin: C;
  let intruso: C;
  let anon: C;
  const tag = uniqueSuffix();
  let releasedService: string; // TRN-001 (liberado — teste)
  let blockedService: string; // TRN-NR35 (não liberado)

  async function publishParams(extra: Record<string, unknown> = {}) {
    const d = await admin
      .from("pricing_parameter_sets")
      .insert({ label: `[TESTE] Parâmetros fictícios ${tag}`, is_test: true, ...TEST_PARAMS, ...extra })
      .select("id")
      .single();
    if (d.error) throw new Error(d.error.message);
    const p = await admin.rpc("publish_parameter_set", { p_id: d.data!.id });
    if (p.error) throw new Error(p.error.message);
    return d.data!.id as string;
  }

  /** Cliente (com CNPJ e contato), demanda e cotação com um item calculável. */
  async function setupQuote(opts: { serviceId?: string | null; withTaxId?: boolean; withContact?: boolean; content?: boolean } = {}) {
    const { serviceId = releasedService, withTaxId = true, withContact = true, content = true } = opts;
    const c = await admin
      .from("clients")
      .insert({ legal_name: `[Teste automatizado] Cliente Emissão ${tag}`, tax_id: withTaxId ? randomCnpj() : null, is_test: true })
      .select("id")
      .single();
    if (c.error) throw new Error(c.error.message);
    if (withContact)
      await admin.from("client_contacts").insert({ client_id: c.data!.id, full_name: "Responsável Fictício", email: "resp@exemplo.test", is_primary: true });
    const d = await admin
      .from("demands")
      .insert({ client_id: c.data!.id, summary: `[Teste automatizado] Emissão ${tag}`, origin: "whatsapp", service_id: serviceId, is_test: true })
      .select("id")
      .single();
    if (d.error) throw new Error(d.error.message);
    const vig = (await admin.from("pricing_parameter_sets").select("id").eq("status", "vigente").single()).data!;
    const q = await admin
      .from("quotes")
      .insert({ demand_id: d.data!.id, parameter_set_id: vig.id, is_test: true, ...(content ? CONTENT : {}) })
      .select("id, quote_code")
      .single();
    if (q.error) throw new Error(q.error.message);
    const it = await admin
      .from("quote_items")
      .insert({ quote_id: q.data!.id, service_id: serviceId, description: "[Teste] Item", periodicity: "unica", hours_execution: 19, cost_other: 250 })
      .select("id")
      .single();
    if (it.error) throw new Error(it.error.message);
    return { clientId: c.data!.id as string, demandId: d.data!.id as string, quoteId: q.data!.id as string, code: q.data!.quote_code as string, itemId: it.data!.id };
  }

  async function engineResults(quoteId: string) {
    const q = (await admin.from("quotes").select("parameter_set_id, pricing_parameter_sets!quotes_parameter_set_id_fkey(*)").eq("id", quoteId).single()).data!;
    const items = (
      await admin.from("quote_items").select("*, services(pricing_model, commercial_status, catalog_status)").eq("quote_id", quoteId)
    ).data!;
    const ps = q.pricing_parameter_sets as unknown as Parameters<typeof buildResults>[1];
    return buildResults(q.parameter_set_id!, ps, items.map((i) => ({ ...i, services: i.services })));
  }

  async function freeze(quoteId: string, reason: string | null = null) {
    const { results } = await engineResults(quoteId);
    return admin.rpc("freeze_quote_revision", { p_quote_id: quoteId, p_results: results, p_reason: reason });
  }

  /** Gera os arquivos como a aplicação, envia ao bucket privado e registra a emissão. */
  async function emit(quoteId: string, watermark = true) {
    const q = (await admin.from("quotes").select("current_revision_id").eq("id", quoteId).single()).data!;
    const rev = (await admin.from("quote_revisions").select("id, revision_number, snapshot").eq("id", q.current_revision_id!).single()).data!;
    const tpl = (await admin.from("document_templates").select("id").eq("template_code", "AUDDOC010-ANX01").eq("status", "vigente").single()).data!;
    const model = buildDocument(rev.snapshot as QuoteSnapshot, { issuedOn: today(), watermark, templateRevision: "Rev.00", technicalVersion: "v1" });
    const files = [
      { kind: "docx", buf: await renderDocx(model), type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      { kind: "pdf", buf: await renderPdf(model), type: "application/pdf" },
    ];
    const docs = [];
    for (const f of files) {
      const path = `quotes/${quoteId}/r${String(rev.revision_number).padStart(2, "0")}/${model.fileBase}_${Date.now()}.${f.kind}`;
      const up = await admin.storage.from(BUCKET).upload(path, f.buf, { contentType: f.type, upsert: false });
      if (up.error) throw new Error(up.error.message);
      docs.push({ kind: f.kind, file_name: `${model.fileBase}.${f.kind}`, storage_path: path, size_bytes: f.buf.length, sha256: createHash("sha256").update(f.buf).digest("hex") });
    }
    const r = await admin.rpc("register_emission", { p_revision_id: rev.id, p_template_id: tpl.id, p_watermark: watermark, p_docs: docs });
    return { error: r.error, revisionId: rev.id, docs };
  }

  beforeAll(async () => {
    admin = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    intruso = await signedIn(process.env.TEST_INTRUSO_EMAIL!, process.env.TEST_INTRUSO_PASSWORD!);
    anon = client();
    releasedService = (await admin.from("services").select("id, commercial_status").eq("service_code", "TRN-001").single()).data!.id;
    blockedService = (await admin.from("services").select("id").eq("service_code", "TRN-NR35").single()).data!.id;
    const ok = await admin.rpc("service_allows_commercial_proposal", { p_service_id: releasedService });
    if (ok.data !== true) throw new Error("TRN-001 precisa estar liberado (teste) — rode scripts/dev-liberar-servicos-teste.mjs");
    await publishParams();
  });

  afterAll(async () => {
    // Mantém a versão de teste padrão vigente para os demais testes
    if (admin) await publishParams();
  });

  it("modelos técnicos M01/M02 cadastrados com origem e SHA-256 do anexo oficial; imutáveis", async () => {
    const t = await admin.from("document_templates").select("template_code, document_revision, technical_version, source_sha256, status").order("template_code");
    expect(t.data!.map((x) => x.template_code)).toEqual(["AUDDOC010-ANX01", "AUDDOC010-ANX02"]);
    expect(t.data!.every((x) => x.document_revision === "Rev.00" && /^[0-9a-f]{64}$/.test(x.source_sha256))).toBe(true);
    const upd = await admin.from("document_templates").update({ technical_version: "v9" }).eq("template_code", "AUDDOC010-ANX01").select();
    expect(upd.error).not.toBeNull();
  });

  it("concluir revisão exige cadastro e conteúdo completos (pendências listadas e repetidas no banco)", async () => {
    const s = await setupQuote({ withTaxId: false, withContact: false, content: false, serviceId: null });
    const b = await admin.rpc("quote_review_blockers", { p_quote_id: s.quoteId });
    const text = (b.data as string[]).join(" ");
    for (const m of ["CNPJ/CPF", "contato", "sem serviço do catálogo", "Validade", "Objetivo", "Metodologia", "Pagamento"]) expect(text, m).toContain(m);
    const f = await freeze(s.quoteId);
    expect(f.error?.message).toContain("Pendências para concluir a revisão");
  });

  it("revisão congela snapshot (Rev.00); resultados precisam corresponder aos itens e estar PRONTOS; rascunho fica travado", async () => {
    const s = await setupQuote();
    const { results } = await engineResults(s.quoteId);
    const wrong = await admin.rpc("freeze_quote_revision", {
      p_quote_id: s.quoteId,
      p_results: { ...results, items: [{ ...results.items[0], id: crypto.randomUUID() }] },
    });
    expect(wrong.error?.message).toContain("não correspondem");
    const notReady = await admin.rpc("freeze_quote_revision", {
      p_quote_id: s.quoteId,
      p_results: { ...results, items: [{ ...results.items[0], status: "REVER_MARGEM" }] },
    });
    expect(notReady.error?.message).toContain("PRONTO");

    const ok = await freeze(s.quoteId);
    expect(ok.error).toBeNull();
    const rev = (await admin.from("quote_revisions").select("revision_number, status, snapshot, total_once, is_test").eq("id", ok.data).single()).data!;
    expect(rev.revision_number).toBe(0);
    expect(rev.status).toBe("revisada");
    expect(String(rev.total_once)).toBe("4237.59");
    expect(rev.is_test).toBe(true);
    const snap = rev.snapshot as QuoteSnapshot;
    expect(snap.quote.code).toBe(s.code);
    expect(snap.client.tax_id).toMatch(/^\d{14}$/);
    expect(snap.contact?.full_name).toBe("Responsável Fictício");
    expect(snap.parameters.target_margin).toBeTruthy();
    expect(verifySnapshot(snap)).toEqual([]);

    const q = (await admin.from("quotes").select("status, current_revision_id").eq("id", s.quoteId).single()).data!;
    expect(q).toEqual({ status: "revisada", current_revision_id: ok.data });
    expect((await admin.from("quote_items").update({ hours_execution: 1 }).eq("id", s.itemId)).error?.code).toBe("42501");
    expect((await admin.from("quotes").update({ objective: "alterado" }).eq("id", s.quoteId)).error?.code).toBe("42501");
    expect((await admin.from("quotes").update({ status: "emitida" }).eq("id", s.quoteId)).error?.code).toBe("42501");
  });

  it("revisões e documentos não podem ser alterados nem excluídos pela API", async () => {
    const s = await setupQuote();
    const f = await freeze(s.quoteId);
    const upd = await admin.from("quote_revisions").update({ total_once: 1 }).eq("id", f.data).select();
    expect(upd.error).not.toBeNull();
    const del = await admin.from("quote_revisions").delete().eq("id", f.data).select();
    expect(del.error).not.toBeNull();
    const ins = await admin.from("generated_documents").insert({ revision_id: f.data, quote_id: s.quoteId }).select();
    expect(ins.error).not.toBeNull();
  });

  it("CA-04 / RF-17: serviço não liberado bloqueia a emissão, mesmo com revisão concluída", async () => {
    const s = await setupQuote({ serviceId: blockedService });
    const f = await freeze(s.quoteId);
    expect(f.error).toBeNull();
    const b = await admin.rpc("revision_emission_blockers", { p_revision_id: f.data });
    expect((b.data as string[]).join(" ")).toContain("TRN-NR35");
    expect((b.data as string[]).join(" ")).toContain("não liberado comercialmente");
    const e = await emit(s.quoteId);
    expect(e.error?.message).toContain("Emissão bloqueada");
  });

  it("emissão: DOCX e PDF no bucket privado com SHA-256, validade, marca d'água obrigatória e demanda em 'Proposta enviada'", async () => {
    const s = await setupQuote();
    await freeze(s.quoteId);
    const noMark = await emit(s.quoteId, false);
    expect(noMark.error?.message).toContain("marca d'água");

    const e = await emit(s.quoteId, true);
    expect(e.error).toBeNull();
    const rev = (await admin.from("quote_revisions").select("status, emitted_at, valid_until, is_test_document, document_model").eq("id", e.revisionId).single()).data!;
    expect(rev.status).toBe("emitida");
    expect(rev.valid_until).toBe(plusDays(today(), 15));
    expect(rev.is_test_document).toBe(true);
    expect(rev.document_model).toBe("ANX01");
    const docs = (await admin.from("generated_documents").select("id, kind, sha256, storage_path, watermark").eq("revision_id", e.revisionId)).data!;
    expect(docs.map((d) => d.kind).sort()).toEqual(["docx", "pdf"]);
    expect(docs.every((d) => d.watermark)).toBe(true);

    // Conteúdo baixado confere com o SHA-256 registrado
    const pdf = docs.find((d) => d.kind === "pdf")!;
    const dl = await admin.storage.from(BUCKET).download(pdf.storage_path);
    const sha = createHash("sha256").update(Buffer.from(await dl.data!.arrayBuffer())).digest("hex");
    expect(sha).toBe(pdf.sha256);

    const dem = (await admin.from("demands").select("status").eq("id", s.demandId).single()).data!;
    expect(dem.status).toBe("proposta_enviada");
    const q = (await admin.from("quotes").select("status").eq("id", s.quoteId).single()).data!;
    expect(q.status).toBe("emitida");

    // Segunda emissão da mesma revisão é recusada
    const again = await emit(s.quoteId);
    expect(again.error).not.toBeNull();

    // Download registrado na trilha
    expect((await admin.rpc("log_document_download", { p_document_id: pdf.id })).error).toBeNull();
    const log = await admin.from("audit_log").select("action").eq("entity", "generated_documents").eq("entity_id", pdf.id).eq("action", "download");
    expect(log.data!.length).toBe(1);
  });

  it("CA-10: arquivos privados — anônimo e não autorizado não leem; sem sobrescrita nem caminho fora do padrão", async () => {
    const s = await setupQuote();
    await freeze(s.quoteId);
    const e = await emit(s.quoteId);
    const path = e.docs.find((d) => d.kind === "pdf")!.storage_path;
    for (const c of [anon, intruso]) {
      const dl = await c.storage.from(BUCKET).download(path);
      expect(dl.data).toBeNull();
      const signed = await c.storage.from(BUCKET).createSignedUrl(path, 60);
      expect(signed.data).toBeNull();
      const docs = await c.from("generated_documents").select("id").eq("quote_id", s.quoteId);
      expect(docs.data ?? []).toHaveLength(0);
    }
    const overwrite = await admin.storage.from(BUCKET).upload(path, Buffer.from("x"), { contentType: "application/pdf", upsert: true });
    expect(overwrite.error).not.toBeNull();
    const outside = await admin.storage.from(BUCKET).upload(`outros/${tag}.pdf`, Buffer.from("%PDF-"), { contentType: "application/pdf" });
    expect(outside.error).not.toBeNull();
    const removed = await admin.storage.from(BUCKET).remove([path]);
    expect(removed.data ?? []).toHaveLength(0);
    const stillThere = await admin.storage.from(BUCKET).download(path);
    expect(stillThere.data).not.toBeNull();
  });

  it("CA-08: proposta emitida mantém conteúdo e parâmetros após mudança dos parâmetros; nova revisão usa a nova versão", async () => {
    const s = await setupQuote();
    await freeze(s.quoteId);
    const e = await emit(s.quoteId);
    const before = (await admin.from("quote_revisions").select("snapshot, total_once").eq("id", e.revisionId).single()).data!;

    const newParams = await publishParams({ target_margin: 0.3 });
    const after = (await admin.from("quote_revisions").select("snapshot, total_once").eq("id", e.revisionId).single()).data!;
    expect(after).toEqual(before);
    expect(verifySnapshot(after.snapshot as QuoteSnapshot)).toEqual([]);

    // Nova revisão: motivo obrigatório; Rev.00 fica "Substituída" com seus documentos
    expect((await admin.rpc("reopen_quote", { p_quote_id: s.quoteId, p_reason: "" })).error?.message).toContain("motivo");
    expect((await admin.rpc("reopen_quote", { p_quote_id: s.quoteId, p_reason: "[Teste] Ajuste de margem" })).error).toBeNull();
    const r0 = (await admin.from("quote_revisions").select("status, superseded_at, generated_documents(id)").eq("id", e.revisionId).single()).data!;
    expect(r0.status).toBe("substituida");
    expect(r0.superseded_at).not.toBeNull();
    expect(r0.generated_documents).toHaveLength(2);

    expect((await admin.from("quotes").update({ parameter_set_id: newParams }).eq("id", s.quoteId)).error).toBeNull();
    expect((await freeze(s.quoteId, null)).error?.message).toContain("motivo");
    const f1 = await freeze(s.quoteId, "[Teste] Nova margem");
    expect(f1.error).toBeNull();
    const r1 = (await admin.from("quote_revisions").select("revision_number, total_once, parameter_set_id").eq("id", f1.data).single()).data!;
    expect(r1.revision_number).toBe(1);
    expect(r1.parameter_set_id).toBe(newParams);
    expect(Number(r1.total_once)).toBeGreaterThan(Number(before.total_once));
  });

  it("decisão: aceite exige data válida, quem aceitou e referência; demanda passa a 'Aceita'", async () => {
    const s = await setupQuote();
    await freeze(s.quoteId);
    await emit(s.quoteId);
    const base = { p_quote_id: s.quoteId, p_decision: "aceita" };
    expect((await admin.rpc("register_quote_decision", { ...base, p_date: today(), p_name: "Fulano", p_reference: "" })).error?.message).toContain("referência");
    expect((await admin.rpc("register_quote_decision", { ...base, p_date: plusDays(today(), 1), p_name: "Fulano", p_reference: "E-mail" })).error?.message).toContain("Data do aceite");
    const ok = await admin.rpc("register_quote_decision", { ...base, p_date: today(), p_name: "Responsável Fictício", p_reference: "E-mail de 10/10/2026" });
    expect(ok.error).toBeNull();
    const q = (await admin.from("quotes").select("status, current_revision_id").eq("id", s.quoteId).single()).data!;
    expect(q.status).toBe("aceita");
    const r = (await admin.from("quote_revisions").select("status, accepted_on, accepted_by_name").eq("id", q.current_revision_id!).single()).data!;
    expect(r).toEqual({ status: "aceita", accepted_on: today(), accepted_by_name: "Responsável Fictício" });
    expect((await admin.from("demands").select("status").eq("id", s.demandId).single()).data!.status).toBe("aceita");
    // Aceite repetido é recusado
    expect((await admin.rpc("register_quote_decision", { ...base, p_date: today(), p_name: "X", p_reference: "Y" })).error).not.toBeNull();
  });

  it("decisão: recusa e cancelamento exigem motivo; cancelada é final", async () => {
    const s = await setupQuote();
    await freeze(s.quoteId);
    await emit(s.quoteId);
    expect((await admin.rpc("register_quote_decision", { p_quote_id: s.quoteId, p_decision: "recusada", p_note: "" })).error?.message).toContain("motivo");
    expect((await admin.rpc("register_quote_decision", { p_quote_id: s.quoteId, p_decision: "recusada", p_note: "[Teste] Preço acima do orçamento" })).error).toBeNull();
    expect((await admin.from("quotes").select("status").eq("id", s.quoteId).single()).data!.status).toBe("recusada");
    expect((await admin.rpc("register_quote_decision", { p_quote_id: s.quoteId, p_decision: "cancelada", p_note: "" })).error?.message).toContain("motivo");
    expect((await admin.rpc("register_quote_decision", { p_quote_id: s.quoteId, p_decision: "cancelada", p_note: "[Teste] Cliente desistiu" })).error).toBeNull();
    expect((await admin.rpc("reopen_quote", { p_quote_id: s.quoteId, p_reason: "[Teste] reabrir" })).error?.message).toContain("não pode ser reaberta");
  });

  it("desconto: sem autorização a revisão é recusada; autorização exige justificativa; acima do máximo segue bloqueado", async () => {
    const s = await setupQuote();
    expect((await admin.from("quote_items").update({ discount: 0.05 }).eq("id", s.itemId)).error).toBeNull();
    const semAut = await freeze(s.quoteId);
    expect(semAut.error?.message).toContain("desconto autorizado");

    // Autorização sem justificativa ou sem data é recusada pelo banco
    const semJust = await admin.from("quote_items").update({ discount_authorized: true, discount_authorized_at: new Date().toISOString() }).eq("id", s.itemId);
    expect(semJust.error?.code).toBe("23514");

    // Acima do máximo (10%), mesmo autorizado: bloqueado
    expect(
      (await admin.from("quote_items").update({ discount: 0.11, discount_reason: "[Teste] negociação", discount_authorized: true, discount_authorized_at: new Date().toISOString() }).eq("id", s.itemId)).error,
    ).toBeNull();
    expect((await freeze(s.quoteId)).error?.message).toContain("desconto autorizado");
    // Resultado forjado como REVER_MARGEM também é recusado acima do máximo
    const { results } = await engineResults(s.quoteId);
    const forjado = await admin.rpc("freeze_quote_revision", { p_quote_id: s.quoteId, p_results: { ...results, items: results.items.map((i) => ({ ...i, status: "REVER_MARGEM" })) } });
    expect(forjado.error?.message).toContain("desconto autorizado");

    // Dentro do máximo e autorizado: segue; a autorização fica no snapshot
    expect((await admin.from("quote_items").update({ discount: 0.05 }).eq("id", s.itemId)).error).toBeNull();
    const ok = await freeze(s.quoteId);
    expect(ok.error).toBeNull();
    const rev = (await admin.from("quote_revisions").select("snapshot, total_once").eq("id", ok.data).single()).data!;
    const snap = rev.snapshot as QuoteSnapshot & { items: { discount_authorized: boolean; discount_reason: string }[] };
    expect(snap.items[0].discount_authorized).toBe(true);
    expect(snap.items[0].discount_reason).toBe("[Teste] negociação");
    expect(snap.results.items[0].status).toBe("REVER_MARGEM");
    expect(String(rev.total_once)).toBe("4025.71");
    expect(verifySnapshot(snap)).toEqual([]);
  });

  it("contrato: item mensal exige início e tempo de contrato; ambos vão para o snapshot", async () => {
    const s = await setupQuote();
    expect((await admin.from("quote_items").update({ periodicity: "mensal" }).eq("id", s.itemId)).error).toBeNull();
    const b = (await admin.rpc("quote_review_blockers", { p_quote_id: s.quoteId })).data as string[];
    expect(b.join(" ")).toContain("Início previsto do contrato");
    expect(b.join(" ")).toContain("Tempo de contrato");
    expect((await admin.from("quotes").update({ contract_months: 0 }).eq("id", s.quoteId)).error?.code).toBe("23514");
    expect((await admin.from("quotes").update({ contract_start_on: "2026-11-01", contract_months: 12 }).eq("id", s.quoteId)).error).toBeNull();
    const ok = await freeze(s.quoteId);
    expect(ok.error).toBeNull();
    const snap = (await admin.from("quote_revisions").select("snapshot").eq("id", ok.data).single()).data!.snapshot as QuoteSnapshot;
    expect(snap.quote.contract_start_on).toBe("2026-11-01");
    expect(snap.quote.contract_months).toBe(12);
    expect(snap.results.totals.mensal).toBe("4237.59");
  });

  it("isolamento: anônimo e não autorizado não leem revisões nem executam o fluxo", async () => {
    const s = await setupQuote();
    const f = await freeze(s.quoteId);
    for (const c of [intruso, anon]) {
      for (const t of ["quote_revisions", "generated_documents", "document_templates"]) {
        const r = await c.from(t).select("id").limit(5);
        expect(r.data ?? [], t).toHaveLength(0);
      }
      expect((await c.rpc("reopen_quote", { p_quote_id: s.quoteId, p_reason: "invasão" })).error).not.toBeNull();
      expect((await c.rpc("register_quote_decision", { p_quote_id: s.quoteId, p_decision: "cancelada", p_note: "invasão" })).error).not.toBeNull();
      expect((await c.rpc("log_document_download", { p_document_id: f.data })).error).not.toBeNull();
    }
  });
});
