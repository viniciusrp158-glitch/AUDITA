/**
 * I9.2 — Dados institucionais (AUDDOC013 §3–§4; AUDDOC010-ANX01 "Empresa proponente"; AUDDOC010 §7; caderno C1/D6).
 * Parte 1 (PGlite, com todas as migrações): versões, publicação, imutabilidade e congelamento no snapshot das revisões —
 *   fluxos que, no banco de desenvolvimento, deixariam uma versão de TESTE como vigente de forma permanente.
 * Parte 2 (banco de desenvolvimento): RLS e permissões reais (somente o administrador), sem gravar nada.
 * Todos os dados são fictícios.
 */
import type { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const OPER = "00000000-0000-4000-8000-0000000000a0";

describe("I9.2 — fluxo de versões (PGlite)", () => {
  let db: PGlite;
  const err = async (p: Promise<unknown>) => {
    try {
      await p;
      return null;
    } catch (e) {
      return (e as { code?: string; message: string });
    }
  };

  beforeAll(async () => {
    db = await migratedDb();
    await db.exec(`
      insert into auth.users (id, email) values ('${ADMIN}', 'admin@exemplo.test'), ('${OPER}', 'oper@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values ('${ADMIN}', '[TESTE] Admin', 'admin'), ('${OPER}', '[TESTE] Operador', 'operador');
    `);
  }, 120000);
  afterAll(async () => db?.close());

  it("rascunho: status e versão definidos pelo banco; validações espelham o formulário", async () => {
    await asUser(db, ADMIN, async () => {
      const r = await db.query<{ status: string; version: number }>(
        `insert into audita.institutional_profiles (status, version, legal_name, is_test) values ('vigente', 99, '[TESTE] Proponente Um LTDA', true) returning status, version`,
      );
      expect(r.rows[0]).toEqual({ status: "rascunho", version: 1 });
      expect((await err(db.query(`insert into audita.institutional_profiles (cnpj) values ('11444777000162')`)))?.code).toBe("23514");
      expect((await err(db.query(`insert into audita.institutional_profiles (address_state) values ('sp')`)))?.code).toBe("23514");
      expect((await err(db.query(`insert into audita.institutional_profiles (phone) values ('123')`)))?.code).toBe("23514");
      // publicar "por fora" (sem a função) é bloqueado
      expect((await err(db.query(`update audita.institutional_profiles set status = 'vigente', published_at = now() where version = 1`)))?.code).toBe("42501");
    });
  });

  it("publicação: só o administrador; a vigente anterior vira substituída; versões publicadas são imutáveis", async () => {
    const v1 = (await db.query<{ id: string }>(`select id from audita.institutional_profiles where version = 1`)).rows[0].id;
    await asUser(db, OPER, async () => {
      expect((await db.query(`select * from audita.institutional_profiles`)).rows).toHaveLength(0);
      expect(await err(db.query(`insert into audita.institutional_profiles (legal_name) values ('[TESTE] Operador LTDA')`))).not.toBeNull();
      expect((await err(db.query(`select audita.publish_institutional_profile($1)`, [v1])))?.code).toBe("42501");
    });
    await asUser(db, null, async () => {
      expect(await err(db.query(`select audita.publish_institutional_profile($1)`, [v1]))).not.toBeNull();
    });
    await asUser(db, ADMIN, async () => {
      await db.query(
        `update audita.institutional_profiles set cnpj = '11444777000161', email = 'contato@exemplo.test', notes = 'fonte: teste' where version = 1`,
      );
      await db.query(`select audita.publish_institutional_profile($1)`, [v1]);
      expect((await db.query(`select status, published_by from audita.institutional_profiles where id = $1`, [v1])).rows[0]).toEqual({
        status: "vigente",
        published_by: ADMIN,
      });
      expect((await err(db.query(`select audita.publish_institutional_profile($1)`, [v1])))?.message).toContain("Somente rascunhos");
      // vigente imutável (nem o administrador altera)
      await db.query(`update audita.institutional_profiles set legal_name = 'Alterada' where id = $1`, [v1]);
      expect((await db.query(`select legal_name from audita.institutional_profiles where id = $1`, [v1])).rows[0]).toEqual({
        legal_name: "[TESTE] Proponente Um LTDA",
      });
      // segunda versão
      const v2 = (
        await db.query<{ id: string; version: number }>(
          `insert into audita.institutional_profiles (legal_name, cnpj, is_test) values ('[TESTE] Proponente Dois LTDA', '11444777000161', true) returning id, version`,
        )
      ).rows[0];
      expect(v2.version).toBe(2);
      await db.query(`select audita.publish_institutional_profile($1)`, [v2.id]);
      const st = (await db.query<{ version: number; status: string }>(`select version, status from audita.institutional_profiles order by version`)).rows;
      expect(st).toEqual([
        { version: 1, status: "substituido" },
        { version: 2, status: "vigente" },
      ]);
    });
    // nem com privilégio de superusuário um dado publicado muda sem a função de publicação
    expect((await err(db.query(`update audita.institutional_profiles set legal_name = 'X' where version = 1`)))?.code).toBe("42501");
    // trilha de auditoria registrou criação e publicação
    const logs = await db.query<{ n: number }>(`select count(*)::int n from audita.audit_log where entity = 'institutional_profiles'`);
    expect(logs.rows[0].n).toBeGreaterThanOrEqual(4);
  });

  it("cada nova revisão de proposta congela o proponente vigente (sem observações internas)", async () => {
    await db.exec(`
      create temp table rev_teste (snapshot jsonb);
      create trigger add_proponent before insert on rev_teste for each row execute function audita.quote_revisions_add_proponent();
    `);
    const row = (await db.query<{ snapshot: Record<string, unknown> }>(`insert into rev_teste values ('{"schema":1}') returning snapshot`)).rows[0];
    const p = row.snapshot.proponent as Record<string, unknown>;
    expect(row.snapshot.schema).toBe(1);
    expect(p).toMatchObject({ version: 2, legal_name: "[TESTE] Proponente Dois LTDA", cnpj: "11444777000161", is_test: true });
    for (const k of ["notes", "status", "created_by", "updated_by", "published_by"]) expect(p, k).not.toHaveProperty(k);
  });
});

// ---------------------------------------------------------------------------------------------------------------
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const ready = Boolean(url && key && process.env.TEST_ADMIN_EMAIL && process.env.TEST_OPERADOR_EMAIL && process.env.TEST_MARKETING_EMAIL);
const client = () => createClient(url, key, { db: { schema: "audita" }, auth: { persistSession: false, autoRefreshToken: false } });
async function signedIn(email: string, password: string) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login de teste (${email}): ${error.message}`);
  return c;
}

describe.skipIf(!ready)("I9.2 — permissões reais (banco de desenvolvimento, somente leitura)", () => {
  it("somente o administrador lê; operador, marketing, sem acesso e anônimo não leem, não gravam e não publicam", async () => {
    const admin = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    const others = [
      await signedIn(process.env.TEST_OPERADOR_EMAIL!, process.env.TEST_OPERADOR_PASSWORD!),
      await signedIn(process.env.TEST_MARKETING_EMAIL!, process.env.TEST_MARKETING_PASSWORD!),
      await signedIn(process.env.TEST_INTRUSO_EMAIL!, process.env.TEST_INTRUSO_PASSWORD!),
    ];
    const a = await admin.from("institutional_profiles").select("id, status");
    expect(a.error).toBeNull();
    const fake = "00000000-0000-4000-8000-000000000000";
    for (const c of others) {
      const r = await c.from("institutional_profiles").select("id");
      expect(r.error).toBeNull();
      expect(r.data).toEqual([]);
      const ins = await c.from("institutional_profiles").insert({ legal_name: "[TESTE] Não deveria gravar", is_test: true });
      expect(ins.error).not.toBeNull();
      expect((await c.rpc("publish_institutional_profile", { p_id: fake })).error?.code).toBe("42501");
    }
    const anon = client();
    expect((await anon.from("institutional_profiles").select("id")).error).not.toBeNull();
    expect((await anon.rpc("publish_institutional_profile", { p_id: fake })).error).not.toBeNull();
  });

  it("revisões criadas após a migração trazem o proponente congelado no snapshot", async () => {
    const admin = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    const { data, error } = await admin
      .from("quote_revisions")
      .select("id, snapshot")
      .gte("created_at", "2026-10-10T21:06:00Z")
      .order("created_at", { ascending: false })
      .limit(5);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0); // o teste de emissão (I6) roda antes e cria revisões
    for (const r of data!) expect(Object.prototype.hasOwnProperty.call(r.snapshot, "proponent"), r.id).toBe(true);
  });
});
