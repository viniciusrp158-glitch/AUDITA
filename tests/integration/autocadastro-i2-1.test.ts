/**
 * I2.1 — Autocadastro por link individual: segurança da área pública, uso único, validade,
 * aceite do termo, imutabilidade do envio e aprovação/recusa (ambiente de DESENVOLVIMENTO, dados fictícios).
 */
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
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
const token = () => randomBytes(32).toString("base64url");
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

describe.skipIf(!ready)("I2.1 — autocadastro por link", () => {
  type C = ReturnType<typeof client>;
  let admin: C;
  let intruso: C;
  let anon: C;
  let terms = "";
  const tag = uniqueSuffix();

  async function invite(extra: Record<string, unknown> = {}) {
    const t = token();
    const { data, error } = await admin
      .from("client_invites")
      .insert({ token_hash: hash(t), recipient: `[Teste automatizado] ${tag}`, is_test: true, ...extra })
      .select("id, expires_at")
      .single();
    if (error) throw new Error(`${error.code} ${error.message}`);
    return { t, id: data!.id as string, expires_at: data!.expires_at as string };
  }

  function payload(name = `[Teste automatizado] Autocadastro ${tag} ${Math.random().toString(36).slice(2, 6)} LTDA`) {
    return {
      client: { person_type: "PJ", legal_name: name, tax_id: randomCnpj(), address_city: "Sorocaba", address_state: "SP" },
      units: [{ name: "Filial Votorantim", address_city: "Votorantim", address_state: "SP" }],
      contacts: [
        { full_name: "Contato Fictício Principal", email: "principal@exemplo.test", is_primary: true, unit_index: null },
        { full_name: "Contato Fictício Filial", phone: "15999998888", is_primary: false, unit_index: 0 },
      ],
    };
  }

  beforeAll(async () => {
    admin = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    intruso = await signedIn(process.env.TEST_INTRUSO_EMAIL!, process.env.TEST_INTRUSO_PASSWORD!);
    anon = client();
    const { data } = await admin.from("consent_terms").select("version").eq("is_current", true).single();
    terms = data!.version;
  });

  it("validade máxima de 24 h é imposta pelo banco", async () => {
    const i = await invite({ expires_at: new Date(Date.now() + 7 * 86400_000).toISOString() });
    const diffH = (new Date(i.expires_at).getTime() - Date.now()) / 3600_000;
    expect(diffH).toBeLessThanOrEqual(24.01);
    expect(diffH).toBeGreaterThan(23.9);
  });

  it("área pública: anônimo não lê tabelas e só usa as duas funções permitidas", async () => {
    for (const t of ["client_invites", "client_registration_requests", "consent_terms", "clients"]) {
      const r = await anon.from(t).select("*").limit(1);
      expect(r.error?.code, t).toBe("42501");
    }
    const appr = await anon.rpc("approve_registration", { p_request_id: crypto.randomUUID(), p_client: {}, p_is_test: true });
    expect(appr.error).not.toBeNull();
    const ctx = await anon.rpc("invite_context", { p_token: token() });
    expect(ctx.data?.[0]?.status).toBe("invalido");
  });

  it("link válido mostra termo vigente e não revela o destinatário", async () => {
    const i = await invite();
    const { data } = await anon.rpc("invite_context", { p_token: i.t });
    expect(data?.[0]?.status).toBe("valido");
    expect(data?.[0]?.terms_version).toBe(terms);
    expect(JSON.stringify(data)).not.toContain(tag);
  });

  it("envio exige aceite da versão vigente do termo", async () => {
    const i = await invite();
    const semAceite = await anon.rpc("submit_registration", { p_token: i.t, p_payload: payload(), p_terms_version: terms, p_accept: false });
    expect(semAceite.error?.message).toContain("aceitar");
    const versaoErrada = await anon.rpc("submit_registration", { p_token: i.t, p_payload: payload(), p_terms_version: "TERMO-X", p_accept: true });
    expect(versaoErrada.error?.message).toContain("aceitar");
  });

  it("validação no servidor: CNPJ inválido e contato sem meio de contato são recusados", async () => {
    const i = await invite();
    const p1 = payload();
    p1.client.tax_id = "11222333000180";
    const r1 = await anon.rpc("submit_registration", { p_token: i.t, p_payload: p1, p_terms_version: terms, p_accept: true });
    expect(r1.error?.message).toContain("CNPJ/CPF inválido");
    const p2 = payload();
    p2.contacts = [{ full_name: "Sem contato", is_primary: false, unit_index: null } as never];
    const r2 = await anon.rpc("submit_registration", { p_token: i.t, p_payload: p2, p_terms_version: terms, p_accept: true });
    expect(r2.error).not.toBeNull();
  });

  it("link de uso único: segundo envio é recusado e o status passa a 'utilizado'", async () => {
    const i = await invite();
    const ok = await anon.rpc("submit_registration", { p_token: i.t, p_payload: payload(), p_terms_version: terms, p_accept: true });
    expect(ok.error).toBeNull();
    expect(ok.data).toBe("recebido");
    const again = await anon.rpc("submit_registration", { p_token: i.t, p_payload: payload(), p_terms_version: terms, p_accept: true });
    expect(again.error?.message).toContain("já foi utilizado");
    const ctx = await anon.rpc("invite_context", { p_token: i.t });
    expect(ctx.data?.[0]?.status).toBe("utilizado");
  });

  it("link expirado e link cancelado não aceitam envio", async () => {
    const exp = await invite({ expires_at: new Date(Date.now() - 60_000).toISOString() });
    const r1 = await anon.rpc("submit_registration", { p_token: exp.t, p_payload: payload(), p_terms_version: terms, p_accept: true });
    expect(r1.error?.message).toContain("expirou");
    const can = await invite();
    await admin.from("client_invites").update({ cancelled_at: new Date().toISOString() }).eq("id", can.id);
    const r2 = await anon.rpc("submit_registration", { p_token: can.t, p_payload: payload(), p_terms_version: terms, p_accept: true });
    expect(r2.error?.message).toContain("cancelado");
  });

  it("uso do convite não pode ser forjado nem os dados do convite alterados", async () => {
    const i = await invite();
    const forge = await admin.from("client_invites").update({ used_at: new Date().toISOString() }).eq("id", i.id);
    expect(forge.error?.code).toBe("42501");
    const ext = await admin.from("client_invites").update({ expires_at: new Date(Date.now() + 999e6).toISOString() }).eq("id", i.id);
    expect(ext.error?.code).toBe("42501");
  });

  it("aprovação cria cliente com código, unidade e contatos vinculados; envio original é imutável", async () => {
    const i = await invite();
    const p = payload();
    await anon.rpc("submit_registration", { p_token: i.t, p_payload: p, p_terms_version: terms, p_accept: true });
    const req = await admin.from("client_registration_requests").select("id, status, payload").eq("invite_id", i.id).single();
    expect(req.data?.status).toBe("pendente");

    const tamper = await admin.from("client_registration_requests").update({ payload: { client: {} } }).eq("id", req.data!.id);
    expect(tamper.error?.code).toBe("42501");

    const { data: clientId, error } = await admin.rpc("approve_registration", {
      p_request_id: req.data!.id,
      p_client: { ...p.client, segment: "Segmento corrigido na análise" },
      p_is_test: true,
    });
    expect(error).toBeNull();
    const c = await admin.from("clients").select("client_code, segment, is_test").eq("id", clientId).single();
    expect(c.data?.client_code).toMatch(/^CLI-\d{4,}$/);
    expect(c.data?.segment).toBe("Segmento corrigido na análise");
    expect(c.data?.is_test).toBe(true);
    const units = await admin.from("client_units").select("id, name").eq("client_id", clientId);
    expect(units.data).toHaveLength(1);
    const contacts = await admin.from("client_contacts").select("full_name, unit_id, is_primary").eq("client_id", clientId).order("full_name");
    expect(contacts.data).toHaveLength(2);
    const filial = contacts.data!.find((k) => k.full_name.includes("Filial"));
    expect(filial?.unit_id).toBe(units.data![0].id);
    expect(contacts.data!.filter((k) => k.is_primary)).toHaveLength(1);

    const after = await admin.from("client_registration_requests").select("status, client_id").eq("id", req.data!.id).single();
    expect(after.data).toEqual({ status: "aprovada", client_id: clientId });
    const twice = await admin.rpc("approve_registration", { p_request_id: req.data!.id, p_client: p.client, p_is_test: true });
    expect(twice.error).not.toBeNull();
  });

  it("recusa exige motivo e não cria cliente", async () => {
    const i = await invite();
    await anon.rpc("submit_registration", { p_token: i.t, p_payload: payload(), p_terms_version: terms, p_accept: true });
    const req = await admin.from("client_registration_requests").select("id").eq("invite_id", i.id).single();
    const semMotivo = await admin.from("client_registration_requests").update({ status: "recusada" }).eq("id", req.data!.id);
    expect(semMotivo.error?.code).toBe("23514");
    const ok = await admin.from("client_registration_requests").update({ status: "recusada", review_note: "Teste de recusa" }).eq("id", req.data!.id);
    expect(ok.error).toBeNull();
    const r = await admin.from("client_registration_requests").select("status, client_id").eq("id", req.data!.id).single();
    expect(r.data).toEqual({ status: "recusada", client_id: null });
  });

  it("usuário autenticado sem autorização não vê convites nem solicitações e não aprova", async () => {
    expect((await intruso.from("client_invites").select("id").limit(1)).data).toEqual([]);
    expect((await intruso.from("client_registration_requests").select("id").limit(1)).data).toEqual([]);
    const appr = await intruso.rpc("approve_registration", { p_request_id: crypto.randomUUID(), p_client: {}, p_is_test: true });
    expect(appr.error).not.toBeNull();
    const ins = await intruso.from("client_invites").insert({ token_hash: hash(token()), recipient: "Intruso" });
    expect(ins.error?.code).toBe("42501");
  });
});
