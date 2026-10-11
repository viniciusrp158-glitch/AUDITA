/**
 * I9.1 — Níveis de acesso e usuário mestre, por chamada direta ao banco e à função "usuarios" (AUDDOC017 §10).
 * Modo MAIS RESTRITIVO (decisão do Diretor, 10/10/2026): o operador só faz o que o AUDDOC017 define; o marketing
 * não acessa nenhum módulo até o I10. Usuários fictícios de teste (ambiente de desenvolvimento).
 */
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { uniqueSuffix } from "../helpers/br";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const ready = Boolean(url && key && process.env.TEST_ADMIN_EMAIL && process.env.TEST_OPERADOR_EMAIL && process.env.TEST_MARKETING_EMAIL);

const client = () => createClient(url, key, { db: { schema: "audita" }, auth: { persistSession: false, autoRefreshToken: false } });
type C = ReturnType<typeof client>;
async function signedIn(email: string, password: string) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login de teste (${email}): ${error.message}`);
  return c;
}
async function token(c: C) {
  return (await c.auth.getSession()).data.session!.access_token;
}
async function usersFn(c: C | null, body: Record<string, unknown>) {
  const res = await fetch(`${url}/functions/v1/usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, ...(c ? { Authorization: `Bearer ${await token(c)}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

describe.skipIf(!ready)("I9.1 — níveis de acesso (modo mais restritivo) e usuário mestre", () => {
  let mestre: C;
  let operador: C;
  let marketing: C;
  let intruso: C;
  const tag = uniqueSuffix();

  beforeAll(async () => {
    mestre = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    operador = await signedIn(process.env.TEST_OPERADOR_EMAIL!, process.env.TEST_OPERADOR_PASSWORD!);
    marketing = await signedIn(process.env.TEST_MARKETING_EMAIL!, process.env.TEST_MARKETING_PASSWORD!);
    intruso = await signedIn(process.env.TEST_INTRUSO_EMAIL!, process.env.TEST_INTRUSO_PASSWORD!);
  });

  it("níveis reconhecidos pelo banco; só o mestre é mestre", async () => {
    expect((await mestre.rpc("current_app_role")).data).toBe("admin");
    expect((await operador.rpc("current_app_role")).data).toBe("operador");
    expect((await marketing.rpc("current_app_role")).data).toBe("marketing");
    expect((await intruso.rpc("current_app_role")).data).toBeNull();
    expect((await mestre.rpc("is_master")).data).toBe(true);
    for (const c of [operador, marketing, intruso]) expect((await c.rpc("is_master")).data).toBe(false);
    for (const c of [operador, marketing]) expect((await c.rpc("is_admin")).data).toBe(false);
  });

  it("operador: cadastra cliente, demanda e prepara orçamento sem preço", async () => {
    const c = await operador
      .from("clients")
      .insert({ legal_name: `[Teste automatizado] Operador ${tag} LTDA`, is_test: true })
      .select("id, client_code")
      .single();
    expect(c.error).toBeNull();
    expect(c.data!.client_code).toMatch(/^CLI-\d{4,}$/);
    const svc = (await operador.from("services").select("id").eq("service_code", "TRN-001").single()).data!;
    const d = await operador
      .from("demands")
      .insert({ client_id: c.data!.id, summary: `[Teste automatizado] Demanda do operador ${tag}`, service_id: svc.id, is_test: true })
      .select("id")
      .single();
    expect(d.error).toBeNull();
    const st = await operador.rpc("change_demand_status", { p_demand_id: d.data!.id, p_status: "em_analise", p_note: null });
    expect(st.error).toBeNull();

    // Cotação sem versão de parâmetros (é o administrador quem adota)
    const vigente = (await mestre.from("pricing_parameter_sets").select("id").eq("status", "vigente").maybeSingle()).data;
    if (vigente) {
      const withParams = await operador.from("quotes").insert({ demand_id: d.data!.id, parameter_set_id: vigente.id, is_test: true });
      expect(withParams.error?.code).toBe("42501");
    }
    const q = await operador.from("quotes").insert({ demand_id: d.data!.id, is_test: true }).select("id").single();
    expect(q.error).toBeNull();

    // Item: horas e despesas sim; margem, contingência e desconto não
    const blocked = await operador.from("quote_items").insert({ quote_id: q.data!.id, service_id: svc.id, description: "[Teste] Item", margin: 0.5 });
    expect(blocked.error?.code).toBe("42501");
    const it = await operador
      .from("quote_items")
      .insert({ quote_id: q.data!.id, service_id: svc.id, description: "[Teste] Item do operador", hours_execution: 10, cost_other: 100 })
      .select("id")
      .single();
    expect(it.error).toBeNull();
    const disc = await operador.from("quote_items").update({ discount: 0.05, discount_reason: "x" }).eq("id", it.data!.id);
    expect(disc.error?.code).toBe("42501");
    const hours = await operador.from("quote_items").update({ hours_execution: 12 }).eq("id", it.data!.id).select("id");
    expect(hours.error).toBeNull();
    expect(hours.data).toHaveLength(1);

    // Não conclui revisão nem adota parâmetros
    const freeze = await operador.rpc("freeze_quote_revision", { p_quote_id: q.data!.id, p_results: [], p_reason: null });
    expect(freeze.error?.code).toBe("42501");
    const vig = (await mestre.from("pricing_parameter_sets").select("id").eq("status", "vigente").maybeSingle()).data;
    if (vig) {
      const adopt = await operador.from("quotes").update({ parameter_set_id: vig.id }).eq("id", q.data!.id);
      expect(adopt.error?.code).toBe("42501");
      // o administrador adota normalmente
      const ok = await mestre.from("quotes").update({ parameter_set_id: vig.id }).eq("id", q.data!.id).select("id");
      expect(ok.error).toBeNull();
    }
  });

  it("operador não lê preços, revisões, documentos, autocadastro, biblioteca nem histórico de orçamentos", async () => {
    for (const t of ["pricing_parameter_sets", "quote_revisions", "generated_documents", "client_invites", "client_registration_requests", "consent_terms", "library_documents", "library_revisions", "service_status_history"]) {
      const r = await operador.from(t).select("*").limit(3);
      expect(r.data ?? [], t).toEqual([]);
      // o mestre continua lendo
      const m = await mestre.from(t).select("*").limit(1);
      expect(m.error, t).toBeNull();
    }
    const log = await operador.from("audit_log").select("entity").in("entity", ["quotes", "quote_items", "pricing_parameter_sets", "app_users"]).limit(5);
    expect(log.data ?? []).toEqual([]);
    const logClients = await operador.from("audit_log").select("entity").eq("entity", "clients").limit(1);
    expect(logClients.data).toHaveLength(1);
    for (const bucket of ["audita-documentos", "audita-biblioteca"]) {
      expect((await operador.storage.from(bucket).list(bucket === "audita-documentos" ? "quotes" : "library")).data ?? []).toEqual([]);
    }
    const id = crypto.randomUUID();
    const calls: [string, Record<string, unknown>][] = [
      ["freeze_quote_revision", { p_quote_id: id, p_results: [], p_reason: null }],
      ["register_emission", { p_revision_id: id, p_template_id: id, p_watermark: true, p_docs: [] }],
      ["register_quote_decision", { p_quote_id: id, p_decision: "aceita", p_date: "2026-10-10", p_name: "X", p_reference: "X", p_note: null }],
      ["reopen_quote", { p_quote_id: id, p_reason: "X" }],
      ["approve_registration", { p_request_id: id, p_client: {}, p_is_test: true }],
      ["publish_parameter_set", { p_id: id }],
    ];
    for (const [fn, args] of calls) {
      const r = await operador.rpc(fn, args);
      expect(r.error?.code, fn).toBe("42501");
    }
  });

  it("marketing: somente a própria conta e o módulo de Comunicação (I10)", async () => {
    const tables = ((await mestre.rpc("security_self_check")).data as { tables: { name: string }[] }).tables.map((t) => t.name);
    // I10: o marketing lê as tabelas de comunicação; dos arquivos de marca, só versões aprovadas
    const COMM = ["brand_assets", "brand_asset_versions", "comm_campaigns", "comm_pieces", "comm_piece_versions", "comm_exports"];
    for (const t of tables) {
      const r = await marketing.from(t).select("*").limit(3);
      if (t === "app_users") {
        expect(r.data ?? []).toHaveLength(1); // só a própria linha
      } else if (COMM.includes(t)) {
        expect(r.error, t).toBeNull();
        if (t === "brand_asset_versions") for (const v of r.data ?? []) expect(v.status).toBe("aprovado");
      } else {
        expect(r.data ?? [], t).toEqual([]);
      }
    }
    expect((await marketing.from("clients").insert({ legal_name: "[Teste] Marketing", is_test: true })).error?.code).toBe("42501");
    expect((await marketing.storage.from("audita-biblioteca").list("library")).data ?? []).toEqual([]);
  });

  it("conta: cada um altera o próprio nome, cargo e tema; nível, situação e mestre só pelo mestre", async () => {
    const me = (await operador.auth.getUser()).data.user!.id;
    const own = await operador.from("app_users").update({ job_title: "Teste automatizado", theme: "escuro" }).eq("user_id", me).select("theme");
    expect(own.error).toBeNull();
    expect(own.data![0].theme).toBe("escuro");
    await operador.from("app_users").update({ theme: "claro" }).eq("user_id", me);
    expect((await operador.from("app_users").update({ role: "admin" }).eq("user_id", me)).error?.code).toBe("42501");
    expect((await operador.from("app_users").update({ is_master: true }).eq("user_id", me)).error?.code).toBe("42501");
    // o operador não altera outra pessoa
    const mk = (await marketing.auth.getUser()).data.user!.id;
    const other = await operador.from("app_users").update({ job_title: "Invasão" }).eq("user_id", mk).select("user_id");
    expect(other.data ?? []).toEqual([]);
    // o mestre altera o nível e devolve; não pode rebaixar a si mesmo
    const up = await mestre.from("app_users").update({ role: "operador" }).eq("user_id", mk).select("role");
    expect(up.error).toBeNull();
    expect(up.data![0].role).toBe("operador");
    await mestre.from("app_users").update({ role: "marketing" }).eq("user_id", mk);
    const self = (await mestre.auth.getUser()).data.user!.id;
    expect((await mestre.from("app_users").update({ role: "operador" }).eq("user_id", self)).error?.code).toBe("42501");
    // ninguém cria linha de usuário diretamente sem ser mestre
    expect((await operador.from("app_users").insert({ user_id: crypto.randomUUID(), full_name: "X", role: "admin" })).error).not.toBeNull();
  });

  it("função de usuários: só o mestre; cria com senha provisória e troca obrigatória; inativado perde o acesso", async () => {
    expect((await usersFn(null, { acao: "listar" })).status).toBe(401);
    for (const c of [operador, marketing, intruso]) expect((await usersFn(c, { acao: "listar" })).status).toBe(403);

    const list = await usersFn(mestre, { acao: "listar" });
    expect(list.status).toBe(200);
    const emails = (list.body.usuarios as { email: string }[]).map((u) => u.email);
    expect(emails).toContain(process.env.TEST_OPERADOR_EMAIL!.toLowerCase());

    expect((await usersFn(mestre, { acao: "criar", nome: "X", email: "invalido", nivel: "operador", senha: "abc" })).status).toBe(400);
    expect((await usersFn(mestre, { acao: "criar", nome: "[TESTE] Y", email: `y.${tag}@audita.test`, nivel: "dono", senha: "SenhaProvisoria123" })).status).toBe(400);

    const email = `novo.${tag.toLowerCase()}@audita.test`;
    const senha = `Provisoria${tag}9`;
    const created = await usersFn(mestre, { acao: "criar", nome: `[TESTE] Usuário criado ${tag}`, email, cargo: "Teste automatizado", nivel: "operador", senha });
    expect(created.status).toBe(201);
    const id = created.body.user_id as string;
    expect((await usersFn(mestre, { acao: "criar", nome: "[TESTE] Duplicado", email, nivel: "operador", senha })).status).toBe(409);

    const novo = await signedIn(email, senha);
    expect((await novo.rpc("current_app_role")).data).toBe("operador");
    const row = (await novo.from("app_users").select("must_change_password, created_by").eq("user_id", id).single()).data!;
    expect(row.must_change_password).toBe(true);
    expect(row.created_by).toBe((await mestre.auth.getUser()).data.user!.id);
    // conclui a troca: só pode desligar a exigência (verdadeiro → falso), não religar
    expect((await novo.from("app_users").update({ must_change_password: false }).eq("user_id", id)).error).toBeNull();
    expect((await novo.from("app_users").update({ must_change_password: true }).eq("user_id", id)).error?.code).toBe("42501");

    // redefinição pelo mestre exige nova troca; o mestre não redefine a própria senha por aqui
    const reset = await usersFn(mestre, { acao: "redefinir_senha", user_id: id, senha: `Nova${tag}Senha8` });
    expect(reset.status).toBe(200);
    const self = (await mestre.auth.getUser()).data.user!.id;
    expect((await usersFn(mestre, { acao: "redefinir_senha", user_id: self, senha: "OutraSenha12345" })).status).toBe(400);
    const again = await signedIn(email, `Nova${tag}Senha8`);
    expect((await again.from("app_users").select("must_change_password").eq("user_id", id).single()).data!.must_change_password).toBe(true);

    // inativado: login no Supabase funciona, mas o AUDITA não reconhece mais o usuário
    expect((await mestre.from("app_users").update({ status: "inactive" }).eq("user_id", id)).error).toBeNull();
    const off = await signedIn(email, `Nova${tag}Senha8`);
    expect((await off.rpc("current_app_role")).data).toBeNull();
    expect((await off.from("clients").select("id").limit(1)).data ?? []).toEqual([]);
  }, 60_000);

  it("mestre adicional: mesmas permissões do mestre, sem alterar o próprio nível nem o titular", async () => {
    const email = `comestre.${tag.toLowerCase()}@audita.test`;
    const senha = `Comestre${tag}7`;
    const created = await usersFn(mestre, { acao: "criar", nome: `[TESTE] Mestre adicional ${tag}`, email, nivel: "mestre", senha });
    expect(created.status).toBe(201);
    const id = created.body.user_id as string;
    const co = await signedIn(email, senha);
    await co.from("app_users").update({ must_change_password: false }).eq("user_id", id);
    expect((await co.rpc("is_master")).data).toBe(true);
    expect((await co.rpc("current_app_role")).data).toBe("admin");
    expect((await usersFn(co, { acao: "listar" })).status).toBe(200);
    // altera outro usuário (marketing) e devolve
    const mk = (await marketing.auth.getUser()).data.user!.id;
    expect((await co.from("app_users").update({ role: "operador" }).eq("user_id", mk).select("user_id")).error).toBeNull();
    await co.from("app_users").update({ role: "marketing" }).eq("user_id", mk);
    // não altera a si mesmo nem o titular; não redefine a senha do titular
    expect((await co.from("app_users").update({ is_comaster: false }).eq("user_id", id)).error?.code).toBe("42501");
    expect((await co.from("app_users").update({ status: "inactive" }).eq("user_id", id)).error?.code).toBe("42501");
    const titular = (await mestre.auth.getUser()).data.user!.id;
    expect((await co.from("app_users").update({ role: "operador" }).eq("user_id", titular)).error?.code).toBe("42501");
    expect((await usersFn(co, { acao: "redefinir_senha", user_id: titular, senha: "QualquerSenha123" })).status).toBe(400);
    // quem não é mestre não concede a marca
    const opId = (await operador.auth.getUser()).data.user!.id;
    expect((await operador.from("app_users").update({ is_comaster: true }).eq("user_id", opId)).error?.code).toBe("42501");
    expect((await co.from("app_users").update({ is_comaster: true }).eq("user_id", opId)).error).not.toBeNull(); // exige nível Administrador
    // o titular retira a marca (vira administrador comum) e depois inativa
    expect((await mestre.from("app_users").update({ is_comaster: false }).eq("user_id", id)).error).toBeNull();
    expect((await co.rpc("is_master")).data).toBe(false);
    expect((await mestre.from("app_users").update({ status: "inactive" }).eq("user_id", id)).error).toBeNull();
  }, 60_000);
});
