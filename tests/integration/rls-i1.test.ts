/**
 * I1 — Testes de acesso por chamada direta à API (AUDDOC017 CA-01, CA-10).
 * Executa contra o projeto de DESENVOLVIMENTO com usuários fictícios.
 * Variáveis: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 *            TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_INTRUSO_EMAIL, TEST_INTRUSO_PASSWORD
 */
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ready = Boolean(url && key && process.env.TEST_ADMIN_EMAIL && process.env.TEST_INTRUSO_EMAIL);

function client() {
  return createClient(url!, key!, {
    db: { schema: "audita" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signedIn(email: string, password: string) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Falha no login de teste (${email}): ${error.message}`);
  return c;
}

describe.skipIf(!ready)("I1 — autenticação e RLS", () => {
  type Client = ReturnType<typeof client>;
  let anon: Client;
  let admin: Client;
  let intruso: Client;

  beforeAll(async () => {
    anon = client();
    admin = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    intruso = await signedIn(process.env.TEST_INTRUSO_EMAIL!, process.env.TEST_INTRUSO_PASSWORD!);
  });

  it("CA-01: senha errada é recusada", async () => {
    const { error } = await client().auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: "senha-errada-123",
    });
    expect(error).not.toBeNull();
  });

  it("anônimo não acessa nenhuma tabela nem função do schema audita", async () => {
    const users = await anon.from("app_users").select("*");
    expect(users.error?.code).toBe("42501");
    const log = await anon.from("audit_log").select("*");
    expect(log.error?.code).toBe("42501");
    const rpc = await anon.rpc("is_admin");
    expect(rpc.error).not.toBeNull();
  });

  it("usuário autenticado mas não autorizado não vê dados", async () => {
    expect((await intruso.rpc("is_admin")).data).toBe(false);
    expect((await intruso.rpc("current_app_role")).data).toBeNull();
    const users = await intruso.from("app_users").select("*");
    expect(users.error).toBeNull();
    expect(users.data).toEqual([]);
    const log = await intruso.from("audit_log").select("*");
    expect(log.data).toEqual([]);
  });

  it("usuário não autorizado não consegue se autopromover", async () => {
    const { data: u } = await intruso.auth.getUser();
    const ins = await intruso
      .from("app_users")
      .insert({ user_id: u.user!.id, full_name: "Tentativa", role: "admin" });
    expect(ins.error?.code).toBe("42501");
    const login = await intruso.rpc("log_access_event", { event: "login" });
    expect(login.error).not.toBeNull();
  });

  it("administrador vê usuários e a trilha de auditoria", async () => {
    expect((await admin.rpc("is_admin")).data).toBe(true);
    const users = await admin.from("app_users").select("user_id, role, status");
    expect(users.error).toBeNull();
    expect(users.data?.length).toBeGreaterThanOrEqual(1);
    const ev = await admin.rpc("log_access_event", { event: "login" });
    expect(ev.error).toBeNull();
    const log = await admin.from("audit_log").select("id, action").order("id", { ascending: false }).limit(5);
    expect(log.error).toBeNull();
    expect(log.data?.some((r) => r.action === "login")).toBe(true);
  });

  it("trilha de auditoria é imutável e usuários não podem ser excluídos", async () => {
    const log = await admin.from("audit_log").select("id").limit(1).single();
    const upd = await admin.from("audit_log").update({ entity: "x" }).eq("id", log.data!.id);
    expect(upd.error).not.toBeNull();
    const del = await admin.from("audit_log").delete().eq("id", log.data!.id);
    expect(del.error).not.toBeNull();
    const delUser = await admin.from("app_users").delete().eq("role", "admin");
    expect(delUser.error).not.toBeNull();
  });

  it("evento de acesso inválido é recusado", async () => {
    const r = await admin.rpc("log_access_event", { event: "update" });
    expect(r.error).not.toBeNull();
  });
});
