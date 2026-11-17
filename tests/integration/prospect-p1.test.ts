/**
 * P1 — AUDITA PROSPECT (AUDDOC020 Rev.00). PGlite com todas as migrações: carga inicial de nichos e palavras-chave,
 * base de CNPJ só leitura e sem MEI, funil com histórico de etapas, atividades imutáveis que avançam a etapa,
 * "não contatar" que bloqueia contato e entrada no funil, conversão em cliente e acesso por nível.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000003ad";
const OPER = "00000000-0000-4000-8000-0000000003a0";
const MKT = "00000000-0000-4000-8000-0000000003ac";
const INTRUSO = "00000000-0000-4000-8000-0000000003ff";
const CNPJ_A = "11222333000181";
const CNPJ_B = "11444777000161";
const CNPJ_C = "45997418000153";

describe("P1 — AUDITA PROSPECT (PGlite)", () => {
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
    await db.exec(`
      insert into auth.users (id, email) values ('${ADMIN}', 'a3@exemplo.test'), ('${OPER}', 'o3@exemplo.test'), ('${MKT}', 'm3@exemplo.test'), ('${INTRUSO}', 'x3@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values
        ('${ADMIN}', '[TESTE] Admin', 'admin'), ('${OPER}', '[TESTE] Operador', 'operador'), ('${MKT}', '[TESTE] Marketing', 'marketing');
      insert into audita.cnpj_publications (reference, source, rows_loaded, is_current) values ('2026-10', '[TESTE] Receita Federal — dados abertos', 2, true);
      insert into audita.ibge_municipalities (ibge_code, name, rfb_code, lat, lon, km_from_base) values ('3552205', 'Sorocaba', '7145', -23.4635, -47.4471, 0);
      insert into audita.cnpj_establishments (cnpj, is_headquarters, legal_name, legal_nature, size_code, started_on, cnae_main, ibge_code, phone1, publication)
        values ('${CNPJ_A}', true, '[TESTE] Construtora Alfa Ltda', '2062', '03', '2022-03-01', '4120400', '3552205', '1533334444', '2026-10');
    `);
  }, 120000);
  afterAll(async () => db?.close());

  it("carrega os nichos e as palavras-chave aprovados", async () => {
    const n = await q<{ code: string; is_entry: boolean }>(`select code, is_entry from audita.prospect_niches order by sort_order`);
    expect(n.map((x) => x.code)).toEqual(["construcao", "atacado_logistica", "industria", "oficinas", "combustiveis", "residuos"]);
    expect(n.filter((x) => x.is_entry)).toHaveLength(3);
    const k = await q<{ name: string; n: number }>(`select g.name, count(*)::int as n from audita.prospect_keywords k join audita.prospect_keyword_groups g on g.id = k.group_id group by g.name order by g.name`);
    expect(k).toEqual([{ name: "SGI", n: 8 }, { name: "SSMA", n: 9 }, { name: "Segmentos", n: 8 }]);
  });

  it("base de CNPJ: só leitura, sem MEI, visível para administrador e operador", async () => {
    expect(await err(db.query(`insert into audita.cnpj_establishments (cnpj, is_headquarters, legal_name, legal_nature, size_code, cnae_main, ibge_code, publication) values ('${CNPJ_B}', true, '[TESTE] MEI', '2135', '01', '4120400', '3552205', '2026-10')`))).not.toBeNull();
    await asUser(db, OPER, async () => {
      expect(await q(`select cnpj from audita.cnpj_establishments`)).toHaveLength(1);
      expect(await err(db.query(`insert into audita.cnpj_establishments (cnpj, is_headquarters, legal_name, legal_nature, size_code, cnae_main, ibge_code, publication) values ('${CNPJ_C}', true, '[TESTE] X', '2062', '01', '4120400', '3552205', '2026-10')`))).not.toBeNull();
    });
    for (const who of [MKT, INTRUSO]) {
      await asUser(db, who, async () => {
        expect(await q(`select cnpj from audita.cnpj_establishments`)).toHaveLength(0);
        expect(await q(`select id from audita.leads`)).toHaveLength(0);
        expect(await err(db.query(`insert into audita.leads (legal_name, is_test) values ('[TESTE] Y', true)`))).not.toBeNull();
      });
    }
  });

  it("funil: histórico de etapas, contato avança a etapa, atividades imutáveis", async () => {
    await asUser(db, OPER, async () => {
      const lead = (await q<{ id: string; owner_id: string; stage: string }>(`insert into audita.leads (cnpj, legal_name, cnae_main, size_code, ibge_code, stage, score, score_band, source_publication, is_test) values ($1, '[TESTE] Construtora Alfa Ltda', '4120400', '03', '3552205', 'qualificado', 86, 'prioritario', '2026-10', true) returning id, owner_id, stage`, [CNPJ_A]))[0];
      expect(lead.owner_id).toBe(OPER);
      // Mesma empresa não entra duas vezes
      expect((await err(db.query(`insert into audita.leads (cnpj, legal_name, is_test) values ($1, '[TESTE] Duplicada', true)`, [CNPJ_A])))?.code).toBe("23505");
      await db.query(`insert into audita.lead_activities (lead_id, kind, outcome, note, template_code) values ($1, 'whatsapp', 'enviado', '[TESTE] mensagem do modelo', 'construcao_diagnostico')`, [lead.id]);
      let l = (await q<{ stage: string; last_activity_at: string | null }>(`select stage, last_activity_at from audita.leads where id = $1`, [lead.id]))[0];
      expect(l.stage).toBe("primeiro_contato");
      expect(l.last_activity_at).not.toBeNull();
      await db.query(`insert into audita.lead_activities (lead_id, kind, outcome) values ($1, 'ligacao', 'reuniao_marcada')`, [lead.id]);
      l = (await q<{ stage: string; last_activity_at: string | null }>(`select stage, last_activity_at from audita.leads where id = $1`, [lead.id]))[0];
      expect(l.stage).toBe("reuniao");
      const hist = await q<{ from_stage: string | null; to_stage: string }>(`select from_stage, to_stage from audita.lead_stage_history where lead_id = $1 order by changed_at, to_stage`, [lead.id]);
      expect(hist.map((h) => h.to_stage)).toEqual(expect.arrayContaining(["qualificado", "primeiro_contato", "reuniao"]));
      // Atividades e histórico imutáveis; CNPJ permanente
      expect(await err(db.query(`update audita.lead_activities set note = 'x' where lead_id = $1`, [lead.id]))).not.toBeNull();
      expect(await err(db.query(`update audita.leads set cnpj = $2 where id = $1`, [lead.id, CNPJ_B]))).not.toBeNull();
      // Contato não aceita data futura; perdido exige motivo
      expect(await err(db.query(`insert into audita.lead_activities (lead_id, kind, outcome, occurred_at) values ($1, 'email', 'enviado', now() + interval '2 days')`, [lead.id]))).not.toBeNull();
      expect((await err(db.query(`update audita.leads set stage = 'perdido' where id = $1`, [lead.id])))?.code).toBe("23514");
    });
    expect(await err(db.query(`update audita.lead_stage_history set reason = 'x'`))).not.toBeNull();
  });

  it("\"não contatar\": pedido registrado no contato bloqueia novos contatos e tira a empresa do funil", async () => {
    await asUser(db, OPER, async () => {
      const lead = (await q<{ id: string }>(`insert into audita.leads (cnpj, legal_name, stage, is_test) values ($1, '[TESTE] Metalúrgica Beta', 'qualificado', true) returning id`, [CNPJ_B]))[0];
      await db.query(`insert into audita.lead_activities (lead_id, kind, outcome) values ($1, 'whatsapp', 'nao_contatar')`, [lead.id]);
      const l = (await q<{ stage: string; lost_reason: string }>(`select stage, lost_reason from audita.leads where id = $1`, [lead.id]))[0];
      expect(l.stage).toBe("perdido");
      expect(l.lost_reason).toMatch(/^Não contatar: /);
      expect((await q(`select id from audita.contact_suppressions where cnpj = $1`, [CNPJ_B]))).toHaveLength(1);
      expect((await err(db.query(`insert into audita.lead_activities (lead_id, kind, outcome) values ($1, 'ligacao', 'nao_atendeu')`, [lead.id])))?.code).toBe("23514");
      // Anotação interna continua permitida
      await db.query(`insert into audita.lead_activities (lead_id, kind, note) values ($1, 'anotacao', '[TESTE] registro interno')`, [lead.id]);
      // Empresa na lista não entra no funil
      await db.query(`insert into audita.contact_suppressions (cnpj, reason, is_test) values ($1, '[TESTE] pedido por e-mail', true)`, [CNPJ_C]);
      expect((await err(db.query(`insert into audita.leads (cnpj, legal_name, is_test) values ($1, '[TESTE] Gama', true)`, [CNPJ_C])))?.code).toBe("23514");
      // A lista é imutável
      expect(await err(db.query(`delete from audita.contact_suppressions where cnpj = $1`, [CNPJ_C]))).not.toBeNull();
      expect(await err(db.query(`update audita.contact_suppressions set reason = 'x' where cnpj = $1`, [CNPJ_C]))).not.toBeNull();
    });
  });

  it("conversão: etapa cliente exige o cliente e depois não muda", async () => {
    const client = (await q<{ id: string }>(`insert into audita.clients (client_code, legal_name, is_test) values ('CLI-TESTE-P1', '[TESTE] Construtora Alfa Ltda', true) returning id`))[0].id;
    await asUser(db, ADMIN, async () => {
      const id = (await q<{ id: string }>(`select id from audita.leads where cnpj = $1`, [CNPJ_A]))[0].id;
      expect((await err(db.query(`update audita.leads set stage = 'cliente' where id = $1`, [id])))?.code).toBe("23514");
      await db.query(`update audita.leads set stage = 'cliente', client_id = $2 where id = $1`, [id, client]);
      expect((await err(db.query(`update audita.leads set stage = 'negociacao' where id = $1`, [id])))?.code).toBe("42501");
    });
  });

  it("conversão (P4, RP-12): proposta emitida leva o lead a \"Proposta enviada\" e aceita a \"Cliente conquistado\"", async () => {
    const CNPJ_D = "60701190000104";
    const client = (await q<{ id: string }>(`insert into audita.clients (client_code, legal_name, tax_id, is_test) values ('CLI-TESTE-P4', '[TESTE] Distribuidora Delta Ltda', $1, true) returning id`, [CNPJ_D]))[0].id;
    let lead = "";
    let lost = "";
    await asUser(db, OPER, async () => {
      lead = (await q<{ id: string }>(`insert into audita.leads (cnpj, legal_name, stage, is_test) values ($1, '[TESTE] Distribuidora Delta Ltda', 'negociacao', true) returning id`, [CNPJ_D]))[0].id;
      // Vínculo ao cliente (feito pela tela) não muda a etapa
      await db.query(`update audita.leads set client_id = $2 where id = $1`, [lead, client]);
      lost = (await q<{ id: string }>(`insert into audita.leads (legal_name, stage, lost_reason, client_id, is_test) values ('[TESTE] Delta filial perdida', 'perdido', '[TESTE] sem interesse', $1, true) returning id`, [client]))[0].id;
    });
    const stage = async (id: string) => (await q<{ stage: string }>(`select stage from audita.leads where id = $1`, [id]))[0].stage;
    expect(await stage(lead)).toBe("negociacao");
    await db.exec(`set session_replication_role = replica`);
    await db.query(`insert into audita.demands (id, demand_code, client_id, summary, status, is_test) values ('00000000-0000-4000-8000-0000000004d1', 'DEM-2026-9401', $1, '[TESTE] PGR', 'em_analise', true)`, [client]);
    await db.query(`insert into audita.quotes (id, quote_code, demand_id, client_id, status, is_test) values ('00000000-0000-4000-8000-0000000004e1', 'PROP-2026-9401', '00000000-0000-4000-8000-0000000004d1', $1, 'revisada', true)`, [client]);
    await db.exec(`set session_replication_role = origin`);
    // O gatilho é só o da etapa; as regras de emissão (funções SECURITY DEFINER) não entram neste teste
    await db.exec(`alter table audita.quotes disable trigger user; alter table audita.quotes enable trigger leads_follow_quote;`);
    await db.query(`update audita.quotes set status = 'emitida' where id = '00000000-0000-4000-8000-0000000004e1'`);
    expect(await stage(lead)).toBe("proposta");
    expect(await stage(lost)).toBe("perdido");
    const hist = await q<{ to_stage: string }>(`select to_stage from audita.lead_stage_history where lead_id = $1 order by changed_at desc, id desc limit 1`, [lead]);
    expect(hist[0].to_stage).toBe("proposta");
    await db.query(`update audita.quotes set status = 'aceita' where id = '00000000-0000-4000-8000-0000000004e1'`);
    expect(await stage(lead)).toBe("cliente");
    expect(await stage(lost)).toBe("cliente");
    await db.exec(`alter table audita.quotes enable trigger user;`);
    // A função não fica exposta à API
    await asUser(db, ADMIN, async () => {
      expect(await err(db.query(`select audita.leads_follow_quote()`))).not.toBeNull();
    });
  });

  it("regiões: contagem por município e nicho (prefixos de 2 e 4 dígitos) e sem acesso para quem não prospecta", async () => {
    await db.exec(`
      insert into audita.ibge_municipalities (ibge_code, name, rfb_code, km_from_base) values ('3552403', 'Sumaré', '7149', 120), ('3509502', 'Campinas', '6291', 77);
      insert into audita.cnpj_establishments (cnpj, is_headquarters, legal_name, legal_nature, size_code, cnae_main, ibge_code, publication) values
        ('22333444000181', true, '[TESTE] Atacado', '2062', '01', '4691500', '3552205', '2026-10'),
        ('33444555000181', true, '[TESTE] Oficina', '2062', '01', '4520001', '3552205', '2026-10'),
        ('44555666000181', true, '[TESTE] Software', '2062', '01', '6201501', '3552205', '2026-10'),
        ('55666777000181', true, '[TESTE] Obra longe', '2062', '03', '4120400', '3552403', '2026-10');
    `);
    await asUser(db, OPER, async () => {
      const rows = await q<{ name: string; code: string | null; niche_count: number; all_count: number }>(`
        select r.name, n.code, r.niche_count::int, r.all_count::int
        from audita.prospect_region_counts(100) r left join audita.prospect_niches n on n.id = r.niche_id order by r.name, n.code`);
      // Sumaré (120 km) fica fora do raio de 100 km; Campinas não tem empresa e não aparece
      expect(rows.map((r) => r.name)).toEqual(["Sorocaba", "Sorocaba", "Sorocaba"]);
      expect(rows.map((r) => `${r.code}:${r.niche_count}`)).toEqual(["atacado_logistica:1", "construcao:1", "oficinas:1"]);
      expect(rows.every((r) => r.all_count === 4)).toBe(true);
      expect((await q(`select 1 from audita.prospect_region_counts(0) where name = 'Sumaré'`))).toHaveLength(1);
    });
    // Resumo pronto: recalculado por quem prospecta; marketing não vê nem recalcula
    await asUser(db, OPER, async () => {
      const n = (await q<{ n: number }>(`select audita.refresh_prospect_region_stats() as n`))[0].n;
      expect(n).toBeGreaterThan(0);
      expect((await q<{ c: number }>(`select sum(niche_count)::int as c from audita.prospect_region_stats where ibge_code = '3552205'`))[0].c).toBe(3);
      expect(await err(db.query(`delete from audita.prospect_region_stats`))).not.toBeNull();
    });
    await asUser(db, MKT, async () => {
      expect(await q(`select 1 from audita.prospect_region_counts(0)`)).toHaveLength(0);
      expect(await q(`select 1 from audita.prospect_region_stats`)).toHaveLength(0);
      expect(await err(db.query(`select audita.refresh_prospect_region_stats()`))).not.toBeNull();
    });
  });

  it("pesquisa (P3): filtros de CNAE, região, porte, telefone, abertura e nome, com total; RLS e entradas validadas", async () => {
    type R = { cnpj: string; total: string };
    const s = (args: string) => q<R>(`select cnpj, total::text from audita.prospect_search(${args})`);
    await asUser(db, OPER, async () => {
      expect(await s(`array['41'], 50`)).toEqual([{ cnpj: CNPJ_A, total: "1" }]);
      expect(await s(`array['4120'], 0`)).toHaveLength(2); // Estado inteiro: inclui a obra de Sumaré (120 km)
      expect((await s(`array['4120'], 150`))[0].total).toBe("2");
      expect(await s(`array['4120'], 100`)).toHaveLength(1);
      expect(await s(`array['41'], 50, '3552205', array['03'], true, '2022-01-01', 'alfa'`)).toHaveLength(1);
      expect(await s(`array['62'], 50`)).toHaveLength(1); // outro nicho (software)
      expect(await s(`array['47'], 50`)).toHaveLength(0);
      expect(await s(`array['41', '4120', '41'], 0`)).toHaveLength(2); // prefixos sobrepostos não duplicam
      expect(await s(`array['41'], 50, null, array['01']`)).toHaveLength(0); // outro porte
      expect(await s(`array['41'], 50, null, null, false, '2023-01-01'`)).toHaveLength(0); // aberta antes
      expect(await s(`array['41'], 50, null, null, false, null, 'beta'`)).toHaveLength(0); // outro nome
      expect(await err(db.query(`select * from audita.prospect_search(array['41'' or true or ''x'])`))).not.toBeNull();
      expect(await err(db.query(`select * from audita.prospect_search(array['41'], 50, '1; drop')`))).not.toBeNull();
    });
    await asUser(db, MKT, async () => {
      expect((await err(db.query(`select * from audita.prospect_search(array['41'], 0)`)))?.code).toBe("42501"); // quem não prospecta não pesquisa
    });
  });

  it("nichos e pesquisas: autor permanente, data de alteração e histórico só de inclusão", async () => {
    await asUser(db, OPER, async () => {
      const before = (await q<{ updated_at: string }>(`select updated_at from audita.prospect_niches where code = 'oficinas'`))[0].updated_at;
      await db.query(`update audita.prospect_niches set notes = '[TESTE] ajuste' where code = 'oficinas'`);
      const after = (await q<{ updated_at: string }>(`select updated_at from audita.prospect_niches where code = 'oficinas'`))[0].updated_at;
      expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
      expect(await err(db.query(`update audita.prospect_niches set created_by = $1 where code = 'oficinas'`, [ADMIN]))).not.toBeNull();
      const s = (await q<{ id: string; created_by: string }>(`insert into audita.prospect_searches (name, filters) values ('[TESTE] Construção até 50 km', '{"niche":"construcao","maxKm":50}') returning id, created_by`))[0];
      expect(s.created_by).toBe(OPER);
      await db.query(`insert into audita.prospect_search_runs (search_id, filters, result_count, publication) values ($1, '{"niche":"construcao"}', 9449, '2026-10')`, [s.id]);
      expect(await err(db.query(`update audita.prospect_search_runs set result_count = 1`))).not.toBeNull();
    });
  });
});
