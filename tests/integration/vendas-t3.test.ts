/**
 * T3 — Vitrine e vendas: a venda só abre com vendedor, termos, privacidade e credenciais; credenciais no Vault (só o
 * final aparece; só a chave de serviço lê); catálogo só com curso à venda, publicado e com preço; pedido validado;
 * pagamento conferido (valor e moeda), matrícula automática idempotente e suspensão no estorno; nada para anon nem para
 * usuários comuns. PGlite (Vault simulado). Dados fictícios.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000076a1";
const BUYER = "00000000-0000-4000-8000-0000000076b1";
const TEXT = "[TESTE] Texto fictício de termos e condições para verificar a abertura da venda na vitrine.";

describe("T3 — vitrine e vendas (PGlite)", () => {
  let db: PGlite;
  let course = "";
  let order = { order_id: "", token: "" };
  const err = async (p: Promise<unknown>) => {
    try {
      await p;
      return null;
    } catch (e) {
      return e as { code?: string; message: string };
    }
  };
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
  const create = (o: Record<string, unknown> = {}) =>
    one<{ r: { order_id: string; token: string; amount: string } }>(`select audita.training_order_create($1, $2, $3, $4, $5, $6) r`, [
      o.code ?? "T601",
      o.name ?? "[TESTE] Comprador Fictício",
      o.email ?? "comprador@exemplo.test",
      o.cpf ?? "52998224725",
      o.phone ?? null,
      o.accept ?? true,
    ]);

  beforeAll(async () => {
    db = await migratedDb();
    // Vault mínimo (no Supabase é a extensão supabase_vault)
    await db.exec(`
      create schema vault;
      create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text, description text);
      create function vault.create_secret(s text, n text, d text) returns uuid language sql as $$ insert into vault.secrets (secret, name, description) values (s, n, d) returning id $$;
      create function vault.update_secret(i uuid, s text) returns void language sql as $$ update vault.secrets set secret = s where id = i $$;
      create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
      grant usage on schema extensions to authenticated, service_role;
      insert into auth.users (id, email) values ('${ADMIN}', 'admin@exemplo.test'), ('${BUYER}', 'comprador@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values ('${ADMIN}', '[TESTE] Admin', 'admin');
    `);
    await admin(async () => {
      course = (await one<{ id: string }>(`select audita.training_create_course('T601', '[TESTE] Curso à venda', '1.0') id`)).id;
      const version = (await one<{ id: string }>(`select id from audita.training_versions where course_id = $1`, [course])).id;
      await q(`update audita.training_versions set workload_minutes = 60, instructor_name = '[TESTE] Instrutor' where id = $1`, [version]);
      await q(`select audita.training_add_module($1, '[TESTE] Módulo 2')`, [version]);
      for (const m of await q<{ id: string; position: number }>(`select id, position from audita.training_modules where version_id = $1`, [version])) {
        const path = `training/${course}/apostila-${m.position}.pdf`;
        await db.exec(`reset role; insert into storage.objects (bucket_id, name) values ('audita-treinamentos', '${path}'); set role authenticated;`);
        await q(
          `insert into audita.training_files (version_id, module_id, kind, storage_path, original_name, mime_type, size_bytes, sha256)
           values ($1, $2, 'apostila', $3, 'a.pdf', 'application/pdf', 100, $4)`,
          [version, m.id, path, "e".repeat(64)],
        );
      }
      await q(`select audita.training_publish_version($1)`, [version]);
      await q(`update audita.training_courses set price = 197.00, access_days = 90 where id = $1`, [course]);
    });
  }, 120000);
  afterAll(async () => db?.close());

  it("venda só abre completa; credenciais no Vault com só o final visível", async () => {
    await admin(async () => {
      expect((await err(q(`update audita.training_sales_settings set sales_enabled = true`)))?.message).toContain("Para abrir as vendas");
      expect((await err(q(`update audita.training_sales_settings set seller_document = '11111111111111'`)))?.code).toBe("23514");
      await q(
        `update audita.training_sales_settings set seller_name = '[TESTE] Vendedor', seller_document = '11222333000181',
           support_email = 'suporte@exemplo.test', terms_text = $1, privacy_text = $1`,
        [TEXT],
      );
      expect((await err(q(`update audita.training_sales_settings set mp_token_hint = 'x'`)))?.code).toBe("42501");
      expect((await err(q(`select audita.training_set_payment_secret('mp_access_token', 'chave-sem-prefixo-123456')`)))?.message).toContain("APP_USR-");
      await q(`select audita.training_set_payment_secret('mp_access_token', 'TEST-1234567890-abcdefghij-9876')`);
      await q(`select audita.training_set_payment_secret('mp_webhook_secret', 'segredo-fictício-de-assinatura-1234')`);
      await q(`select audita.training_set_payment_secret('mp_webhook_secret', 'segredo-fictício-de-assinatura-5678')`);
      const s = await one(`select mp_token_hint, mp_secret_hint, terms_updated_at is not null as terms from audita.training_sales_settings`);
      expect(s).toEqual({ mp_token_hint: "TESTE ••••9876", mp_secret_hint: "••••5678", terms: true });
      expect((await err(q(`select audita.training_payment_secret('mp_webhook_secret')`)))?.code).toBe("42501");
      expect((await err(q(`select audita.training_catalog(null)`)))?.code).toBe("42501");
      await q(`update audita.training_sales_settings set sales_enabled = true`);
    });
    await service(async () => {
      expect((await one<{ s: string }>(`select audita.training_payment_secret('mp_webhook_secret') s`)).s).toBe("segredo-fictício-de-assinatura-5678");
    });
    await asUser(db, BUYER, async () => {
      expect((await err(q(`select audita.training_set_payment_secret('mp_access_token', 'TEST-1234567890-abcdefghij-0000')`)))?.code).toBe("42501");
      expect(await q(`select * from audita.training_sales_settings`)).toHaveLength(0);
    });
    await asUser(db, null, async () => {
      expect((await err(q(`select audita.training_store_info()`)))?.code).toBe("42501");
      expect((await err(create()))?.code).toBe("42501");
    });
  });

  it("catálogo só com curso à venda, publicado e com preço", async () => {
    await service(async () => {
      expect((await one<{ c: unknown[] }>(`select audita.training_catalog(null) c`)).c).toEqual([]);
    });
    await admin(() => q(`update audita.training_courses set on_sale = true where id = $1`, [course]));
    await service(async () => {
      const c = (await one<{ c: { code: string; price: number; access_days: number; modules: unknown[] }[] }>(`select audita.training_catalog('t601') c`)).c;
      expect(c).toHaveLength(1);
      expect(c[0]).toMatchObject({ code: "T601", price: 197, access_days: 90 });
      expect(c[0].modules).toHaveLength(2);
    });
  });

  it("pedido validado; pagamento conferido; matrícula automática, idempotente e suspensa no estorno", async () => {
    await service(async () => {
      expect((await err(create({ accept: false })))?.message).toContain("aceite os termos");
      expect((await err(create({ cpf: "12345678900" })))?.message).toContain("CPF inválido");
      expect((await err(create({ cpf: "" })))?.message).toContain("Informe o CPF");
      expect((await err(create({ name: "Fulano" })))?.message).toContain("nome completo");
      expect((await err(create({ code: "X999" })))?.code).toBe("P0002");
      order = (await create({ email: "Comprador@Exemplo.test" })).r;
      expect(order.token).toMatch(/^[0-9a-f]{32}$/);
      expect((await one<{ r: unknown }>(`select audita.training_order_public($1, $2) r`, [order.order_id, "0".repeat(32)])).r).toBeNull();
      const pay = (status: string, amount = 197) => JSON.stringify({ id: `pg-${status}`, status, transaction_amount: amount, currency_id: "BRL", payment_method_id: "pix" });
      expect((await err(q(`select audita.training_order_apply_payment($1, $2)`, [order.order_id, pay("approved", 1)])))?.message).toContain("Valor do pagamento");
      expect((await one<{ r: { status: string; fulfill: boolean } }>(`select audita.training_order_apply_payment($1, $2) r`, [order.order_id, pay("pending")])).r).toMatchObject({
        status: "pendente",
        fulfill: false,
      });
      expect((await one<{ r: { status: string; fulfill: boolean; email: string } }>(`select audita.training_order_apply_payment($1, $2) r`, [order.order_id, pay("approved")])).r).toEqual({
        status: "aprovado",
        fulfill: true,
        manual_refund: false,
        email: "comprador@exemplo.test",
        name: "[TESTE] Comprador Fictício",
      });
      const f = (await one<{ r: { enrollment_id: string; new_student: boolean } }>(`select audita.training_order_fulfill($1, $2) r`, [order.order_id, BUYER])).r;
      expect(f.new_student).toBe(true);
      const e = await one(`select e.status, e.source, e.access_until - e.starts_on as days, s.source as st from audita.training_enrollments e join audita.training_students s on s.id = e.student_id where e.id = $1`, [f.enrollment_id]);
      expect(e).toEqual({ status: "ativa", source: "compra", days: 90, st: "compra" });
      // Aviso repetido: nada a liberar; pedido aprovado não volta para pendente
      expect((await one<{ r: { fulfill: boolean } }>(`select audita.training_order_apply_payment($1, $2) r`, [order.order_id, pay("approved")])).r.fulfill).toBe(false);
      expect((await one<{ r: { status: string } }>(`select audita.training_order_apply_payment($1, $2) r`, [order.order_id, pay("in_process")])).r.status).toBe("aprovado");
      expect((await one<{ r: { enrollment_id: string } }>(`select audita.training_order_fulfill($1, $2) r`, [order.order_id, BUYER])).r.enrollment_id).toBe(f.enrollment_id);
      expect((await one<{ r: { status: string; enrolled: boolean } }>(`select audita.training_order_public($1, $2) r`, [order.order_id, order.token])).r).toMatchObject({
        status: "aprovado",
        enrolled: true,
      });
      // Com acesso ativo, não compra de novo
      expect((await err(create()))?.message).toContain("já tem acesso");
      // Certificado já emitido (como na conclusão do curso)
      await db.exec(`reset role; select set_config('audita.training_flow', 'on', false);
        insert into audita.training_certificates (enrollment_id, code, student_name, course_code, course_title, version_label, started_on, completed_on)
        values ('${f.enrollment_id}', 'AAAA-BBBB-CCCC', '[TESTE] Comprador', 'T601', '[TESTE] Curso', '1.0', current_date, current_date);
        select set_config('audita.training_flow', 'off', false); set role service_role;`);
      // Estorno (ou reembolso do arrependimento) suspende a matrícula e cancela o certificado
      await q(`select audita.training_order_apply_payment($1, $2)`, [order.order_id, pay("refunded")]);
      expect((await one<{ status: string }>(`select status from audita.training_enrollments where id = $1`, [f.enrollment_id])).status).toBe("suspensa");
      expect(await one(`select status, status_note from audita.training_certificates where enrollment_id = $1`, [f.enrollment_id])).toEqual({
        status: "cancelado",
        status_note: "Compra reembolsada ou estornada no Mercado Pago.",
      });
      // Consentimento para novidades: opcional e registrado no pedido
      const withOptIn = (await one<{ r: { order_id: string } }>(`select audita.training_order_create('T601', '[TESTE] Outra Pessoa', 'optin@exemplo.test', '52998224725', null, true, true) r`)).r;
      const without = (await one<{ r: { order_id: string } }>(`select audita.training_order_create('T601', '[TESTE] Mais Uma', 'semoptin@exemplo.test', '52998224725', null, true, false) r`)).r;
      expect(await q(`select marketing_opt_in from audita.training_orders where id in ($1, $2) order by marketing_opt_in desc`, [withOptIn.order_id, without.order_id])).toEqual([
        { marketing_opt_in: true },
        { marketing_opt_in: false },
      ]);
    });
    await admin(async () => {
      expect(await q(`select status from audita.training_orders order by created_at limit 1`)).toEqual([{ status: "estornado" }]);
      await q(`update audita.training_sales_settings set sales_enabled = false`);
    });
    await service(async () => {
      expect((await err(create({ email: "outro@exemplo.test" })))?.message).toContain("vendas estão fechadas");
    });
  });
});
