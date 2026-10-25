/**
 * Correções da auditoria de segurança (25/10/2026) — testes de regressão no banco (PGlite com todas as migrações; nunca
 * contra a produção). Dados fictícios marcados como [TESTE].
 *   1) operador não lê contingência, margem e desconto do item (privilégio de coluna + função só do administrador);
 *   2) estrutura do curso e consultas de prova só para matrícula em vigor (situação, prazo e acesso não revogado);
 *   3) estorno de matrícula concluída encerra o acesso ao conteúdo e cancela o certificado;
 *   4) apostila no armazenamento só de módulo ativo e liberado;
 *   5) pedido de estranho não é pendurado na matrícula de quem já tinha acesso, e o estorno não mexe nela;
 *   6) pedido vence e a aprovação confere de novo vendas, vitrine, curso e preço;
 *   7/8) limites por IP e por e-mail, reaproveitamento do pedido pendente e tamanho do e-mail;
 *   11) tipo do arquivo restrito no banco.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

type Err = { code?: string; message: string };
const err = async (p: Promise<unknown>): Promise<Err | null> => {
  try {
    await p;
    return null;
  } catch (e) {
    return e as Err;
  }
};

describe("Auditoria 25/10/2026 — preços do item só para o administrador (PGlite)", () => {
  const ADMIN = "00000000-0000-4000-8000-00000000a5a1";
  const OPER = "00000000-0000-4000-8000-00000000a5a2";
  const CLIENT = "00000000-0000-4000-8000-00000000a5c1";
  const DEMAND = "00000000-0000-4000-8000-00000000a5d1";
  const QUOTE = "00000000-0000-4000-8000-00000000a5e1";
  const ITEM = "00000000-0000-4000-8000-00000000a5f1";
  let db: PGlite;
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

  beforeAll(async () => {
    db = await migratedDb();
    await db.exec(`
      insert into auth.users (id, email) values ('${ADMIN}', 'a@exemplo.test'), ('${OPER}', 'o@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values ('${ADMIN}', '[TESTE] Admin', 'admin'), ('${OPER}', '[TESTE] Operador', 'operador');
      set session_replication_role = replica;
      insert into audita.clients (id, client_code, legal_name, is_test) values ('${CLIENT}', 'CLI-9501', '[TESTE] Cliente Fictício LTDA', true);
      insert into audita.demands (id, demand_code, client_id, summary, status, is_test) values ('${DEMAND}', 'DEM-2026-9501', '${CLIENT}', '[TESTE] Demanda', 'em_analise', true);
      insert into audita.quotes (id, quote_code, demand_id, client_id, status, is_test) values ('${QUOTE}', 'PROP-2026-9501', '${DEMAND}', '${CLIENT}', 'rascunho', true);
      insert into audita.quote_items (id, quote_id, position, description, hours_execution, margin, contingency, discount, discount_reason)
        values ('${ITEM}', '${QUOTE}', 1, '[TESTE] Item', 10, 0.35, 0.10, 0.05, '[TESTE] desconto negociado');
      set session_replication_role = origin;
    `);
  }, 120000);
  afterAll(async () => db?.close());

  it("operador lê o item sem os ajustes de preço; contingência, margem e desconto são negados no banco", async () => {
    await asUser(db, OPER, async () => {
      expect(await q(`select id, description, hours_execution, scope_notes from audita.quote_items where quote_id = $1`, [QUOTE])).toHaveLength(1);
      for (const col of ["margin", "contingency", "discount", "discount_reason", "discount_authorized", "discount_authorized_at", "discount_authorized_by"]) {
        expect((await err(q(`select ${col} from audita.quote_items`)))?.code, col).toBe("42501");
      }
      expect((await err(q(`select * from audita.quote_items`)))?.code).toBe("42501");
      expect((await err(q(`select * from audita.quote_item_pricing($1)`, [QUOTE])))?.code).toBe("42501");
      // O operador continua preparando horas e despesas (sem tocar nos preços)
      expect(await q(`update audita.quote_items set hours_execution = 12 where id = $1 returning id`, [ITEM])).toHaveLength(1);
      expect((await err(q(`update audita.quote_items set margin = 0.9 where id = $1`, [ITEM])))?.code).toBe("42501");
      expect(await q(`select count(*)::int as n from audita.quote_items where quote_id = $1`, [QUOTE])).toEqual([{ n: 1 }]);
    });
  });

  it("administrador lê os ajustes pela função própria e continua gravando", async () => {
    await asUser(db, ADMIN, async () => {
      const rows = await q<{ item_id: string; margin: string; contingency: string; discount: string; discount_reason: string }>(
        `select * from audita.quote_item_pricing($1)`,
        [QUOTE],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ item_id: ITEM, discount_reason: "[TESTE] desconto negociado" });
      expect(Number(rows[0].margin)).toBe(0.35);
      expect(Number(rows[0].contingency)).toBe(0.1);
      expect(Number(rows[0].discount)).toBe(0.05);
      expect(await q(`update audita.quote_items set margin = 0.30 where id = $1 returning id`, [ITEM])).toHaveLength(1);
      expect(Number((await q<{ margin: string }>(`select margin from audita.quote_item_pricing($1)`, [QUOTE]))[0].margin)).toBe(0.3);
    });
  });
});

describe("Auditoria 25/10/2026 — acesso do aluno e pedidos da vitrine (PGlite)", () => {
  const ADMIN = "00000000-0000-4000-8000-00000000b5a1";
  const BUYER = "00000000-0000-4000-8000-00000000b5b1";
  const VICTIM = "00000000-0000-4000-8000-00000000b5b2";
  const TEXT = "[TESTE] Texto fictício de termos e condições para verificar a abertura da venda na vitrine.";
  const IP_A = "a".repeat(64);
  const IP_B = "b".repeat(64);
  let db: PGlite;
  let course = "";
  let version = "";
  const mods: { id: string; position: number; path: string }[] = [];
  let inactivePath = "";
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
  const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0];
  const admin = <T>(fn: () => Promise<T>) => asUser(db, ADMIN, fn);
  const service = async <T>(fn: () => Promise<T>) => {
    await db.exec(`set role service_role`);
    try {
      return await fn();
    } finally {
      await db.exec(`reset role`);
    }
  };
  type Created = { order_id?: string; token?: string; reused?: boolean; erro?: string; init_point?: string | null; expires_at?: string };
  const create = (o: Record<string, unknown> = {}) =>
    service(async () =>
      (
        await one<{ r: Created }>(`select audita.training_order_create($1, $2, $3, $4, $5, $6, $7, $8) r`, [
          o.code ?? "T701",
          o.name ?? "[TESTE] Comprador Fictício",
          o.email ?? "comprador@exemplo.test",
          o.cpf ?? "52998224725",
          null,
          true,
          false,
          o.ip === undefined ? IP_A : o.ip,
        ])
      ).r,
    );
  const pay = (status: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ id: `pg-${status}-${Math.random().toString(16).slice(2)}`, status, transaction_amount: 197, currency_id: "BRL", payment_method_id: "pix", ...extra });
  const apply = (order: string, status: string, extra: Record<string, unknown> = {}) =>
    service(async () => (await one<{ r: { status: string; fulfill: boolean; manual_refund: boolean } }>(`select audita.training_order_apply_payment($1, $2) r`, [order, pay(status, extra)])).r);
  const fulfill = (order: string, user: string) =>
    service(async () => (await one<{ r: { enrollment_id: string | null; manual_refund?: boolean } }>(`select audita.training_order_fulfill($1, $2) r`, [order, user])).r);
  const reason = async (order: string) => (await one<{ manual_refund_reason: string | null }>(`select manual_refund_reason from audita.training_orders where id = $1`, [order])).manual_refund_reason;
  /** Libera para leitura (como superusuário): limpa as tentativas, para cada cenário começar do zero. */
  const resetAttempts = () => db.exec(`delete from audita.training_purchase_attempts`);

  beforeAll(async () => {
    db = await migratedDb();
    await db.exec(`
      create schema vault;
      create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text, description text);
      create function vault.create_secret(s text, n text, d text) returns uuid language sql as $$ insert into vault.secrets (secret, name, description) values (s, n, d) returning id $$;
      create function vault.update_secret(i uuid, s text) returns void language sql as $$ update vault.secrets set secret = s where id = i $$;
      create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
      grant usage on schema extensions, storage to authenticated, service_role;
      grant select on storage.objects to authenticated;
      insert into auth.users (id, email) values ('${ADMIN}', 'admin@exemplo.test'), ('${BUYER}', 'comprador@exemplo.test'), ('${VICTIM}', 'vitima@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values ('${ADMIN}', '[TESTE] Admin', 'admin');
    `);
    await admin(async () => {
      course = (await one<{ id: string }>(`select audita.training_create_course('T701', '[TESTE] Curso da auditoria', '1.0') id`)).id;
      version = (await one<{ id: string }>(`select id from audita.training_versions where course_id = $1`, [course])).id;
      await q(`update audita.training_versions set workload_minutes = 60, instructor_name = '[TESTE] Instrutor' where id = $1`, [version]);
      await q(`select audita.training_add_module($1, '[TESTE] Módulo 2')`, [version]);
      await q(`select audita.training_add_module($1, '[TESTE] Módulo 3 (inativado)')`, [version]);
      for (const m of await q<{ id: string; position: number }>(`select id, position from audita.training_modules where version_id = $1 order by position`, [version])) {
        const path = `training/${course}/apostila-${m.position}.pdf`;
        await db.exec(`reset role; insert into storage.objects (bucket_id, name) values ('audita-treinamentos', '${path}'); set role authenticated;`);
        await q(
          `insert into audita.training_files (version_id, module_id, kind, storage_path, original_name, mime_type, size_bytes, sha256)
           values ($1, $2, 'apostila', $3, 'a.pdf', 'application/pdf', 100, $4)`,
          [version, m.id, path, "e".repeat(64)],
        );
        if (m.position === 3) {
          inactivePath = path;
          await q(`update audita.training_modules set status = 'inativo' where id = $1`, [m.id]);
        } else mods.push({ ...m, path });
      }
      await q(`select audita.training_publish_version($1)`, [version]);
      await q(`update audita.training_courses set price = 197.00, access_days = 90, on_sale = true where id = $1`, [course]);
      await q(
        `update audita.training_sales_settings set seller_name = '[TESTE] Vendedor', seller_document = '11222333000181',
           support_email = 'suporte@exemplo.test', terms_text = $1, privacy_text = $1`,
        [TEXT],
      );
      await q(`select audita.training_set_payment_secret('mp_access_token', 'TEST-1234567890-abcdefghij-9876')`);
      await q(`select audita.training_set_payment_secret('mp_webhook_secret', 'segredo-fictício-de-assinatura-1234')`);
      await q(`update audita.training_sales_settings set sales_enabled = true`);
    });
  }, 120000);
  afterAll(async () => db?.close());

  it("11) tipo do arquivo: só a lista do sistema; arquivo do aluno só PDF ou imagem", async () => {
    const row = (kind: string, mime: string, n: number) =>
      `insert into audita.training_files (version_id, module_id, kind, storage_path, original_name, mime_type, size_bytes, sha256)
       values ('${version}', null, '${kind}', 'training/${course}/x${n}.pdf', 'x.pdf', '${mime}', 1, '${"f".repeat(64)}')`;
    // Gatilhos desligados (como uma gravação direta): só a restrição do banco decide
    await db.exec(`set session_replication_role = replica`);
    try {
      expect((await err(db.query(row("ficha_tecnica", "text/html", 1))))?.code).toBe("23514");
      expect((await err(db.query(row("ficha_tecnica", "image/svg+xml", 2))))?.code).toBe("23514");
      expect((await err(db.query(row("ficha_tecnica", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 3))))?.code).toBe("23514");
      expect((await err(db.query(row("plano_pedagogico", "text/html", 4))))?.code).toBe("23514");
      expect(await err(db.query(row("plano_pedagogico", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 5)))).toBeNull();
    } finally {
      await db.exec(`set session_replication_role = origin`);
    }
    const c = await one<{ def: string }>(`select pg_get_constraintdef(oid) def from pg_constraint where conname = 'training_files_mime_allowed'`);
    expect(c.def).toContain("application/pdf");
    expect(c.def).not.toContain("NOT VALID");
  });

  it("7/8) limites por e-mail e por IP; pedido pendente do mesmo comprador é reaproveitado; e-mail longo recusado", async () => {
    await resetAttempts();
    const first = await create({ email: "repete@exemplo.test" });
    expect(first.order_id).toBeTruthy();
    expect(first.reused).toBe(false);
    expect(new Date(first.expires_at!).getTime() - Date.now()).toBeGreaterThan(71 * 3600 * 1000);
    // Mesmo comprador (e-mail, nome e CPF): mesmo pedido, nenhum pedido novo
    await service(() => q(`select audita.training_order_set_preference($1, 'pref-1', 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1')`, [first.order_id]));
    const again = await create({ email: "repete@exemplo.test", ip: IP_B });
    expect(again).toMatchObject({ order_id: first.order_id, reused: true, init_point: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1" });
    // Outro nome com o mesmo e-mail: não recebe o pedido (nem o token) de outra pessoa
    const otherName = await create({ email: "repete@exemplo.test", name: "[TESTE] Outra Pessoa" });
    expect(otherName.order_id).not.toBe(first.order_id);
    await create({ email: "repete@exemplo.test" });
    await create({ email: "repete@exemplo.test" });
    // 6ª tentativa do mesmo e-mail na janela: recusada
    expect((await err(create({ email: "repete@exemplo.test", ip: IP_B })))?.code).toBe("54000");
    expect((await one<{ n: number }>(`select count(*)::int n from audita.training_orders where buyer_email = 'repete@exemplo.test'`)).n).toBe(2);

    // Por IP: 20 tentativas por hora (e-mails diferentes)
    await resetAttempts();
    for (let i = 0; i < 20; i++) await create({ email: `ip${i}@exemplo.test`, ip: IP_A });
    expect((await err(create({ email: "ip-extra@exemplo.test", ip: IP_A })))?.code).toBe("54000");
    expect((await create({ email: "ip-extra@exemplo.test", ip: IP_B })).order_id).toBeTruthy();

    // E-mail com mais de 254 caracteres e hash de IP malformado
    await resetAttempts();
    expect((await err(create({ email: `${"a".repeat(250)}@exemplo.test` })))?.message).toContain("e-mail válido");
    expect((await err(create({ ip: "nao-e-hash" })))?.code).toBe("22023");
    expect((await err(service(() => q(`insert into audita.training_orders (course_id, version_id, course_code, course_title, buyer_name, buyer_email, amount, terms_accepted_at)
      values ($1, $2, 'T701', 'x', '[TESTE] Nome Longo', $3, 1, now())`, [course, version, `${"a".repeat(250)}@exemplo.test`]))))?.code).toBe("23514");
    // Ninguém além da chave de serviço vê ou grava as tentativas
    await asUser(db, BUYER, async () => expect((await err(q(`insert into audita.training_purchase_attempts (email_hash) values ($1)`, ["c".repeat(64)])))?.code).toBe("42501"));
    await asUser(db, null, async () => expect((await err(q(`select audita.training_order_create('T701', 'a b c', 'x@y.z', null, null, true, false, null)`)))?.code).toBe("42501"));
  });

  it("4) apostila no armazenamento só de módulo ativo e liberado; 2) estrutura do curso só com matrícula em vigor", async () => {
    await resetAttempts();
    const o = await create();
    expect((await apply(o.order_id!, "approved")).fulfill).toBe(true);
    const f = await fulfill(o.order_id!, BUYER);
    const enr = f.enrollment_id!;
    expect((await one<{ order_id: string }>(`select order_id from audita.training_enrollments where id = $1`, [enr])).order_id).toBe(o.order_id);
    const canRead = (path: string) => asUser(db, BUYER, async () => (await q(`select name from storage.objects where name = $1`, [path])).length === 1);
    expect(await canRead(mods[0].path)).toBe(true);
    expect(await canRead(mods[1].path)).toBe(false); // módulo 2 bloqueado
    expect(await canRead(inactivePath)).toBe(false); // módulo inativo
    await asUser(db, BUYER, () => q(`select audita.training_complete_step($1, $2, 'apostila')`, [enr, mods[0].id]));
    expect(await canRead(mods[1].path)).toBe(true);
    expect(await canRead(inactivePath)).toBe(false);

    // Matrícula suspensa ou vencida: nem estrutura (link do vídeo e resumo) nem histórico de provas
    await admin(() => q(`update audita.training_enrollments set status = 'suspensa' where id = $1`, [enr]));
    await asUser(db, BUYER, async () => {
      expect((await err(q(`select * from audita.training_outline($1)`, [enr])))?.message).toContain("Matrícula suspensa");
      expect((await err(q(`select * from audita.training_attempt_latest($1, $2)`, [enr, mods[0].id])))?.code).toBe("42501");
    });
    expect(await canRead(mods[0].path)).toBe(false);
    // O administrador continua consultando
    await admin(async () => expect(await q(`select module_id from audita.training_outline($1)`, [enr])).toHaveLength(2));
    await admin(() => q(`update audita.training_enrollments set status = 'ativa' where id = $1`, [enr]));
    await db.exec(`set session_replication_role = replica; update audita.training_enrollments set starts_on = current_date - 10, access_until = current_date - 1 where id = '${enr}'; set session_replication_role = origin;`);
    await asUser(db, BUYER, async () => expect((await err(q(`select * from audita.training_outline($1)`, [enr])))?.message).toContain("prazo de acesso terminou"));
    await db.exec(`set session_replication_role = replica; update audita.training_enrollments set access_until = null where id = '${enr}'; set session_replication_role = origin;`);
    await asUser(db, BUYER, async () => expect(await q(`select module_id from audita.training_outline($1)`, [enr])).toHaveLength(2));
  });

  it("3) estorno de matrícula concluída encerra o acesso ao conteúdo e cancela o certificado", async () => {
    const enr = (await one<{ id: string; order_id: string }>(`select id, order_id from audita.training_enrollments where order_id is not null`)) as { id: string; order_id: string };
    await asUser(db, BUYER, () => q(`select audita.training_complete_step($1, $2, 'apostila')`, [enr.id, mods[1].id]));
    expect(await one(`select status from audita.training_enrollments where id = $1`, [enr.id])).toEqual({ status: "concluida" });
    expect(await one(`select status from audita.training_certificates where enrollment_id = $1`, [enr.id])).toEqual({ status: "valido" });
    await asUser(db, BUYER, async () => expect(await q(`select audita.training_student_has_version($1) ok`, [version])).toEqual([{ ok: true }]));

    // Ninguém (nem o administrador) grava a marca de revogação fora do fluxo
    await admin(async () => expect((await err(q(`update audita.training_enrollments set access_revoked_at = now() where id = $1`, [enr.id])))?.code).toBe("42501"));

    const r = await apply(enr.order_id, "refunded");
    expect(r.status).toBe("estornado");
    const e = await one<{ status: string; revoked: boolean }>(`select status, access_revoked_at is not null as revoked from audita.training_enrollments where id = $1`, [enr.id]);
    expect(e).toEqual({ status: "concluida", revoked: true });
    expect(await one(`select status from audita.training_certificates where enrollment_id = $1`, [enr.id])).toEqual({ status: "cancelado" });
    await asUser(db, BUYER, async () => {
      expect(await q(`select audita.training_student_has_version($1) ok`, [version])).toEqual([{ ok: false }]);
      expect(await q(`select id from audita.training_modules`)).toHaveLength(0);
      expect(await q(`select id from audita.training_files`)).toHaveLength(0);
      expect(await q(`select name from storage.objects where name = $1`, [mods[0].path])).toHaveLength(0);
      expect((await err(q(`select * from audita.training_outline($1)`, [enr.id])))?.message).toContain("acesso a este curso foi encerrado");
    });
    // A marca é definitiva
    await db.exec(`select set_config('audita.training_flow', 'on', false)`);
    expect((await err(db.query(`update audita.training_enrollments set access_revoked_at = null where id = $1`, [enr.id])))?.code).toBe("42501");
    await db.exec(`select set_config('audita.training_flow', 'off', false)`);
  });

  it("5) pedido de estranho não se pendura na matrícula de quem já tem acesso; estorno não mexe nela", async () => {
    await resetAttempts();
    // Estranho faz pedido com o e-mail da vítima antes da matrícula dela
    const attacker = await create({ email: "vitima@exemplo.test", name: "[TESTE] Atacante Fictício" });
    // A vítima é matriculada pela gestão e conclui o curso
    const victimEnr = await admin(async () => {
      const st = (await one<{ id: string }>(
        `insert into audita.training_students (user_id, full_name, email, source, is_test) values ($1, '[TESTE] Vítima', 'vitima@exemplo.test', 'gestao', true) returning id`,
        [VICTIM],
      )).id;
      return (await one<{ id: string }>(`select audita.training_enroll($1, $2, null, 'gestao') id`, [st, course])).id;
    });
    // O estranho paga: nada é liberado nem vinculado; o pedido fica para reembolso manual
    const ap = await apply(attacker.order_id!, "approved");
    expect(ap).toMatchObject({ status: "aprovado", fulfill: false, manual_refund: true });
    expect(await reason(attacker.order_id!)).toContain("já tinha matrícula em aberto");
    expect(await fulfill(attacker.order_id!, VICTIM)).toMatchObject({ enrollment_id: null, manual_refund: true });
    expect(await one(`select enrollment_id from audita.training_orders where id = $1`, [attacker.order_id])).toEqual({ enrollment_id: null });
    for (const m of mods) await asUser(db, VICTIM, () => q(`select audita.training_complete_step($1, $2, 'apostila')`, [victimEnr, m.id]));
    expect(await one(`select status from audita.training_certificates where enrollment_id = $1`, [victimEnr])).toEqual({ status: "valido" });
    // O estorno do pedido do estranho não alcança a matrícula nem o certificado da vítima
    await apply(attacker.order_id!, "refunded");
    expect(await one(`select status, access_revoked_at from audita.training_enrollments where id = $1`, [victimEnr])).toEqual({ status: "concluida", access_revoked_at: null });
    expect(await one(`select status from audita.training_certificates where enrollment_id = $1`, [victimEnr])).toEqual({ status: "valido" });
    // Fluxo antigo (pedido já pendurado numa matrícula que não criou): o estorno também não mexe nela
    const legacy = await create({ email: "outra-vitima@exemplo.test", name: "[TESTE] Atacante Fictício" });
    await db.exec(`set session_replication_role = replica; update audita.training_orders set status = 'aprovado', enrollment_id = '${victimEnr}' where id = '${legacy.order_id}'; set session_replication_role = origin;`);
    await apply(legacy.order_id!, "refunded");
    expect(await one(`select status from audita.training_certificates where enrollment_id = $1`, [victimEnr])).toEqual({ status: "valido" });
  });

  it("6) pedido vencido, vitrine fechada, preço maior ou curso inativo: pago fica para reembolso manual, sem matrícula", async () => {
    await resetAttempts();
    // Vencido: pagamento criado depois do vencimento
    const expired = await create({ email: "vencido@exemplo.test" });
    await db.exec(`set session_replication_role = replica; update audita.training_orders set created_at = now() - interval '4 days', expires_at = now() - interval '1 day' where id = '${expired.order_id}'; set session_replication_role = origin;`);
    expect(await apply(expired.order_id!, "approved", { date_created: new Date().toISOString() })).toMatchObject({ fulfill: false, manual_refund: true });
    expect(await reason(expired.order_id!)).toContain("vencimento");
    expect(await service(async () => (await one<{ r: { expired: boolean; manual_refund: boolean } }>(`select audita.training_order_public($1, $2) r`, [expired.order_id, expired.token])).r)).toMatchObject({
      manual_refund: true,
    });
    // Pagamento iniciado antes do vencimento (ex.: Pix aprovado depois) continua valendo
    const pixLate = await create({ email: "pix@exemplo.test" });
    await db.exec(`set session_replication_role = replica; update audita.training_orders set created_at = now() - interval '4 days', expires_at = now() - interval '1 hour' where id = '${pixLate.order_id}'; set session_replication_role = origin;`);
    expect(await apply(pixLate.order_id!, "approved", { date_created: new Date(Date.now() - 2 * 3600 * 1000).toISOString() })).toMatchObject({ fulfill: true });

    // Vitrine fechada para o curso depois do pedido
    const closed = await create({ email: "vitrine@exemplo.test" });
    await admin(() => q(`update audita.training_courses set on_sale = false where id = $1`, [course]));
    expect(await apply(closed.order_id!, "approved")).toMatchObject({ fulfill: false, manual_refund: true });
    expect(await reason(closed.order_id!)).toContain("fora da vitrine");
    await admin(() => q(`update audita.training_courses set on_sale = true where id = $1`, [course]));

    // Preço corrigido para cima depois do pedido
    const cheap = await create({ email: "preco@exemplo.test" });
    await admin(() => q(`update audita.training_courses set price = 297.00 where id = $1`, [course]));
    expect(await apply(cheap.order_id!, "approved")).toMatchObject({ fulfill: false, manual_refund: true });
    expect(await reason(cheap.order_id!)).toContain("preço");
    await admin(() => q(`update audita.training_courses set price = 197.00 where id = $1`, [course]));

    // Vendas fechadas
    const salesOff = await create({ email: "fechadas@exemplo.test" });
    await admin(() => q(`update audita.training_sales_settings set sales_enabled = false`));
    expect(await apply(salesOff.order_id!, "approved")).toMatchObject({ fulfill: false, manual_refund: true });
    await admin(() => q(`update audita.training_sales_settings set sales_enabled = true`));

    // Curso desativado entre a aprovação e a liberação: a liberação confere de novo
    const inactive = await create({ email: "inativo@exemplo.test" });
    expect(await apply(inactive.order_id!, "approved")).toMatchObject({ fulfill: true });
    await admin(() => q(`update audita.training_courses set status = 'inativo' where id = $1`, [course]));
    expect(await fulfill(inactive.order_id!, BUYER)).toMatchObject({ enrollment_id: null, manual_refund: true });
    expect(await reason(inactive.order_id!)).toContain("inativo");
    await admin(() => q(`update audita.training_courses set status = 'ativo' where id = $1`, [course]));
    expect(await one(`select count(*)::int n from audita.training_enrollments e join audita.training_students s on s.id = e.student_id
      where s.email in ('vencido@exemplo.test', 'vitrine@exemplo.test', 'preco@exemplo.test', 'fechadas@exemplo.test', 'inativo@exemplo.test')`)).toEqual({ n: 0 });
  });

  it("aviso 'já tem acesso' conta nas tentativas; as assinaturas antigas mantêm a exceção", async () => {
    await resetAttempts();
    const r = await create({ email: "vitima@exemplo.test" });
    // A vítima tem matrícula concluída (não em aberto): pode comprar de novo; com matrícula ativa, recebe o aviso
    expect(r.order_id).toBeTruthy();
    await resetAttempts();
    const st = (await one<{ id: string }>(`select id from audita.training_students where email = 'comprador@exemplo.test'`)).id;
    await admin(() => q(`select audita.training_enroll($1, $2, null, 'cortesia')`, [st, course]));
    for (let i = 0; i < 5; i++) expect((await create()).erro).toContain("já tem acesso");
    expect((await err(create()))?.code).toBe("54000");
    await resetAttempts();
    await service(async () => {
      expect((await err(q(`select audita.training_order_create('T701', '[TESTE] Comprador Fictício', 'comprador@exemplo.test', '52998224725', null, true)`)))?.message).toContain("já tem acesso");
      expect((await err(q(`select audita.training_order_create('T701', '[TESTE] Comprador Fictício', 'comprador@exemplo.test', '52998224725', null, true, false)`)))?.code).toBe("23505");
    });
  });
});
