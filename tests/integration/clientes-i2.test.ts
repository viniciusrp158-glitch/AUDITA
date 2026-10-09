/**
 * I2 — Clientes por chamada direta à API (AUDDOC017 RF-02/03/04/08, CA-02, CA-03, CA-10).
 * Ambiente de DESENVOLVIMENTO; todos os registros criados são fictícios e marcados como teste.
 */
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { isValidCnpj } from "@/lib/br";
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

describe.skipIf(!ready)("I2 — cadastro de clientes", () => {
  type C = ReturnType<typeof client>;
  let admin: C;
  let intruso: C;
  const tag = uniqueSuffix();

  async function newClient(extra: Record<string, unknown> = {}) {
    const { data, error } = await admin
      .from("clients")
      .insert({ legal_name: `[Teste automatizado] Empresa ${tag} ${Math.random().toString(36).slice(2, 6)} LTDA`, is_test: true, ...extra })
      .select("id, client_code, status")
      .single();
    if (error) throw new Error(`${error.code} ${error.message}`);
    return data!;
  }

  beforeAll(async () => {
    admin = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    intruso = await signedIn(process.env.TEST_INTRUSO_EMAIL!, process.env.TEST_INTRUSO_PASSWORD!);
  });

  it("gerador de CNPJ de teste produz documentos válidos", () => {
    for (let i = 0; i < 20; i++) expect(isValidCnpj(randomCnpj())).toBe(true);
  });

  it("CA-02: código CLI é gerado pelo banco, sequencial e ignora valor enviado", async () => {
    const a = await newClient({ client_code: "CLI-9999" });
    const b = await newClient();
    expect(a.client_code).toMatch(/^CLI-\d{4,}$/);
    expect(a.client_code).not.toBe("CLI-9999");
    expect(Number(b.client_code.slice(4))).toBeGreaterThan(Number(a.client_code.slice(4)));
  });

  it("CA-02: código não pode ser alterado e cliente não pode ser excluído", async () => {
    const c = await newClient();
    const upd = await admin.from("clients").update({ client_code: "CLI-0000" }).eq("id", c.id);
    expect(upd.error?.code).toBe("42501");
    const del = await admin.from("clients").delete().eq("id", c.id);
    expect(del.error).not.toBeNull();
    const still = await admin.from("clients").select("client_code").eq("id", c.id).single();
    expect(still.data?.client_code).toBe(c.client_code);
  });

  it("CA-02: inativação exige motivo, preserva o código e não recicla numeração", async () => {
    const c = await newClient();
    const semMotivo = await admin.from("clients").update({ status: "inativo" }).eq("id", c.id);
    expect(semMotivo.error?.code).toBe("23514");
    const ok = await admin.from("clients").update({ status: "inativo", inactivation_reason: "Teste de inativação" }).eq("id", c.id);
    expect(ok.error).toBeNull();
    const row = await admin.from("clients").select("client_code, status, inactivated_at").eq("id", c.id).single();
    expect(row.data?.client_code).toBe(c.client_code);
    expect(row.data?.status).toBe("inativo");
    expect(row.data?.inactivated_at).not.toBeNull();
    const next = await newClient();
    expect(Number(next.client_code.slice(4))).toBeGreaterThan(Number(c.client_code.slice(4)));
    const react = await admin.from("clients").update({ status: "ativo" }).eq("id", c.id);
    expect(react.error).toBeNull();
  });

  it("CNPJ inválido é recusado e CNPJ duplicado é bloqueado", async () => {
    const invalido = await admin.from("clients").insert({ legal_name: `[Teste automatizado] Inválido ${tag}`, tax_id: "11222333000180", is_test: true });
    expect(invalido.error?.code).toBe("23514");
    const cnpj = randomCnpj();
    await newClient({ tax_id: cnpj });
    const dup = await admin.from("clients").insert({ legal_name: `[Teste automatizado] Outra ${tag}`, tax_id: cnpj, is_test: true });
    expect(dup.error?.code).toBe("23505");
  });

  it("RF-03: detecta duplicidade plausível por documento e por nome semelhante", async () => {
    const cnpj = randomCnpj();
    const c = await newClient({ tax_id: cnpj, legal_name: `[Teste automatizado] Metalúrgica Sorocabana ${tag} LTDA` });
    const porDoc = await admin.rpc("find_similar_clients", { p_name: "Nome qualquer", p_tax_id: cnpj });
    expect(porDoc.data?.[0]?.id).toBe(c.id);
    expect(porDoc.data?.[0]?.reason).toBe("mesmo_documento");
    const porNome = await admin.rpc("find_similar_clients", { p_name: `teste automatizado metalurgica sorocabana ${tag}` });
    expect(porNome.data?.some((r: { id: string }) => r.id === c.id)).toBe(true);
  });

  it("CA-03: mesmo cliente com duas unidades e contatos, sem duplicar o cadastro mestre", async () => {
    const c = await newClient();
    const u1 = await admin.from("client_units").insert({ client_id: c.id, name: "Matriz" }).select("id").single();
    const u2 = await admin.from("client_units").insert({ client_id: c.id, name: "Filial Votorantim" }).select("id").single();
    expect(u1.error).toBeNull();
    expect(u2.error).toBeNull();
    const dupUnit = await admin.from("client_units").insert({ client_id: c.id, name: "matriz" });
    expect(dupUnit.error?.code).toBe("23505");

    const k1 = await admin.from("client_contacts").insert({ client_id: c.id, unit_id: u1.data!.id, full_name: "Contato Fictício A", email: "a@exemplo.test", is_primary: true });
    const k2 = await admin.from("client_contacts").insert({ client_id: c.id, unit_id: u2.data!.id, full_name: "Contato Fictício B", phone: "15999998888" });
    expect(k1.error).toBeNull();
    expect(k2.error).toBeNull();
    const twoPrimary = await admin.from("client_contacts").insert({ client_id: c.id, full_name: "Contato Fictício C", email: "c@exemplo.test", is_primary: true });
    expect(twoPrimary.error?.code).toBe("23505");

    const units = await admin.from("client_units").select("id").eq("client_id", c.id);
    expect(units.data).toHaveLength(2);
    const masters = await admin.from("clients").select("id").eq("id", c.id);
    expect(masters.data).toHaveLength(1);
  });

  it("contato não pode ser vinculado a unidade de outro cliente; vínculo não pode mudar", async () => {
    const a = await newClient();
    const b = await newClient();
    const ub = await admin.from("client_units").insert({ client_id: b.id, name: "Unidade B" }).select("id").single();
    const wrong = await admin.from("client_contacts").insert({ client_id: a.id, unit_id: ub.data!.id, full_name: "Contato Errado", email: "x@exemplo.test" });
    expect(wrong.error?.code).toBe("23514");
    const move = await admin.from("client_units").update({ client_id: a.id }).eq("id", ub.data!.id);
    expect(move.error?.code).toBe("42501");
  });

  it("histórico: alterações do cliente e das unidades ficam vinculadas ao cliente", async () => {
    const c = await newClient();
    await admin.from("clients").update({ segment: "Metalurgia (fictício)" }).eq("id", c.id);
    await admin.from("client_units").insert({ client_id: c.id, name: "Unidade Histórico" });
    const log = await admin.from("audit_log").select("action, entity, summary").eq("parent_entity_id", c.id).order("id");
    const kinds = (log.data ?? []).map((r) => `${r.entity}:${r.action}`);
    expect(kinds).toEqual(expect.arrayContaining(["clients:insert", "clients:update", "client_units:insert"]));
    const upd = log.data!.find((r) => r.entity === "clients" && r.action === "update");
    expect(upd?.summary).toHaveProperty("segment");
  });

  it("CA-10: usuário sem autorização não lê nem grava clientes", async () => {
    const list = await intruso.from("clients").select("id").limit(5);
    expect(list.data).toEqual([]);
    const ins = await intruso.from("clients").insert({ legal_name: "[Teste automatizado] Intruso", is_test: true });
    expect(ins.error?.code).toBe("42501");
    const units = await intruso.from("client_units").select("id").limit(1);
    expect(units.data).toEqual([]);
    const counters = await admin.from("code_counters").select("*");
    expect(counters.error?.code).toBe("42501");
  });
});
