/**
 * V1.1 — Serviço contratado e execução (RF-07), M05/M06 (RF-23) e caixa gerencial (RF-18; AUDDOC011 §7).
 * Parte 1 (PGlite, todas as migrações): fluxo completo e regras do banco. Parte 2 (banco de desenvolvimento): permissões.
 * Dados fictícios de teste.
 */
import type { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000002ad";
const OPER = "00000000-0000-4000-8000-0000000002a0";
const CLIENT = "00000000-0000-4000-8000-00000000c111";
const DEMAND = "00000000-0000-4000-8000-00000000d111";
const QUOTE = "00000000-0000-4000-8000-00000000e111";
const QUOTE2 = "00000000-0000-4000-8000-00000000e222";
const REV = "00000000-0000-4000-8000-00000000f111";
const PSET = "00000000-0000-4000-8000-00000000a111";

describe("V1.1 — execução e caixa (PGlite)", () => {
  let db: PGlite;
  let ctr = "";
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
    await db.exec(`
      insert into auth.users (id, email) values ('${ADMIN}', 'a@exemplo.test'), ('${OPER}', 'o@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values ('${ADMIN}', '[TESTE] Admin', 'admin'), ('${OPER}', '[TESTE] Operador', 'operador');
      set session_replication_role = replica;
      insert into audita.clients (id, client_code, legal_name, is_test) values ('${CLIENT}', 'CLI-9001', '[TESTE] Cliente Fictício LTDA', true);
      insert into audita.demands (id, demand_code, client_id, summary, status, is_test) values ('${DEMAND}', 'DEM-2026-9001', '${CLIENT}', '[TESTE] Consultoria mensal', 'aceita', true),
        ('00000000-0000-4000-8000-00000000d222', 'DEM-2026-9002', '${CLIENT}', '[TESTE] Outra demanda', 'recebida', true);
      insert into audita.pricing_parameter_sets (id, version, label, status, published_at) values ('${PSET}', 99, '[TESTE]', 'vigente', now());
      insert into audita.quotes (id, quote_code, demand_id, client_id, status, current_revision_id, is_test, parameter_set_id)
        values ('${QUOTE}', 'PROP-2026-9001', '${DEMAND}', '${CLIENT}', 'aceita', '${REV}', true, '${PSET}'),
               ('${QUOTE2}', 'PROP-2026-9002', '00000000-0000-4000-8000-00000000d222', '${CLIENT}', 'emitida', null, true, '${PSET}');
      insert into audita.quote_revisions (id, quote_id, revision_number, status, snapshot, parameter_set_id, total_once, total_monthly, accepted_on, accepted_by_name, emitted_at, is_test)
        values ('${REV}', '${QUOTE}', 0, 'aceita',
          '{"quote":{"objective":"[TESTE] Rotinas de SST","deliverables":"Relatório mensal","contract_start_on":"2026-11-01","contract_months":12}}',
          '${PSET}', null, 1576.78, '2026-10-10', 'Responsável Fictício', now(), true);
      set session_replication_role = origin;
    `);
  }, 120000);
  afterAll(async () => db?.close());

  it("serviço contratado só a partir de proposta aceita; dados vêm da proposta; situação sincroniza a demanda", async () => {
    await asUser(db, OPER, async () => {
      expect((await err(db.query(`select audita.create_service_contract($1)`, [QUOTE])))?.code).toBe("42501");
    });
    await asUser(db, ADMIN, async () => {
      expect((await err(db.query(`select audita.create_service_contract($1)`, [QUOTE2])))?.message).toContain("aceitas");
      ctr = (await q<{ id: string }>(`select audita.create_service_contract($1) id`, [QUOTE]))[0].id;
      expect((await err(db.query(`select audita.create_service_contract($1)`, [QUOTE])))?.code).toBe("23505");
      const c = (await q(`select contract_code, modality, starts_on::text s, ends_on::text e, scope_summary, client_representative, status, is_test from audita.service_contracts where id = $1`, [ctr]))[0];
      expect(c).toMatchObject({ modality: "recorrente", s: "2026-11-01", e: "2027-10-31", scope_summary: "[TESTE] Rotinas de SST", client_representative: "Responsável Fictício", status: "planejado", is_test: true });
      expect(String(c.contract_code)).toMatch(/^CTR-\d{4}-\d{4}$/);
      // inserir direto / mudar situação por fora: bloqueado
      expect((await err(db.query(`update audita.service_contracts set status = 'encerrado' where id = $1`, [ctr])))?.code).toBe("42501");
      await db.query(`update audita.service_contracts set executor_name = 'Executor Fictício' where id = $1`, [ctr]);
      await db.query(`select audita.change_service_contract_status($1, 'em_execucao', 'Início das visitas')`, [ctr]);
      expect((await q(`select status from audita.demands where id = $1`, [DEMAND]))[0]).toEqual({ status: "em_execucao" });
      expect((await err(db.query(`select audita.change_service_contract_status($1, 'suspenso', '')`, [ctr])))?.code).toBe("23514");
      await db.query(`insert into audita.service_contract_events (contract_id, event_type, description, channel, recipient) values ($1, 'entrega', 'Relatório de outubro', 'E-mail', 'Responsável Fictício')`, [ctr]);
      expect(await err(db.query(`insert into audita.service_contract_events (contract_id, event_type, description) values ($1, 'situacao', 'forjado')`, [ctr]))).not.toBeNull();
      expect((await err(db.query(`delete from audita.service_contract_events where contract_id = $1`, [ctr])))?.code).toBe("42501");
    });
  });

  it("M05: OS-COM só é liberada sem condicionantes, com atividade e responsável; M06 só aprovada com aceite do cliente", async () => {
    await asUser(db, ADMIN, async () => {
      const os = (await q<{ id: string; order_code: string }>(
        `insert into audita.service_orders (contract_id, activities, pending_conditions, is_test) values ($1, '[]', 'Aguardando integração de acesso', true) returning id, order_code`,
        [ctr],
      ))[0];
      expect(os.order_code).toMatch(/^OS-COM-\d{4}-\d{4}$/);
      expect((await err(db.query(`select audita.change_service_order_status($1, 'liberada')`, [os.id])))?.message).toContain("quem libera");
      await db.query(`update audita.service_orders set released_by_name = 'Diretor', released_on = '2026-10-11' where id = $1`, [os.id]);
      expect((await err(db.query(`select audita.change_service_order_status($1, 'liberada')`, [os.id])))?.message).toContain("condicionantes");
      await db.query(`update audita.service_orders set pending_conditions = 'Nenhuma' where id = $1`, [os.id]);
      expect((await err(db.query(`select audita.change_service_order_status($1, 'liberada')`, [os.id])))?.message).toContain("atividade");
      await db.query(`update audita.service_orders set activities = '[{"atividade":"Visita","entrega":"Relatório","condicao":"EPI"}]' where id = $1`, [os.id]);
      await db.query(`select audita.change_service_order_status($1, 'liberada')`, [os.id]);
      await db.query(`update audita.service_orders set location = 'Mudou' where id = $1`, [os.id]); // RLS: só rascunho (0 linhas)
      expect((await q(`select location from audita.service_orders where id = $1`, [os.id]))[0]).toEqual({ location: null });

      const alt = (await q<{ id: string; change_code: string }>(
        `insert into audita.scope_changes (contract_id, reason, value_before, value_after, is_test) values ($1, 'Inclusão de uma unidade', 1576.78, 1890.00, true) returning id, change_code`,
        [ctr],
      ))[0];
      expect(alt.change_code).toMatch(/^ALT-\d{4}-\d{4}$/);
      expect((await err(db.query(`select audita.change_scope_change_status($1, 'aprovada')`, [alt.id])))?.message).toContain("aceite rastreável");
      await db.query(`update audita.scope_changes set client_approval = 'Responsável Fictício, gerente, 11/10/2026, e-mail', validated_by_name = 'Diretor', validated_on = '2026-10-11' where id = $1`, [alt.id]);
      await db.query(`select audita.change_scope_change_status($1, 'aprovada')`, [alt.id]);
      const ev = await q<{ event_type: string }>(`select event_type from audita.service_contract_events where contract_id = $1 order by created_at`, [ctr]);
      expect(ev.map((e) => e.event_type)).toEqual(["situacao", "situacao", "entrega", "agenda", "alteracao_escopo"]);
    });
  });

  it("documentos M03–M06 imutáveis; encerramento sincroniza a demanda e trava o serviço", async () => {
    await asUser(db, ADMIN, async () => {
      const sha = "b".repeat(64);
      const d = (await q<{ id: string }>(
        `insert into audita.contract_documents (contract_id, model, reference, docx_path, pdf_path, docx_sha256, pdf_sha256, watermark, missing_fields, is_test)
         values ($1, 'M03', 'CTR-TESTE M03', 'contratos/x/m03.docx', 'contratos/x/m03.pdf', $2, $2, 'MINUTA', '{Representante}', true) returning id`,
        [ctr, sha],
      ))[0];
      expect(await err(db.query(`update audita.contract_documents set reference = 'x' where id = $1`, [d.id]))).not.toBeNull();
      await db.query(`select audita.change_service_contract_status($1, 'entregue', 'Relatório final entregue')`, [ctr]);
      await db.query(`select audita.change_service_contract_status($1, 'encerrado', 'Compromissos cumpridos')`, [ctr]);
      expect((await q(`select status from audita.demands where id = $1`, [DEMAND]))[0]).toEqual({ status: "encerrada" });
      expect((await err(db.query(`update audita.service_contracts set notes = 'x' where id = $1`, [ctr])))?.code).toBe("42501");
      expect((await err(db.query(`insert into audita.service_orders (contract_id) values ($1)`, [ctr])))?.message).toContain("encerrado");
    });
  });

  it("caixa: só movimentação ocorrida, categoria coerente, imutável, estorno com motivo; operador sem acesso", async () => {
    await asUser(db, ADMIN, async () => {
      const ins = (cols: string) => db.query(`insert into audita.cash_entries (occurred_on, kind, category, amount, description, is_test) values (${cols}, true) returning id`);
      const id = ((await ins(`'2026-10-05', 'recebimento', 'recebimento', 1576.78, '[TESTE] Mensalidade outubro'`)).rows[0] as { id: string }).id;
      await ins(`'2026-10-06', 'pagamento', 'tributo', 150.10, '[TESTE] Tributo pago'`);
      expect((await err(ins(`'2099-01-01', 'recebimento', 'recebimento', 10, '[TESTE] futuro'`)))?.message).toContain("já ocorridas");
      expect((await err(ins(`'2026-10-06', 'pagamento', 'recebimento', 10, '[TESTE] incoerente'`)))?.code).toBe("23514");
      expect((await err(ins(`'2026-10-06', 'pagamento', 'fixo', 0, '[TESTE] zero'`)))?.code).toBe("23514");
      expect((await err(db.query(`update audita.cash_entries set amount = 1 where id = $1`, [id])))).not.toBeNull();
      expect((await err(db.query(`select audita.reverse_cash_entry($1, 'x')`, [id])))?.code).toBe("23514");
      await db.query(`select audita.reverse_cash_entry($1, 'Lançado em duplicidade')`, [id]);
      expect((await q(`select status, amount::text a from audita.cash_entries where id = $1`, [id]))[0]).toEqual({ status: "estornado", a: "1576.78" });
      expect((await err(db.query(`select audita.reverse_cash_entry($1, 'De novo')`, [id])))?.code).toBe("22023");
    });
    await asUser(db, OPER, async () => {
      for (const t of ["service_contracts", "service_contract_events", "service_orders", "scope_changes", "contract_documents", "cash_entries"])
        expect(await q(`select 1 from audita.${t}`), t).toHaveLength(0);
      expect(await err(db.query(`insert into audita.cash_entries (occurred_on, kind, category, amount, description) values ('2026-10-01', 'recebimento', 'recebimento', 1, 'x')`))).not.toBeNull();
      expect((await err(db.query(`select audita.reverse_cash_entry(gen_random_uuid(), 'Motivo qualquer')`)))?.code).toBe("42501");
    });
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

describe.skipIf(!ready)("V1.1 — permissões reais (banco de desenvolvimento)", () => {
  it("somente o administrador; operador, marketing, sem acesso e anônimo não leem, não gravam e não executam", async () => {
    const admin = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    expect((await admin.from("service_contracts").select("id").limit(1)).error).toBeNull();
    expect((await admin.from("cash_entries").select("id").limit(1)).error).toBeNull();
    const fake = "00000000-0000-4000-8000-000000000000";
    for (const c of [
      await signedIn(process.env.TEST_OPERADOR_EMAIL!, process.env.TEST_OPERADOR_PASSWORD!),
      await signedIn(process.env.TEST_MARKETING_EMAIL!, process.env.TEST_MARKETING_PASSWORD!),
      await signedIn(process.env.TEST_INTRUSO_EMAIL!, process.env.TEST_INTRUSO_PASSWORD!),
    ]) {
      for (const t of ["service_contracts", "service_contract_events", "service_orders", "scope_changes", "contract_documents", "cash_entries"]) {
        const r = await c.from(t).select("id").limit(1);
        expect(r.error, t).toBeNull();
        expect(r.data, t).toEqual([]);
      }
      expect(
        (await c.from("cash_entries").insert({ occurred_on: "2026-10-01", kind: "recebimento", category: "recebimento", amount: 1, description: "[TESTE] não deveria", is_test: true })).error,
      ).not.toBeNull();
      expect((await c.rpc("create_service_contract", { p_quote_id: fake })).error?.code).toBe("42501");
      expect((await c.rpc("reverse_cash_entry", { p_id: fake, p_reason: "[TESTE] motivo" })).error?.code).toBe("42501");
    }
    expect((await client().from("cash_entries").select("id")).error).not.toBeNull();
  });
});
