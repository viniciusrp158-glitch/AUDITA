/**
 * P6 — E-mail de apresentação (AUDDOC020 Rev.01, RP-09/RNF-P04). PGlite com todas as migrações: configuração só do
 * administrador (chave cifrada), registro imutável de envios, cota com aquecimento e pausa por devolução, devolução
 * marcada só pela função própria e descadastro público (exceção da regra 4) que põe a empresa em "não contatar".
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000006ad";
const OPER = "00000000-0000-4000-8000-0000000006a0";
const MKT = "00000000-0000-4000-8000-0000000006ac";
const CNPJ = "11222333000181";
const tok = (n: number) => n.toString(16).padStart(48, "0");

describe("P6 — e-mail da prospecção (PGlite)", () => {
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
  const quota = () =>
    q<{ configured: boolean; batch_allowed: boolean; daily_limit: number; sent_today: number; paused: boolean }>(
      `select configured, batch_allowed, daily_limit, sent_today, paused from audita.prospect_email_quota()`,
    ).then((r) => r[0]);

  beforeAll(async () => {
    db = await migratedDb();
    await db.exec(`
      insert into auth.users (id, email) values ('${ADMIN}', 'a6@exemplo.test'), ('${OPER}', 'o6@exemplo.test'), ('${MKT}', 'm6@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values
        ('${ADMIN}', '[TESTE] Admin', 'admin'), ('${OPER}', '[TESTE] Operador', 'operador'), ('${MKT}', '[TESTE] Marketing', 'marketing');
      insert into audita.leads (cnpj, legal_name, stage, is_test) values ('${CNPJ}', '[TESTE] Alfa', 'aguardando_retorno', true);
    `);
  }, 120000);
  afterAll(async () => db?.close());

  it("configuração: linha única, só o administrador lê e altera", async () => {
    await asUser(db, ADMIN, async () => {
      expect(await q(`select sender_email, reply_to, daily_start, daily_max from audita.prospect_email_config`)).toEqual([
        { sender_email: "prospeccao@audita.seg.br", reply_to: "engenharia.audita@outlook.com", daily_start: 30, daily_max: 100 },
      ]);
      expect((await quota()).configured).toBe(false);
      await db.query(`update audita.prospect_email_config set sender_name = '[TESTE] Vinicius | AUDITA', api_key_cipher = repeat('x', 40)`);
      expect(await quota()).toMatchObject({ configured: true, batch_allowed: false, daily_limit: 30, sent_today: 0, paused: false });
      expect(await err(db.query(`update audita.prospect_email_config set daily_max = 150`))).not.toBeNull();
      expect(await err(db.query(`update audita.prospect_email_config set sender_email = 'x@gmail.com'`))).not.toBeNull();
      expect(await err(db.query(`insert into audita.prospect_email_config (id) values (1)`))).not.toBeNull();
    });
    await asUser(db, OPER, async () => {
      expect(await q(`select * from audita.prospect_email_config`)).toEqual([]);
      expect((await quota()).configured).toBe(true);
    });
    await asUser(db, MKT, async () => {
      expect((await err(db.query(`select * from audita.prospect_email_quota()`)))?.code).toBe("42501");
    });
  });

  it("envios: registro imutável, cota do dia e devolução só pela função", async () => {
    await asUser(db, OPER, async () => {
      await db.query(`insert into audita.prospect_email_sends (cnpj, email, subject, status, provider_id, token, is_test) values ($1, 'contato@alfa.com.br', '[TESTE] Assunto', 'enviado', 'msg-1', $2, true)`, [CNPJ, tok(1)]);
      expect((await quota()).sent_today).toBe(1);
      expect(await err(db.query(`update audita.prospect_email_sends set status = 'devolvido'`))).not.toBeNull();
      expect(await err(db.query(`delete from audita.prospect_email_sends`))).not.toBeNull();
      expect(await q(`select audita.prospect_email_mark_bounced(array['msg-1']) as n`)).toEqual([{ n: 1 }]);
      expect(await q(`select status from audita.prospect_email_sends where provider_id = 'msg-1'`)).toEqual([{ status: "devolvido" }]);
    });
  });

  it("aquecimento (+5 por dia útil) e pausa com devoluções acima de 3%", async () => {
    await db.exec(`set session_replication_role = replica`);
    // 1º envio real há 10 dias corridos (2026-11-09, segunda) → dias úteis até ontem
    for (let i = 0; i < 25; i++)
      await db.query(`insert into audita.prospect_email_sends (cnpj, email, subject, status, token, sent_at, is_test) values ($1, $2, '[TESTE]', 'enviado', $3, now() - interval '10 days', true)`, [CNPJ, `x${i}@alfa.com.br`, tok(100 + i)]);
    await db.exec(`set session_replication_role = origin`);
    await asUser(db, OPER, async () => {
      const qt = await quota();
      expect(qt.daily_limit).toBeGreaterThanOrEqual(30 + 5 * 6);
      expect(qt.daily_limit).toBeLessThanOrEqual(100);
      expect(qt.paused).toBe(true); // 1 devolvido em 26 envios reais = 3,8% (acima de 3%)
    });
  });

  it("descadastro público: põe empresa e e-mail em 'não contatar' sem devolver dados", async () => {
    await asUser(db, null, async () => {
      expect(await q(`select audita.prospect_unsubscribe('nao-e-um-codigo')`)).toHaveLength(1); // código inválido: sem erro, sem efeito
      await db.query(`select audita.prospect_unsubscribe($1)`, [tok(1)]);
      await db.query(`select audita.prospect_unsubscribe($1)`, [tok(1)]); // repetir não duplica
      expect(await err(db.query(`select * from audita.prospect_email_sends`))).not.toBeNull();
      expect(await err(db.query(`select * from audita.prospect_email_quota()`))).not.toBeNull();
    });
    expect(await q(`select cnpj, email from audita.contact_suppressions`)).toEqual([{ cnpj: CNPJ, email: "contato@alfa.com.br" }]);
    expect(await q(`select stage from audita.leads where cnpj = $1`, [CNPJ])).toEqual([{ stage: "perdido" }]);
  });
});
