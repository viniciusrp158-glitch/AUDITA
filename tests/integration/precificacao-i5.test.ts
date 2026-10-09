/**
 * I5 — Parâmetros financeiros versionados e cotações (AUDDOC017 RF-09 a RF-14, CA-05/06/07; AUDDOC011 §§2–9).
 * Ambiente de DESENVOLVIMENTO; todos os registros são fictícios e marcados como teste.
 */
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { calculateItem } from "@/lib/pricing/quote";
import { uniqueSuffix } from "../helpers/br";

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

/** Parâmetros fictícios usados em todos os testes do I5 (iguais aos do teste unitário do motor). */
export const TEST_PARAMS = {
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

describe.skipIf(!ready)("I5 — parâmetros e cotações", () => {
  type C = ReturnType<typeof client>;
  let admin: C;
  let intruso: C;
  let anon: C;
  const tag = uniqueSuffix();
  let clientId: string;
  let serviceId: string;

  async function newDraft(extra: Record<string, unknown> = {}) {
    const { data, error } = await admin
      .from("pricing_parameter_sets")
      .insert({ label: `[TESTE] Parâmetros fictícios ${tag}`, is_test: true, ...TEST_PARAMS, ...extra })
      .select("id, version, status, published_at")
      .single();
    if (error) throw new Error(`${error.code} ${error.message}`);
    return data!;
  }
  async function newDemand(extra: Record<string, unknown> = {}) {
    const { data, error } = await admin
      .from("demands")
      .insert({ client_id: clientId, summary: `[Teste automatizado] Cotação ${tag}`, origin: "whatsapp", is_test: true, ...extra })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data!.id as string;
  }

  beforeAll(async () => {
    admin = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    intruso = await signedIn(process.env.TEST_INTRUSO_EMAIL!, process.env.TEST_INTRUSO_PASSWORD!);
    anon = client();
    const c = await admin.from("clients").insert({ legal_name: `[Teste automatizado] Cliente Cotação ${tag}`, is_test: true }).select("id").single();
    clientId = c.data!.id;
    serviceId = (await admin.from("services").select("id").eq("service_code", "TRN-NR35").single()).data!.id;
  });

  it("versão numerada pelo banco, sempre começa em rascunho; campos podem ficar vazios (PENDENTE)", async () => {
    const a = await newDraft({ version: 999999, status: "vigente", published_at: new Date().toISOString() });
    expect(a.status).toBe("rascunho");
    expect(a.published_at).toBeNull();
    expect(a.version).not.toBe(999999);
    const b = await newDraft({ pro_labore: null, taxes: null });
    expect(b.version).toBeGreaterThan(a.version);
    const row = await admin.from("pricing_parameter_sets").select("pro_labore, taxes").eq("id", b.id).single();
    expect(row.data).toEqual({ pro_labore: null, taxes: null });
  });

  it("limites: percentuais em fração (< 100%), valores não negativos", async () => {
    for (const bad of [{ taxes: 1 }, { target_margin: 1.2 }, { pro_labore: -1 }, { max_discount: 1.01 }]) {
      const { error } = await admin.from("pricing_parameter_sets").insert({ label: `[TESTE] inválido ${tag}`, ...bad });
      expect(error?.code, JSON.stringify(bad)).toBe("23514");
    }
  });

  it("publicação: só pela função; a anterior vira substituída; vigente e substituída são imutáveis", async () => {
    const d1 = await newDraft();
    const direct = await admin.from("pricing_parameter_sets").update({ status: "vigente" }).eq("id", d1.id).select();
    expect(direct.error?.code).toBe("42501");

    expect((await admin.rpc("publish_parameter_set", { p_id: d1.id })).error).toBeNull();
    const d2 = await newDraft({ target_margin: 0.3 });
    expect((await admin.rpc("publish_parameter_set", { p_id: d2.id })).error).toBeNull();

    const both = await admin.from("pricing_parameter_sets").select("id, status, published_at").in("id", [d1.id, d2.id]);
    const st = Object.fromEntries(both.data!.map((r) => [r.id, r.status]));
    expect(st[d1.id]).toBe("substituido");
    expect(st[d2.id]).toBe("vigente");
    const vig = await admin.from("pricing_parameter_sets").select("id").eq("status", "vigente");
    expect(vig.data).toHaveLength(1);

    for (const id of [d1.id, d2.id]) {
      const upd = await admin.from("pricing_parameter_sets").update({ taxes: 0.05 }).eq("id", id).select();
      expect(upd.error?.code, "alterar publicada").toBe("42501");
      const del = await admin.from("pricing_parameter_sets").delete().eq("id", id).select();
      expect(del.error?.code, "excluir publicada").toBe("42501");
    }
    expect((await admin.rpc("publish_parameter_set", { p_id: d2.id })).error?.message).toContain("Somente rascunhos");

    // Deixa a versão de teste padrão vigente para os demais testes (inclusive e2e)
    const std = await newDraft();
    expect((await admin.rpc("publish_parameter_set", { p_id: std.id })).error).toBeNull();
  });

  it("trilha de auditoria registra criação e publicação dos parâmetros", async () => {
    const d = await newDraft();
    await admin.rpc("publish_parameter_set", { p_id: d.id });
    const log = await admin.from("audit_log").select("action, summary").eq("entity", "pricing_parameter_sets").eq("entity_id", d.id).order("id");
    expect(log.data!.map((l) => l.action)).toEqual(["insert", "update"]);
    expect(log.data![1].summary).toMatchObject({ status: { de: "rascunho", para: "vigente" } });
  });

  it("cotação PROP-AAAA-NNNN, uma por demanda, cliente derivado da demanda, só com a versão vigente", async () => {
    const vig = (await admin.from("pricing_parameter_sets").select("id").eq("status", "vigente").single()).data!;
    const old = (await admin.from("pricing_parameter_sets").select("id").eq("status", "substituido").limit(1).single()).data!;
    const other = await admin.from("clients").insert({ legal_name: `[Teste automatizado] Outro ${tag}`, is_test: true }).select("id").single();
    const demand = await newDemand();

    const withOld = await admin.from("quotes").insert({ demand_id: demand, parameter_set_id: old.id, is_test: true }).select();
    expect(withOld.error?.code).toBe("23514");

    const q = await admin
      .from("quotes")
      .insert({ demand_id: demand, client_id: other.data!.id, parameter_set_id: vig.id, quote_code: "PROP-1999-9999", status: "emitida", is_test: true })
      .select("id, quote_code, client_id, status")
      .single();
    expect(q.error).toBeNull();
    const year = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(new Date());
    expect(q.data!.quote_code).toMatch(new RegExp(`^PROP-${year}-\\d{4,}$`));
    expect(q.data!.client_id).toBe(clientId);
    expect(q.data!.status).toBe("rascunho");

    const dup = await admin.from("quotes").insert({ demand_id: demand, is_test: true }).select();
    expect(dup.error?.code).toBe("23505");

    const st = await admin.from("quotes").update({ status: "emitida" }).eq("id", q.data!.id).select();
    expect(st.error?.code).toBe("42501");
    const code = await admin.from("quotes").update({ quote_code: "PROP-0000-0001" }).eq("id", q.data!.id).select();
    expect(code.error?.code).toBe("42501");
  });

  it("demanda encerrada não recebe cotação", async () => {
    const demand = await newDemand();
    await admin.rpc("change_demand_status", { p_demand_id: demand, p_status: "cancelada", p_note: "Teste automatizado" });
    const q = await admin.from("quotes").insert({ demand_id: demand, is_test: true }).select();
    expect(q.error?.code).toBe("23514");
  });

  it("itens: inclusão, alteração e remoção no rascunho, com trilha vinculada à cotação; cálculo com os valores gravados", async () => {
    const vig = (await admin.from("pricing_parameter_sets").select("*").eq("status", "vigente").single()).data!;
    const demand = await newDemand();
    const q = (await admin.from("quotes").insert({ demand_id: demand, parameter_set_id: vig.id, is_test: true }).select("id").single()).data!;
    const item = await admin
      .from("quote_items")
      .insert({
        quote_id: q.id,
        service_id: serviceId,
        description: "[Teste] Treinamento NR-35",
        periodicity: "unica",
        hours_preparation: 4,
        hours_execution: 10,
        hours_delivery: 3,
        hours_followup: 2,
        hours_travel: 0,
        cost_travel: 150,
        cost_materials: 80,
        cost_external: 0,
        cost_other: 20,
      })
      .select("*, services(pricing_model, commercial_status, catalog_status)")
      .single();
    expect(item.error).toBeNull();

    // Valores gravados → motor: custo/hora 100; 19 h; custo base 2.150; c/ contingência 2.365
    const calc = calculateItem(vig, item.data!, item.data!.services);
    expect(calc.result.costWithContingency!.toString()).toBe("2365");
    expect(calc.status).toBe("PRONTO");
    expect(calc.notReleased).toBe(true); // TRN-NR35 ainda não liberado (AUDDOC004)
    expect(calc.result.effectiveMargin!.toDecimalPlaces(4).toString()).toBe("0.25");

    const moved = await admin.from("quote_items").update({ quote_id: crypto.randomUUID() }).eq("id", item.data!.id).select();
    expect(moved.error).not.toBeNull();
    expect((await admin.from("quote_items").update({ discount: 0.05 }).eq("id", item.data!.id)).error).toBeNull();
    expect((await admin.from("quote_items").delete().eq("id", item.data!.id)).error).toBeNull();

    const log = await admin.from("audit_log").select("action, entity").eq("parent_entity_id", q.id).eq("entity", "quote_items").order("id");
    expect(log.data!.map((l) => l.action)).toEqual(["insert", "update", "delete"]);
  });

  it("sem acesso para usuário não autorizado e anônimo", async () => {
    for (const c of [intruso, anon]) {
      for (const t of ["pricing_parameter_sets", "quotes", "quote_items"]) {
        const r = await c.from(t).select("id").limit(5);
        expect(r.data ?? [], t).toHaveLength(0);
      }
      const ins = await c.from("pricing_parameter_sets").insert({ label: "Invasão" }).select();
      expect(ins.error).not.toBeNull();
    }
    const draft = await newDraft();
    const pub = await intruso.rpc("publish_parameter_set", { p_id: draft.id });
    expect(pub.error).not.toBeNull();
    const pubAnon = await anon.rpc("publish_parameter_set", { p_id: draft.id });
    expect(pubAnon.error).not.toBeNull();
  });
});
