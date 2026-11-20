/**
 * P5 — Prospecção 2.0, Fase 1 (AUDDOC020 Rev.01: RP-06, RP-20, RP-22). PGlite com todas as migrações: público-alvo
 * por porte/capital/filiais, exclusões (natureza, distância, lead, "não contatar"), contato da contabilidade (repetido
 * em 5+ CNPJs ou marcado), grupos de chance de resposta e acesso por nível.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000005ad";
const OPER = "00000000-0000-4000-8000-0000000005a0";
const MKT = "00000000-0000-4000-8000-0000000005ac";

// CNPJs fictícios (formato válido para a tabela; não precisam ter dígito verificador correto aqui)
const C = (n: number) => `${String(n).padStart(8, "0")}000100`;

describe("P5 — carteira de oportunidades (PGlite)", () => {
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
  const row = async (cnpj: string) =>
    (await q<{ size_class: string; group_code: string; score: number; own_phone: boolean; reasons: string[] }>(
      `select size_class, group_code, score, own_phone, reasons from audita.prospect_portfolio where cnpj = $1`,
      [cnpj],
    ))[0];

  beforeAll(async () => {
    db = await migratedDb();
    const est = (cnpj: string, nat: string, porte: string, cnae: string, ibge: string, phone: string | null, email: string | null) =>
      `('${cnpj}', true, '[TESTE] Empresa ${cnpj}', '${nat}', '${porte}', '2015-01-01', '${cnae}', '${ibge}', ${phone ? `'${phone}'` : "null"}, ${email ? `'${email}'` : "null"}, '2026-10')`;
    await db.exec(`
      insert into auth.users (id, email) values ('${ADMIN}', 'a5@exemplo.test'), ('${OPER}', 'o5@exemplo.test'), ('${MKT}', 'm5@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values
        ('${ADMIN}', '[TESTE] Admin', 'admin'), ('${OPER}', '[TESTE] Operador', 'operador'), ('${MKT}', '[TESTE] Marketing', 'marketing');
      insert into audita.cnpj_publications (reference, source, rows_loaded, is_current) values ('2026-10', '[TESTE] Receita', 20, true);
      insert into audita.ibge_municipalities (ibge_code, name, rfb_code, lat, lon, km_from_base) values
        ('3552205', 'Sorocaba', '7145', -23.46, -47.44, 0), ('3500000', '[TESTE] Longe', '9999', -21, -50, 200);
      insert into audita.cnpj_establishments (cnpj, is_headquarters, legal_name, legal_nature, size_code, started_on, cnae_main, ibge_code, phone1, email, publication) values
        ${[
          est(C(1), "2054", "05", "4120400", "3552205", "1533331111", "contato@alfa.com.br"), // S.A. → grande, contato próprio
          est(C(2), "2062", "01", "4120400", "3552205", "1533332222", null), // ME capital baixo → fora
          est(C(3), "2062", "01", "4120400", "3552205", "1533333333", null), // ME capital 200 mil → entra
          est(C(4), "4120", "05", "4120400", "3552205", "1533334444", null), // produtor rural PF → fora
          est(C(5), "2062", "03", "4120400", "3500000", "1533335555", null), // 200 km → fora
          est(C(6), "2062", "03", "4120400", "3552205", "1533336666", null), // já é lead → fora
          est(C(7), "2062", "03", "4120400", "3552205", "1533337777", null), // não contatar → fora
          est(C(8), "2062", "03", "6201501", "3552205", "1533338888", null), // fora dos nichos → fora
          ...[10, 11, 12, 13, 14].map((n) => est(C(n), "2062", "03", "4120400", "3552205", "1530000000", "escritorio@contabil.com.br")), // contabilidade
        ].join(",\n")};
      insert into audita.cnpj_companies (cnpj_base, capital_social, establishments, publication) values
        ('00000001', 50000, 1, '2026-10'), ('00000002', 50000, 1, '2026-10'), ('00000003', 200000, 1, '2026-10');
      insert into audita.leads (cnpj, legal_name, is_test) values ('${C(6)}', '[TESTE] Já lead', true);
      insert into audita.contact_suppressions (cnpj, reason) values ('${C(7)}', '[TESTE] pediu para não ser contatado');
    `);
  }, 120000);
  afterAll(async () => db?.close());

  it("público-alvo e exclusões", async () => {
    // Em recuperação judicial: entra, mas rebaixada e com o aviso
    await db.query(`insert into audita.cnpj_establishments (cnpj, is_headquarters, legal_name, legal_nature, size_code, started_on, cnae_main, ibge_code, phone1, email, publication) values ($1, true, '[TESTE] DELTA S/A EM RECUPERACAO JUDICIAL', '2054', '05', '2015-01-01', '4120400', '3552205', '1533339999', 'rj@delta.com.br', '2026-10')`, [C(15)]);
    expect(await q(`select audita.refresh_prospect_portfolio() as n`)).toEqual([{ n: 8 }]);
    const rj = await row(C(15));
    expect(rj.score).toBe(60);
    expect(rj.group_code).toBe("frio");
    expect(rj.reasons).toContain("Atenção: em recuperação judicial, falência ou liquidação");
    const a = await row(C(1));
    expect(a).toMatchObject({ size_class: "grande", group_code: "quente", own_phone: true });
    expect(a.reasons).toEqual(expect.arrayContaining(["Grande empresa", "Telefone próprio", "E-mail com domínio próprio", "Nicho de entrada"]));
    expect((await row(C(3))).size_class).toBe("me");
    for (const out of [2, 4, 5, 6, 7, 8]) expect(await row(C(out)), `CNPJ ${out} deveria estar fora`).toBeUndefined();
  });

  it("contato repetido em 5+ CNPJs é da contabilidade: grupo 'precisa de contato'", async () => {
    const c = await row(C(10));
    expect(c).toMatchObject({ group_code: "precisa_contato", own_phone: false });
    expect(c.reasons).toEqual(expect.arrayContaining(["Telefone provável da contabilidade", "E-mail provável da contabilidade"]));
  });

  it("marcar 'é da contabilidade' rebaixa a empresa no recálculo (RP-22) e o acesso é por nível", async () => {
    await asUser(db, OPER, async () => {
      expect(await q(`select count(*)::int as n from audita.prospect_portfolio`)).toEqual([{ n: 8 }]);
      await db.query(`insert into audita.prospect_contact_marks (kind, value, is_test) values ('phone', '1533331111', true)`);
      expect(await err(db.query(`insert into audita.prospect_portfolio (cnpj, niche_id, size_class, group_code, score, own_phone, own_email) select '${C(99)}', id, 'me', 'frio', 1, false, false from audita.prospect_niches limit 1`))).not.toBeNull();
      await db.query(`select audita.refresh_prospect_portfolio()`);
    });
    const a = await row(C(1));
    expect(a.own_phone).toBe(false);
    expect(a.reasons).toContain("Telefone provável da contabilidade");
    expect(a.group_code).not.toBe("precisa_contato"); // ainda tem e-mail próprio
    await asUser(db, MKT, async () => {
      expect(await q(`select count(*)::int as n from audita.prospect_portfolio`)).toEqual([{ n: 0 }]);
      expect((await err(db.query(`select audita.refresh_prospect_portfolio()`)))?.code).toBe("42501");
      expect(await err(db.query(`insert into audita.prospect_contact_marks (kind, value) values ('phone', '1599999999')`))).not.toBeNull();
      expect((await err(db.query(`select * from audita.prospect_opportunities()`)))?.code).toBe("42501");
    });
  });

  it("leitura aplica as mudanças do dia: lead novo some e a marcação rebaixa na hora", async () => {
    let before: { cnpj: string }[] = [];
    await asUser(db, OPER, async () => {
      before = await q<{ cnpj: string }>(`select cnpj from audita.prospect_opportunities()`);
      expect(before.map((r) => r.cnpj)).toContain(C(3));
    });
    // Vira lead hoje: some sem esperar o recálculo noturno
    await db.query(`insert into audita.leads (cnpj, legal_name, is_test) values ($1, '[TESTE] ME com estrutura', true)`, [C(11)]);
    await asUser(db, OPER, async () => {
      expect((await q<{ cnpj: string }>(`select cnpj from audita.prospect_opportunities()`)).map((r) => r.cnpj)).not.toContain(C(11));
      // Marca o telefone da ME (sem e-mail): vai para "precisa de contato" na hora
      await db.query(`insert into audita.prospect_contact_marks (kind, value, is_test) values ('phone', '1533333333', true)`);
      const me = (await q<{ group_code: string; own_phone: boolean }>(`select group_code, own_phone from audita.prospect_opportunities() where cnpj = $1`, [C(3)]))[0];
      expect(me).toEqual({ group_code: "precisa_contato", own_phone: false });
      const counts = Object.fromEntries((await q<{ group_code: string; n: number }>(`select group_code, n::int from audita.prospect_opportunity_counts()`)).map((r) => [r.group_code, r.n]));
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      expect(total).toBe(before.length - 1);
      expect((await q<{ n: number }>(`select count(*)::int as n from audita.prospect_opportunities('precisa_contato')`))[0].n).toBe(counts.precisa_contato);
      expect((await err(db.query(`select * from audita.prospect_opportunities('xyz')`)))?.code).toBe("22023");
    });
  });
});
