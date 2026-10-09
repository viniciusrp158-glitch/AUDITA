/**
 * I4 — Demandas (RUA) por chamada direta à API (AUDDOC017 RF-06, FL-05; AUDDOC009 §8).
 * Ambiente de DESENVOLVIMENTO; registros fictícios marcados como teste.
 */
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
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
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

describe.skipIf(!ready)("I4 — demandas", () => {
  type C = ReturnType<typeof client>;
  let admin: C;
  let intruso: C;
  let anon: C;
  const tag = uniqueSuffix();
  let clientA: string;
  let clientB: string;
  let unitB: string;
  let serviceId: string;

  async function newClient(name: string) {
    const { data, error } = await admin.from("clients").insert({ legal_name: `[Teste automatizado] ${name} ${tag}`, is_test: true }).select("id").single();
    if (error) throw new Error(error.message);
    return data!.id as string;
  }
  async function newDemand(extra: Record<string, unknown> = {}) {
    const { data, error } = await admin
      .from("demands")
      .insert({ client_id: clientA, summary: `[Teste automatizado] Demanda ${tag}`, origin: "whatsapp", is_test: true, ...extra })
      .select("id, demand_code, status, closed_at")
      .single();
    if (error) throw new Error(`${error.code} ${error.message}`);
    return data!;
  }

  beforeAll(async () => {
    admin = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    intruso = await signedIn(process.env.TEST_INTRUSO_EMAIL!, process.env.TEST_INTRUSO_PASSWORD!);
    anon = client();
    clientA = await newClient("Demandas A");
    clientB = await newClient("Demandas B");
    unitB = (await admin.from("client_units").insert({ client_id: clientB, name: "Unidade B" }).select("id").single()).data!.id;
    serviceId = (await admin.from("services").select("id").eq("service_code", "TRN-NR35").single()).data!.id;
  });

  it("código DEM-AAAA-NNNN gerado pelo banco, sequencial, ignorando valor enviado; começa 'Recebida'", async () => {
    const a = await newDemand({ demand_code: "DEM-1999-9999", status: "encerrada" });
    const b = await newDemand();
    const year = today().slice(0, 4);
    expect(a.demand_code).toMatch(new RegExp(`^DEM-${year}-\\d{4,}$`));
    expect(a.status).toBe("recebida");
    expect(a.closed_at).toBeNull();
    expect(Number(b.demand_code.slice(9))).toBeGreaterThan(Number(a.demand_code.slice(9)));
    const ev = await admin.from("demand_events").select("event_type, to_status").eq("demand_id", a.id);
    expect(ev.data).toEqual([{ event_type: "situacao", to_status: "recebida" }]);
  });

  it("código permanente, sem exclusão; situação só muda pela função própria", async () => {
    const d = await newDemand();
    expect((await admin.from("demands").update({ demand_code: "DEM-0000-0000" }).eq("id", d.id)).error?.code).toBe("42501");
    expect((await admin.from("demands").update({ status: "encerrada" }).eq("id", d.id)).error?.code).toBe("42501");
    expect((await admin.from("demands").delete().eq("id", d.id)).error).not.toBeNull();
  });

  it("FL-05: transições livres, eventos de situação, encerramento e reabertura", async () => {
    const d = await newDemand({ service_id: serviceId, is_recurring: true });
    expect((await admin.rpc("change_demand_status", { p_demand_id: d.id, p_status: "em_analise", p_note: null })).error).toBeNull();
    // Pula etapas (AUDDOC009: estados são referências)
    expect((await admin.rpc("change_demand_status", { p_demand_id: d.id, p_status: "em_execucao", p_note: "Contrato recorrente iniciado" })).error).toBeNull();
    expect((await admin.rpc("change_demand_status", { p_demand_id: d.id, p_status: "em_execucao" })).error).not.toBeNull();
    expect((await admin.rpc("change_demand_status", { p_demand_id: d.id, p_status: "encerrada" })).error).toBeNull();
    let row = await admin.from("demands").select("status, closed_at").eq("id", d.id).single();
    expect(row.data?.status).toBe("encerrada");
    expect(row.data?.closed_at).not.toBeNull();
    expect((await admin.rpc("change_demand_status", { p_demand_id: d.id, p_status: "em_execucao", p_note: "Reaberta" })).error).toBeNull();
    row = await admin.from("demands").select("status, closed_at").eq("id", d.id).single();
    expect(row.data).toEqual({ status: "em_execucao", closed_at: null });

    const ev = await admin.from("demand_events").select("to_status").eq("demand_id", d.id).eq("event_type", "situacao").order("id");
    expect(ev.data!.map((e) => e.to_status)).toEqual(["recebida", "em_analise", "em_execucao", "encerrada", "em_execucao"]);
  });

  it("cancelar e 'não viável' exigem motivo", async () => {
    const d = await newDemand();
    expect((await admin.rpc("change_demand_status", { p_demand_id: d.id, p_status: "cancelada", p_note: "" })).error?.code).toBe("23514");
    expect((await admin.rpc("change_demand_status", { p_demand_id: d.id, p_status: "nao_viavel", p_note: " " })).error?.code).toBe("23514");
    expect((await admin.rpc("change_demand_status", { p_demand_id: d.id, p_status: "nao_viavel", p_note: "Exige laudo de engenheiro (ESP)" })).error).toBeNull();
  });

  it("contrato recorrente: visitas e contatos na mesma demanda; linha do tempo somente inclusão", async () => {
    const d = await newDemand({ is_recurring: true });
    for (const t of ["visita", "contato", "nota"]) {
      expect((await admin.from("demand_events").insert({ demand_id: d.id, event_type: t, description: `Registro ${t}` })).error).toBeNull();
    }
    const forged = await admin.from("demand_events").insert({ demand_id: d.id, event_type: "situacao", to_status: "encerrada", description: "forjado" });
    expect(forged.error?.code).toBe("42501");
    const ev = await admin.from("demand_events").select("id").eq("demand_id", d.id).order("id", { ascending: false }).limit(1).single();
    expect((await admin.from("demand_events").update({ description: "x" }).eq("id", ev.data!.id)).error).not.toBeNull();
    expect((await admin.from("demand_events").delete().eq("id", ev.data!.id)).error).not.toBeNull();
    const count = await admin.from("demands").select("id", { count: "exact", head: true }).eq("id", d.id);
    expect(count.count).toBe(1);
  });

  it("vínculos coerentes: unidade e contato do mesmo cliente; cliente inativo não recebe demanda", async () => {
    const wrongUnit = await admin.from("demands").insert({ client_id: clientA, unit_id: unitB, summary: "[Teste automatizado] Unidade errada", is_test: true });
    expect(wrongUnit.error?.code).toBe("23514");
    const ok = await admin.from("demands").insert({ client_id: clientB, unit_id: unitB, summary: "[Teste automatizado] Unidade certa", is_test: true });
    expect(ok.error).toBeNull();
    const inativo = await newClient("Inativo");
    await admin.from("clients").update({ status: "inativo", inactivation_reason: "Teste automatizado" }).eq("id", inativo);
    const r = await admin.from("demands").insert({ client_id: inativo, summary: "[Teste automatizado] Cliente inativo", is_test: true });
    expect(r.error?.code).toBe("23514");
  });

  it("prazo não pode ser anterior ao recebimento", async () => {
    const r = await admin.from("demands").insert({ client_id: clientA, summary: "[Teste automatizado] Prazo", received_on: "2026-10-09", due_on: "2026-10-01", is_test: true });
    expect(r.error?.code).toBe("23514");
  });

  it("histórico do cliente registra a demanda; isolamento de anônimo e não autorizado", async () => {
    await newDemand();
    const log = await admin.from("audit_log").select("entity").eq("parent_entity_id", clientA).eq("entity", "demands").limit(1);
    expect(log.data).toHaveLength(1);
    expect((await anon.from("demands").select("id").limit(1)).error?.code).toBe("42501");
    expect((await intruso.from("demands").select("id").limit(1)).data).toEqual([]);
    expect((await intruso.from("demand_events").select("id").limit(1)).data).toEqual([]);
    const ins = await intruso.from("demands").insert({ client_id: clientA, summary: "[Teste automatizado] Intruso" });
    expect(ins.error?.code).toBe("42501");
    const rpc = await intruso.rpc("change_demand_status", { p_demand_id: crypto.randomUUID(), p_status: "encerrada" });
    expect(rpc.error).not.toBeNull();
  });
});
