/**
 * I3 — Catálogo de serviços por chamada direta à API (AUDDOC017 RF-05, RF-17, CA-04; AUDDOC004/005).
 * Ambiente de DESENVOLVIMENTO. Decisões de teste são revertidas ao final, deixando o registro no histórico.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

const RESTORE = "[Teste automatizado] Retorno à situação da AUDDOC004 Rev.00 após teste.";

describe.skipIf(!ready)("I3 — catálogo de serviços", () => {
  type C = ReturnType<typeof client>;
  let admin: C;
  let intruso: C;
  let anon: C;
  let esp7: { id: string; commercial_status: string; catalog_status: string };

  beforeAll(async () => {
    admin = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    intruso = await signedIn(process.env.TEST_INTRUSO_EMAIL!, process.env.TEST_INTRUSO_PASSWORD!);
    anon = client();
    const { data } = await admin.from("services").select("id, commercial_status, catalog_status").eq("service_code", "ESP-007").single();
    esp7 = data!;
  });

  afterAll(async () => {
    // Restaura ESP-007 ao estado inicial (ativo, não liberado), registrando a reversão.
    await admin.from("services").update({ catalog_status: "ativo" }).eq("id", esp7.id);
    const { data } = await admin.from("services").select("commercial_status").eq("id", esp7.id).single();
    if (data?.commercial_status !== "nao_liberado") {
      await admin.from("services").update({ commercial_status: "nao_liberado", status_basis: RESTORE }).eq("id", esp7.id);
    }
  });

  it("RF-05: 33 serviços da matriz + 12 ofertas de treinamento vinculadas ao TRN-005", async () => {
    const { data } = await admin.from("services").select("id, service_code, kind, parent_id");
    const servicos = data!.filter((s) => s.kind === "servico");
    const ofertas = data!.filter((s) => s.kind === "oferta");
    expect(servicos).toHaveLength(33);
    expect(ofertas).toHaveLength(12);
    const trn005 = servicos.find((s) => s.service_code === "TRN-005")!;
    expect(ofertas.every((o) => o.parent_id === trn005.id)).toBe(true);
  });

  it("nenhum serviço foi liberado pela carga inicial: registro inicial de todos é 'Não liberado'", async () => {
    const { data } = await admin.from("service_status_history").select("service_id, to_status, reference").is("from_status", null);
    expect(data).toHaveLength(45);
    expect(data!.every((h) => h.to_status === "nao_liberado")).toBe(true);
    expect(data!.every((h) => (h.reference ?? "").startsWith("AUDDOC004 Rev.00"))).toBe(true);
  });

  it("SaaS (SIS-001/SIS-002) não usa automaticamente a hora técnica (AUDDOC011 §6)", async () => {
    const { data } = await admin.from("services").select("service_code, pricing_model").in("service_code", ["SIS-001", "SIS-002", "SST-001"]);
    const m = Object.fromEntries(data!.map((r) => [r.service_code, r.pricing_model]));
    expect(m["SIS-001"]).toBe("sem_modelo_definido");
    expect(m["SIS-002"]).toBe("sem_modelo_definido");
    expect(m["SST-001"]).toBe("hora_tecnica");
  });

  it("CA-04: serviço não liberado não permite proposta comercial final", async () => {
    const { data } = await admin.from("services").select("id").eq("service_code", "SST-001").single();
    const r = await admin.rpc("service_allows_commercial_proposal", { p_service_id: data!.id });
    expect(r.data).toBe(false);
  });

  it("mudança de situação exige fundamento; fundamento não pode ser alterado sem decisão", async () => {
    const semFundamento = await admin.from("services").update({ commercial_status: "expansao_futura" }).eq("id", esp7.id);
    expect(semFundamento.error?.code).toBe("23514");
    const curto = await admin.from("services").update({ commercial_status: "expansao_futura", status_basis: "curto" }).eq("id", esp7.id);
    expect(curto.error?.code).toBe("23514");
    const soFundamento = await admin.from("services").update({ status_basis: "[Teste automatizado] tentativa de reescrever fundamento" }).eq("id", esp7.id);
    expect(soFundamento.error?.code).toBe("42501");
  });

  it("decisão gera histórico imutável; liberação só vale com serviço ativo no catálogo", async () => {
    const t = Date.now();
    const ok = await admin
      .from("services")
      .update({ commercial_status: "apto_comercialmente", status_basis: `[Teste automatizado ${t}] Liberação simulada para teste.`, status_reference: "Teste" })
      .eq("id", esp7.id);
    expect(ok.error).toBeNull();
    expect((await admin.rpc("service_allows_commercial_proposal", { p_service_id: esp7.id })).data).toBe(true);

    const hist = await admin.from("service_status_history").select("id, from_status, to_status, basis").eq("service_id", esp7.id).order("id", { ascending: false }).limit(1).single();
    expect(hist.data?.to_status).toBe("apto_comercialmente");
    expect(hist.data?.basis).toContain(String(t));
    const tamper = await admin.from("service_status_history").update({ basis: "x" }).eq("id", hist.data!.id);
    expect(tamper.error).not.toBeNull();

    // Inativo no catálogo: não gera proposta e não pode ser (re)liberado
    await admin.from("services").update({ catalog_status: "inativo" }).eq("id", esp7.id);
    expect((await admin.rpc("service_allows_commercial_proposal", { p_service_id: esp7.id })).data).toBe(false);
    await admin.from("services").update({ commercial_status: "nao_liberado", status_basis: RESTORE }).eq("id", esp7.id);
    const reliberar = await admin
      .from("services")
      .update({ commercial_status: "apto_comercialmente", status_basis: "[Teste automatizado] tentativa com serviço inativo" })
      .eq("id", esp7.id);
    expect(reliberar.error?.code).toBe("23514");
  });

  it("código, tipo e vínculo são permanentes; catálogo não aceita inclusão nem exclusão pela API", async () => {
    const cod = await admin.from("services").update({ service_code: "ESP-999" }).eq("id", esp7.id);
    expect(cod.error?.code).toBe("42501");
    const ins = await admin.from("services").insert({ service_code: "TST-999", kind: "servico", name: "Teste", family: "Teste", matrix_class: "B", matrix_class_label: "B", status_basis: "teste de inclusão" });
    expect(ins.error?.code).toBe("42501");
    const del = await admin.from("services").delete().eq("id", esp7.id);
    expect(del.error).not.toBeNull();
  });

  it("isolamento: anônimo e usuário sem autorização não leem nem alteram o catálogo", async () => {
    expect((await anon.from("services").select("id").limit(1)).error?.code).toBe("42501");
    expect((await intruso.from("services").select("id").limit(1)).data).toEqual([]);
    expect((await intruso.from("service_status_history").select("id").limit(1)).data).toEqual([]);
    const upd = await intruso.from("services").update({ audita_notes: "x" }).eq("id", esp7.id).select("id");
    expect(upd.data ?? []).toEqual([]);
  });
});
