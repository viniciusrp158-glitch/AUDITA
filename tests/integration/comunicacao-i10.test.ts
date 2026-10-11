/**
 * I10 — Comunicação sem IA (AUDDOC017 RF-25, RF-27, RF-28, FL-04; AUDDOC003 §11–§12).
 * Parte 1 (PGlite, todas as migrações): logos com versões e aprovação, peça → revisão → aprovação/devolução → exportação,
 *   regras de bloqueio (logo, serviço não liberado, contatos, checklist) e imutabilidade.
 * Parte 2 (banco de desenvolvimento): permissões reais por nível (administrador, marketing, operador, sem acesso, anônimo),
 *   com registros marcados como TESTE.
 */
import type { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000001ad";
const MKT = "00000000-0000-4000-8000-0000000001ac";
const OPER = "00000000-0000-4000-8000-0000000001a0";
const SHA = "a".repeat(64);
const CHECK_OK = { marca: true, identidade: true, texto: true, tom: true, dados: true };

describe("I10 — fluxo de comunicação (PGlite)", () => {
  let db: PGlite;
  let svcOk: string;
  let svcNo: string;
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
      insert into auth.users (id, email) values ('${ADMIN}', 'a@exemplo.test'), ('${MKT}', 'm@exemplo.test'), ('${OPER}', 'o@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values
        ('${ADMIN}', '[TESTE] Admin', 'admin'), ('${MKT}', '[TESTE] Marketing', 'marketing'), ('${OPER}', '[TESTE] Operador', 'operador');
    `);
    const ins = async (code: string) =>
      (
        await q<{ id: string }>(
          `insert into audita.services (service_code, kind, name, family, matrix_class, matrix_class_label, status_basis)
           values ($1, 'servico', '[TESTE] Serviço ' || $1, 'Consultoria', 'A', 'A', '[TESTE]') returning id`,
          [code],
        )
      )[0].id;
    svcOk = await ins("TST-001");
    svcNo = await ins("TST-002");
    await db.exec(`set session_replication_role = replica; update audita.services set commercial_status = 'apto_comercialmente' where id = '${svcOk}'; set session_replication_role = origin;`);
  }, 120000);
  afterAll(async () => db?.close());

  it("biblioteca de marca: só o administrador envia e aprova; versões imutáveis; marketing vê só a aprovada", async () => {
    const assetId = await asUser(db, ADMIN, async () => {
      const a = (await q<{ id: string }>(`insert into audita.brand_assets (brand, variant, title) values ('audita', 'original_png', '[TESTE] Logo AUDITA') returning id`))[0].id;
      const v = await q<{ version: number; status: string }>(
        `insert into audita.brand_asset_versions (asset_id, storage_path, original_name, mime_type, size_bytes, sha256, source_note, status, version)
         values ($1, 'marca/x/v1/logo.png', 'logo.png', 'image/png', 10, $2, 'Arquivo fictício de teste', 'aprovado', 9) returning version, status`,
        [a, SHA],
      );
      expect(v[0]).toEqual({ version: 1, status: "rascunho" });
      return a;
    });
    await asUser(db, MKT, async () => {
      expect(await err(db.query(`insert into audita.brand_assets (brand, variant, title) values ('pro', 'outro', '[TESTE] mkt')`))).not.toBeNull();
      expect(await q(`select id from audita.brand_asset_versions`)).toHaveLength(0); // rascunho invisível ao marketing
    });
    const vid = (await q<{ id: string }>(`select id from audita.brand_asset_versions where asset_id = $1`, [assetId]))[0].id;
    await asUser(db, MKT, async () => {
      expect((await err(db.query(`select audita.approve_brand_asset_version($1, null)`, [vid])))?.code).toBe("42501");
    });
    await asUser(db, ADMIN, async () => {
      expect((await err(db.query(`update audita.brand_asset_versions set sha256 = $2 where id = $1`, [vid, "b".repeat(64)]))) ).not.toBeNull();
      await db.query(`select audita.approve_brand_asset_version($1, 'Conferido com o PNG original')`, [vid]);
      const v2 = (
        await q<{ id: string }>(
          `insert into audita.brand_asset_versions (asset_id, storage_path, original_name, mime_type, size_bytes, sha256, source_note)
           values ($1, 'marca/x/v2/logo.png', 'logo.png', 'image/png', 10, $2, 'Arquivo fictício de teste') returning id`,
          [assetId, "c".repeat(64)],
        )
      )[0].id;
      expect((await err(db.query(`select audita.cancel_brand_asset_version($1, 'x')`, [v2])))?.code).toBe("23514");
      await db.query(`select audita.cancel_brand_asset_version($1, 'Enviado por engano')`, [v2]);
    });
    await asUser(db, MKT, async () => {
      expect(await q(`select version, status from audita.brand_asset_versions`)).toEqual([{ version: 1, status: "aprovado" }]);
    });
  });

  it("peça: marketing escreve e envia; só o administrador aprova; aprovação exige checklist e serviço liberado", async () => {
    const piece = await asUser(db, MKT, async () => {
      const r = await q<{ id: string; piece_code: string; status: string }>(
        `insert into audita.comm_pieces (template, brand, theme, channel, service_id, title, body, is_test, status)
         values ('post_quadrado', 'audita', '[TESTE] Integração de SST', 'linkedin', $1, '[TESTE] Integração de novos colaboradores', 'Texto fictício.', true, 'aprovada')
         returning id, piece_code, status`,
        [svcNo],
      );
      expect(r[0].status).toBe("rascunho");
      expect(r[0].piece_code).toMatch(/^COM-\d{4}-\d{4}$/);
      // situação só muda pelo fluxo
      expect((await err(db.query(`update audita.comm_pieces set status = 'aprovada' where id = $1`, [r[0].id])))?.code).toBe("42501");
      return r[0].id;
    });
    const v1 = await asUser(db, MKT, async () => {
      const id = (await q<{ id: string }>(`select audita.submit_comm_piece($1) id`, [piece]))[0].id;
      // em revisão: rascunho travado
      await db.query(`update audita.comm_pieces set title = 'Mudou' where id = $1`, [piece]);
      expect((await q<{ title: string }>(`select title from audita.comm_pieces where id = $1`, [piece]))[0].title).toContain("[TESTE]");
      expect((await err(db.query(`select audita.review_comm_piece($1, 'aprovar', null, $2)`, [id, CHECK_OK])))?.code).toBe("42501");
      return id;
    });
    const snap = (await q<{ snapshot: Record<string, Record<string, unknown>> }>(`select snapshot from audita.comm_piece_versions where id = $1`, [v1]))[0].snapshot;
    expect(snap.piece.title).toBe("[TESTE] Integração de novos colaboradores");
    expect(snap.logo.sha256).toBe(SHA);
    expect(snap.service.commercial_status).toBe("nao_liberado");
    await asUser(db, ADMIN, async () => {
      expect((await err(db.query(`select audita.review_comm_piece($1, 'aprovar', null, $2)`, [v1, { ...CHECK_OK, tom: false }])))?.message).toContain(
        "Confirme todos",
      );
      expect((await err(db.query(`select audita.review_comm_piece($1, 'aprovar', null, $2)`, [v1, CHECK_OK])))?.message).toContain(
        "não está liberado comercialmente",
      );
      expect((await err(db.query(`select audita.review_comm_piece($1, 'devolver', '', $2)`, [v1, {}])))?.code).toBe("23514");
      await db.query(`select audita.review_comm_piece($1, 'devolver', 'Trocar o serviço citado por um liberado.', '{}')`, [v1]);
    });
    expect((await q(`select status, status_note from audita.comm_pieces where id = $1`, [piece]))[0]).toEqual({
      status: "rascunho",
      status_note: "Trocar o serviço citado por um liberado.",
    });
    const v2 = await asUser(db, MKT, async () => {
      await db.query(`update audita.comm_pieces set service_id = $2, show_contacts = true where id = $1`, [piece, svcOk]);
      return (await q<{ id: string }>(`select audita.submit_comm_piece($1) id`, [piece]))[0].id;
    });
    await asUser(db, ADMIN, async () => {
      // exibe contatos, mas não há dados institucionais publicados
      expect((await err(db.query(`select audita.review_comm_piece($1, 'aprovar', null, $2)`, [v2, CHECK_OK])))?.message).toContain("Contatos oficiais");
      await db.query(`select audita.review_comm_piece($1, 'devolver', 'Sem contatos oficiais publicados.', '{}')`, [v2]);
      await db.query(`update audita.comm_pieces set show_contacts = false where id = $1`, [piece]);
      const v3 = (await q<{ id: string }>(`select audita.submit_comm_piece($1) id`, [piece]))[0].id;
      await db.query(`select audita.review_comm_piece($1, 'aprovar', 'Aprovada para LinkedIn.', $2)`, [v3, CHECK_OK]);
      expect((await q(`select status, current_version from audita.comm_pieces where id = $1`, [piece]))[0]).toEqual({ status: "aprovada", current_version: 3 });
      expect((await err(db.query(`update audita.comm_piece_versions set review_note = 'x' where id = $1`, [v3])))).not.toBeNull();
    });
  });

  it("exportação só de versão aprovada, registrada; reabrir mantém a aprovada; operador e anônimo sem acesso", async () => {
    const [{ id: piece }] = await q<{ id: string }>(`select id from audita.comm_pieces limit 1`);
    const versions = await q<{ id: string; version: number; status: string }>(
      `select id, version, status from audita.comm_piece_versions where piece_id = $1 order by version`,
      [piece],
    );
    expect(versions.map((v) => v.status)).toEqual(["devolvida", "devolvida", "aprovada"]);
    await asUser(db, MKT, async () => {
      expect((await err(db.query(`select audita.register_comm_export($1, 'png', $2, 100)`, [versions[0].id, SHA])))?.message).toContain("aprovadas");
      await db.query(`select audita.register_comm_export($1, 'png', $2, 100)`, [versions[2].id, SHA]);
      await db.query(`select audita.reopen_comm_piece($1, 'Ajustar a chamada')`, [piece]);
      // a versão aprovada continua exportável enquanto outra não for aprovada
      await db.query(`select audita.register_comm_export($1, 'pdf', $2, 200)`, [versions[2].id, SHA]);
      expect((await err(db.query(`select audita.cancel_comm_piece($1, 'Não usar mais')`, [piece])))?.code).toBe("42501");
    });
    expect(await q(`select format, exported_by from audita.comm_exports order by exported_at`)).toEqual([
      { format: "png", exported_by: MKT },
      { format: "pdf", exported_by: MKT },
    ]);
    expect((await err(db.query(`delete from audita.comm_exports`)))?.code).toBe("42501");
    await asUser(db, OPER, async () => {
      for (const t of ["comm_pieces", "comm_campaigns", "comm_piece_versions", "comm_exports", "brand_assets", "brand_asset_versions"])
        expect(await q(`select 1 from audita.${t}`), t).toHaveLength(0);
      expect(await err(db.query(`insert into audita.comm_campaigns (name) values ('[TESTE] operador')`))).not.toBeNull();
      expect((await err(db.query(`select audita.submit_comm_piece($1)`, [piece])))?.code).toBe("42501");
      expect((await err(db.query(`select audita.comm_service_options()`)))?.code).toBe("42501");
    });
    await asUser(db, ADMIN, async () => {
      await db.query(`select audita.cancel_comm_piece($1, 'Campanha encerrada')`, [piece]);
      expect((await q(`select status from audita.comm_pieces where id = $1`, [piece]))[0]).toEqual({ status: "cancelada" });
      const c = await q<{ campaign_code: string }>(`insert into audita.comm_campaigns (name, is_test) values ('[TESTE] Semana de SST', true) returning campaign_code`);
      expect(c[0].campaign_code).toMatch(/^CAM-\d{4}-\d{3}$/);
    });
    const audit = await q<{ n: number }>(`select count(*)::int n from audita.audit_log where entity in ('comm_pieces', 'comm_piece_versions', 'comm_exports', 'brand_asset_versions')`);
    expect(audit[0].n).toBeGreaterThan(10);
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

describe.skipIf(!ready)("I10 — permissões reais (banco de desenvolvimento)", () => {
  it("marketing cria e envia peça de TESTE; não aprova; operador, sem acesso e anônimo não acessam", async () => {
    const mkt = await signedIn(process.env.TEST_MARKETING_EMAIL!, process.env.TEST_MARKETING_PASSWORD!);
    const admin = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    const others = [
      await signedIn(process.env.TEST_OPERADOR_EMAIL!, process.env.TEST_OPERADOR_PASSWORD!),
      await signedIn(process.env.TEST_INTRUSO_EMAIL!, process.env.TEST_INTRUSO_PASSWORD!),
    ];
    const svc = await mkt.rpc("comm_service_options");
    expect(svc.error).toBeNull();
    expect(svc.data!.length).toBeGreaterThan(0);
    expect(Object.keys(svc.data![0]).sort()).toEqual(["commercial_status", "id", "name", "service_code"]);

    const p = await mkt
      .from("comm_pieces")
      .insert({ template: "post_quadrado", theme: "[TESTE] Permissões do I10", channel: "linkedin", title: "[TESTE] Peça de verificação", is_test: true })
      .select("id, piece_code, status")
      .single();
    expect(p.error).toBeNull();
    const sub = await mkt.rpc("submit_comm_piece", { p_piece_id: p.data!.id });
    expect(sub.error).toBeNull();
    const rev = await mkt.rpc("review_comm_piece", { p_version_id: sub.data, p_decision: "aprovar", p_note: null, p_checklist: {} });
    expect(rev.error?.code).toBe("42501");
    // o administrador devolve (sem aprovar: não deixa versão aprovada de teste) e cancela
    expect((await admin.rpc("review_comm_piece", { p_version_id: sub.data, p_decision: "devolver", p_note: "[TESTE] devolução automática", p_checklist: {} })).error).toBeNull();
    expect((await admin.rpc("cancel_comm_piece", { p_piece_id: p.data!.id, p_reason: "[TESTE] limpeza do teste" })).error).toBeNull();

    for (const c of others) {
      for (const t of ["comm_pieces", "comm_campaigns", "comm_piece_versions", "comm_exports", "brand_assets", "brand_asset_versions"]) {
        const r = await c.from(t).select("id").limit(1);
        expect(r.error, t).toBeNull();
        expect(r.data, t).toEqual([]);
      }
      expect((await c.rpc("comm_service_options")).error?.code).toBe("42501");
      expect((await c.from("comm_campaigns").insert({ name: "[TESTE] não deveria gravar", is_test: true })).error).not.toBeNull();
    }
    const anon = client();
    expect((await anon.from("comm_pieces").select("id")).error).not.toBeNull();
    expect((await anon.rpc("submit_comm_piece", { p_piece_id: p.data!.id })).error).not.toBeNull();
  });
});
