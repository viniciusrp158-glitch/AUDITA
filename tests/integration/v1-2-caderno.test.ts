/**
 * V1.2 — Aplicação do caderno de pendências (14/10/2026): CPF do titular (J1.10), versão técnica v2 do M01/M02,
 * prazos de guarda (J4) e anonimização controlada (somente o mestre, só após o prazo, trilha sem dados pessoais),
 * e verificação em duas etapas exigida no banco (I3.01). PGlite com todas as migrações. Dados fictícios de teste.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const MASTER = "00000000-0000-4000-8000-0000000012ad";
const ADMIN = "00000000-0000-4000-8000-0000000012ae";
const INV_OLD = "00000000-0000-4000-8000-0000000012c1";
const INV_NEW = "00000000-0000-4000-8000-0000000012c2";
const INV_REQ = "00000000-0000-4000-8000-0000000012c3";
const REQ_OLD = "00000000-0000-4000-8000-0000000012d1";

describe("V1.2 — caderno de pendências (PGlite)", () => {
  let db: PGlite;
  const err = async (p: Promise<unknown>) => {
    try {
      await p;
      return null;
    } catch (e) {
      return e as { code?: string; message: string };
    }
  };
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

  beforeAll(async () => {
    db = await migratedDb();
    const term = (await q<{ version: string }>(`select version from audita.consent_terms order by published_at limit 1`))[0].version;
    await db.exec(`
      insert into auth.users (id, email) values ('${MASTER}', 'm@exemplo.test'), ('${ADMIN}', 'a@exemplo.test');
      insert into audita.app_users (user_id, full_name, role, is_master) values ('${MASTER}', '[TESTE] Mestre', 'admin', true);
      insert into audita.app_users (user_id, full_name, role) values ('${ADMIN}', '[TESTE] Admin', 'admin');
      set session_replication_role = replica;
      insert into audita.client_invites (id, token_hash, recipient, created_at, expires_at, is_test) values
        ('${INV_OLD}', repeat('a', 64), 'Fulano Fictício <fulano@exemplo.test>', now() - interval '200 days', now() - interval '199 days', true),
        ('${INV_NEW}', repeat('b', 64), 'Ciclano Fictício', now() - interval '10 days', now() - interval '9 days', true),
        ('${INV_REQ}', repeat('c', 64), 'Beltrano Fictício', now() - interval '300 days', now() - interval '299 days', true);
      update audita.client_invites set used_at = now() - interval '299 days' where id = '${INV_REQ}';
      insert into audita.client_registration_requests (id, invite_id, status, payload, terms_version, terms_accepted_at, submitted_at, reviewed_at, review_note)
        values ('${REQ_OLD}', '${INV_REQ}', 'recusada', '{"cliente":{"razao_social":"[TESTE] Empresa Recusada","email":"pessoa@exemplo.test"}}',
                '${term}', now() - interval '299 days', now() - interval '299 days', now() - interval '200 days', 'Fora do escopo');
      insert into audita.audit_log (action, entity, entity_id, summary) values
        ('insert', 'client_invites', '${INV_OLD}', '{"recipient":"Fulano Fictício <fulano@exemplo.test>"}'),
        ('insert', 'client_registration_requests', '${REQ_OLD}', '{"payload":{"cliente":{"email":"pessoa@exemplo.test"}}}');
      set session_replication_role = origin;
    `);
  }, 120000);
  afterAll(async () => db?.close());

  it("CPF do titular validado no banco; M01/M02 com a versão técnica v2 vigente e a v1 preservada", async () => {
    expect((await err(db.query(`insert into audita.institutional_profiles (signatory_cpf) values ('52998224724')`)))?.code).toBe("23514");
    await db.query(`insert into audita.institutional_profiles (signatory_cpf) values ('52998224725')`);
    const t = await q<{ template_code: string; technical_version: string; status: string }>(
      `select template_code, technical_version, status from audita.document_templates where template_code in ('AUDDOC010-ANX01','AUDDOC010-ANX02') order by 1, 2`,
    );
    expect(t).toEqual([
      { template_code: "AUDDOC010-ANX01", technical_version: "v1", status: "substituido" },
      { template_code: "AUDDOC010-ANX01", technical_version: "v2", status: "vigente" },
      { template_code: "AUDDOC010-ANX02", technical_version: "v1", status: "substituido" },
      { template_code: "AUDDOC010-ANX02", technical_version: "v2", status: "vigente" },
    ]);
    expect((await err(db.query(`update audita.document_templates set notes = 'x' where technical_version = 'v2'`)))?.code).toBe("42501");
  });

  it("prazos de guarda (J4): 8 categorias aprovadas, visíveis só a administradores", async () => {
    await asUser(db, ADMIN, async () => {
      const r = await q<{ code: string }>(`select code from audita.retention_rules order by code`);
      expect(r.map((x) => x.code)).toEqual(["RET-01", "RET-02", "RET-03", "RET-04", "RET-05", "RET-06", "RET-07", "RET-08"]);
      expect((await err(db.query(`update audita.retention_rules set retention = 'x'`)))?.code).toBe("42501");
    });
    await asUser(db, null, async () => {
      expect((await err(db.query(`select * from audita.retention_rules`)))?.code).toBe("42501");
    });
  });

  it("anonimização: só o mestre, só após o prazo, com motivo; dados pessoais e trilha limpos; nada é excluído", async () => {
    await asUser(db, ADMIN, async () => {
      expect(await q(`select * from audita.anonymization_candidates()`)).toEqual([]);
      expect((await err(db.query(`select audita.anonymize_record('convite_expirado', $1, 'Prazo vencido')`, [INV_OLD])))?.code).toBe("42501");
    });
    await asUser(db, MASTER, async () => {
      const c = await q<{ kind: string; record_id: string; rule_code: string }>(`select kind, record_id, rule_code from audita.anonymization_candidates()`);
      expect(c.map((x) => `${x.kind}:${x.record_id}:${x.rule_code}`).sort()).toEqual(
        [`convite_expirado:${INV_OLD}:RET-03`, `solicitacao_recusada:${REQ_OLD}:RET-02`].sort(),
      );
      expect((await err(db.query(`select audita.anonymize_record('convite_expirado', $1, 'x')`, [INV_OLD])))?.code).toBe("22023");
      expect((await err(db.query(`select audita.anonymize_record('convite_expirado', $1, 'Prazo vencido')`, [INV_NEW])))?.message).toContain("prazo");
      await db.query(`select audita.anonymize_record('convite_expirado', $1, 'Prazo vencido (J4)')`, [INV_OLD]);
      await db.query(`select audita.anonymize_record('solicitacao_recusada', $1, 'Prazo vencido (J4)')`, [REQ_OLD]);
      expect(await q(`select * from audita.anonymization_candidates()`)).toEqual([]);
    });
    const inv = (await q<{ recipient: string; token_hash: string; anonymized_at: string | null }>(`select recipient, token_hash, anonymized_at from audita.client_invites where id = $1`, [INV_OLD]))[0];
    expect(inv.recipient).toBe("anonimizado");
    expect(inv.token_hash).not.toBe("a".repeat(64));
    expect(inv.anonymized_at).not.toBeNull();
    const req = (await q<{ status: string; payload: unknown; review_note: string }>(`select status, payload, review_note from audita.client_registration_requests where id = $1`, [REQ_OLD]))[0];
    expect(req).toMatchObject({ status: "recusada", payload: { anonimizado: true, regra: "RET-02" }, review_note: "Fora do escopo" });
    const log = JSON.stringify(await q(`select summary from audita.audit_log where entity in ('client_invites','client_registration_requests')`));
    expect(log).not.toContain("exemplo.test");
    expect(log).not.toContain("Fulano");
    const actions = await q<{ action: string; summary: { regra: string } }>(`select action, summary from audita.audit_log where action = 'anonymize' order by id`);
    expect(actions.map((a) => a.summary.regra)).toEqual(["RET-03", "RET-02"]);
    // fora da rotina, a trilha continua imutável
    expect((await err(db.query(`update audita.audit_log set summary = '{"anonimizado": true}' where action = 'insert'`)))?.code).toBe("42501");
    expect((await err(db.query(`update audita.client_registration_requests set review_note = 'x' where id = $1`, [REQ_OLD])))?.code).toBe("42501");
  });

  it("verificação em duas etapas: com fator ativo, o acesso aos dados exige sessão aal2 (RLS)", async () => {
    const role = async (aal: string | null) => {
      await db.exec(`select set_config('request.jwt.claims', '${aal ? JSON.stringify({ aal }) : ""}', false)`);
      try {
        return await asUser(db, MASTER, async () => (await q<{ r: string | null; m: boolean }>(`select audita.current_app_role() as r, audita.is_master() as m`))[0]);
      } finally {
        await db.exec(`select set_config('request.jwt.claims', '', false)`);
      }
    };
    expect(await role("aal1")).toEqual({ r: "admin", m: true }); // sem fator: como antes
    await db.query(`insert into auth.mfa_factors (user_id, status) values ($1, 'verified')`, [MASTER]);
    expect(await role("aal1")).toEqual({ r: null, m: false });
    expect(await role(null)).toEqual({ r: null, m: false });
    expect(await role("aal2")).toEqual({ r: "admin", m: true });
  });
});
