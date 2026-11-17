/**
 * Audita Academy, etapas 5 a 7 (migração a5): Meu Perfil só pela função do próprio aluno; histórico com notas e
 * tentativas; pedidos do próprio aluno; avisos automáticos (curso liberado, módulo, avaliação, certificado, pagamento),
 * aviso de prazo calculado na leitura, comunicados da gestão por curso ou para todos e marcação de lidos.
 * PGlite com todas as migrações. Dados fictícios de teste.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000075a1";
const ALUNO = "00000000-0000-4000-8000-0000000075b1";
const OUTRO = "00000000-0000-4000-8000-0000000075b2";
const SHA = "d".repeat(64);
const CPF_OK = "52998224725";

type Aviso = { id: string | null; kind: string; title: string; body: string | null; link: string | null; is_read: boolean | null };

describe("Academy a5 — perfil, histórico, financeiro e avisos (PGlite)", () => {
  let db: PGlite;
  let course = "";
  let course2 = "";
  let mods: { id: string; position: number }[] = [];
  let enr = "";
  let student = "";
  let other = "";
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
  const aluno = <T>(fn: () => Promise<T>) => asUser(db, ALUNO, fn);
  const outro = <T>(fn: () => Promise<T>) => asUser(db, OUTRO, fn);
  const avisos = () => q<Aviso>(`select * from audita.training_my_notifications(50)`);
  const naoLidos = async () => (await one<{ n: number }>(`select audita.training_unread_notifications() n`)).n;

  async function criarCurso(code: string, comProva: boolean) {
    const id = (await one<{ id: string }>(`select audita.training_create_course($1, '[TESTE] Curso fictício', '1.0') id`, [code])).id;
    const version = (await one<{ id: string }>(`select id from audita.training_versions where course_id = $1`, [id])).id;
    await q(`update audita.training_versions set workload_minutes = 60 where id = $1`, [version]);
    await q(`select audita.training_add_module($1, '[TESTE] Módulo com prova')`, [version]);
    const ms = await q<{ id: string; position: number }>(`select id, position from audita.training_modules where version_id = $1 order by position`, [version]);
    for (const m of ms) {
      const path = `training/${id}/apostila-${m.position}.pdf`;
      await db.exec(`reset role; insert into storage.objects (bucket_id, name) values ('audita-treinamentos', '${path}'); set role authenticated;`);
      await q(
        `insert into audita.training_files (version_id, module_id, kind, storage_path, original_name, mime_type, size_bytes, sha256)
         values ($1, $2, 'apostila', $3, 'apostila.pdf', 'application/pdf', 100, $4)`,
        [version, m.id, path, SHA],
      );
    }
    if (comProva) {
      const item = { code: "M02-Q01", kind: "objetiva", statement: "[TESTE] Pergunta?", options: ["A", "B"].map((k) => ({ key: k, text: k })), correct_key: "A", feedback: "Retorno." };
      await q(`select audita.training_import_questions($1, $2)`, [ms[1].id, JSON.stringify([item])]);
      await q(`update audita.training_assessments set pass_score = 1 where module_id = $1`, [ms[1].id]);
    }
    await q(`select audita.training_publish_version($1)`, [version]);
    return { id, mods: ms };
  }

  beforeAll(async () => {
    db = await migratedDb();
    await db.exec(`grant usage on schema storage, extensions to authenticated; grant select on storage.objects to authenticated;`);
    await db.exec(`
      insert into auth.users (id, email) values ('${ADMIN}', 'admin@exemplo.test'), ('${ALUNO}', 'aluno@exemplo.test'), ('${OUTRO}', 'outro@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values ('${ADMIN}', '[TESTE] Admin', 'admin');
    `);
    await admin(async () => {
      const c1 = await criarCurso("T501", true);
      course = c1.id;
      mods = c1.mods;
      course2 = (await criarCurso("T502", false)).id;
      for (const [uid, name, email] of [
        [ALUNO, "[TESTE] Aluna Fictícia", "aluno@exemplo.test"],
        [OUTRO, "[TESTE] Outro Aluno", "outro@exemplo.test"],
      ])
        await q(`insert into audita.training_students (user_id, full_name, email, source, is_test) values ($1, $2, $3, 'gestao', true)`, [uid, name, email]);
      student = (await one<{ id: string }>(`select id from audita.training_students where email = 'aluno@exemplo.test'`)).id;
      other = (await one<{ id: string }>(`select id from audita.training_students where email = 'outro@exemplo.test'`)).id;
      enr = (await one<{ id: string }>(`select audita.training_enroll($1, $2, null, 'gestao') id`, [student, course])).id;
      await q(`select audita.training_enroll($1, $2, null, 'gestao')`, [other, course2]);
    });
  }, 120000);
  afterAll(async () => db?.close());

  it("matrícula gera o aviso de curso liberado só para o próprio aluno", async () => {
    await aluno(async () => {
      const a = await avisos();
      expect(a.map((x) => [x.kind, x.link, x.is_read])).toEqual([["liberado", `/curso/${enr}`, false]]);
      expect(a[0].title).toContain("Curso liberado");
      expect(await naoLidos()).toBe(1);
      // Nada direto nas tabelas
      expect(await q(`select * from audita.training_notifications`)).toHaveLength(0);
      expect((await err(q(`insert into audita.training_notifications (kind, title) values ('comunicado', 'x')`)))?.code).toBe("42501");
    });
    await outro(async () => {
      expect((await avisos()).map((x) => x.kind)).toEqual(["liberado"]);
      expect((await avisos())[0].link).not.toBe(`/curso/${enr}`);
    });
  });

  it("módulo, avaliação e certificado geram avisos uma vez; histórico traz nota e tentativas", async () => {
    await aluno(async () => {
      await q(`select audita.training_complete_step($1, $2, 'apostila')`, [enr, mods[0].id]);
      await q(`select audita.training_complete_step($1, $2, 'apostila')`, [enr, mods[1].id]);
      const t = (await one<{ id: string }>(`select audita.training_attempt_start($1, $2) id`, [enr, mods[1].id])).id;
      const v = (await one<{ v: { questions: { id: string }[] } }>(`select audita.training_attempt_view($1) v`, [t])).v;
      await q(`select audita.training_attempt_save($1, $2, 'A', null)`, [t, v.questions[0].id]);
      await q(`select audita.training_attempt_submit($1)`, [t]);
      const a = await avisos();
      expect(a.map((x) => x.kind).sort()).toEqual(["avaliacao", "certificado", "liberado", "modulo", "modulo"]);
      expect(a.find((x) => x.kind === "avaliacao")?.title).toBe("Avaliação do módulo 02: 1 de 1");
      expect(a.find((x) => x.kind === "certificado")?.link).toBe(`/curso/${enr}/certificado`);
      expect(a.filter((x) => x.kind === "modulo").map((x) => x.title).sort()).toEqual(["Módulo 01 concluído", "Módulo 02 concluído"]);
      const h = await q<{ position: number; completed: boolean; attempts: number; best_score: number; max_score: number; passed: boolean; has_assessment: boolean }>(
        `select * from audita.training_my_history($1)`,
        [enr],
      );
      expect(h.map((x) => [x.position, x.completed, x.has_assessment, x.attempts, x.best_score, x.max_score, x.passed])).toEqual([
        [1, true, false, 0, null, null, null],
        [2, true, true, 1, 1, 1, true],
      ]);
    });
    await outro(async () => {
      expect((await err(q(`select * from audita.training_my_history($1)`, [enr])))?.code).toBe("P0002");
    });
  });

  it("histórico continua com o prazo de acesso encerrado", async () => {
    // Só no banco descartável: datas antigas gravadas sem os gatilhos (o início da matrícula é permanente)
    await db.exec(`reset role; set session_replication_role = replica;`);
    await db.query(`update audita.training_enrollments set starts_on = current_date - 5, access_until = current_date - 1 where id = $1`, [enr]);
    await db.exec(`set session_replication_role = origin;`);
    await aluno(async () => {
      expect(await q(`select * from audita.training_my_history($1)`, [enr])).toHaveLength(2);
      expect((await err(q(`select * from audita.training_outline($1)`, [enr])))?.code).toBe("42501");
    });
    await admin(() => q(`update audita.training_enrollments set access_until = null where id = $1`, [enr]));
  });

  it("perfil: o próprio aluno altera dados e endereço; e-mail permanente; CPF validado", async () => {
    await aluno(async () => {
      const call = (cpf: string | null, nome = "  [TESTE]   Aluna   Fictícia da Silva ") =>
        q(`select audita.training_update_my_profile($1, $2, '1990-05-10', '(15) 99999-0000', null, ' Técnica ', '18079-026', 'Rua de Teste', '10', '', 'Centro', 'Sorocaba', 'sp', false)`, [nome, cpf]);
      expect((await err(call("12345678900")))?.message).toContain("CPF inválido");
      expect((await err(call(null, "ab")))?.message).toContain("nome completo");
      await call("529.982.247-25");
      const s = await one(`select full_name, email, cpf, phone, job_title, address_cep, address_complement, address_state, email_notices from audita.training_students where user_id = $1`, [ALUNO]);
      expect(s).toEqual({
        full_name: "[TESTE] Aluna Fictícia da Silva",
        email: "aluno@exemplo.test",
        cpf: CPF_OK,
        phone: "15999990000",
        job_title: "Técnica",
        address_cep: "18079026",
        address_complement: null,
        address_state: "SP",
        email_notices: false,
      });
      expect((await err(q(`update audita.training_students set address_city = 'X' where user_id = $1`, [ALUNO])))).toBeNull();
      expect((await one<{ c: string | null }>(`select address_city c from audita.training_students where user_id = $1`, [ALUNO])).c).toBe("Sorocaba");
    });
    await admin(async () => {
      expect((await err(q(`select audita.training_update_my_profile('[TESTE] Admin', null, null, null, null, null, null, null, null, null, null, null, null, true)`)))?.code).toBe("42501");
    });
  });

  it("comunicados: só administrador envia; curso específico só para quem tem matrícula nele", async () => {
    await aluno(async () => {
      expect((await err(q(`select audita.training_send_notice('Teste', null, null, null)`)))?.code).toBe("42501");
    });
    await admin(async () => {
      await q(`select audita.training_send_notice('[TESTE] Novidade para todos', 'Texto do comunicado.', '/cursos', null)`);
      await q(`select audita.training_send_notice('[TESTE] Só do curso T501', null, null, $1)`, [course]);
      expect((await err(q(`select audita.training_send_notice('[TESTE] Link externo', null, 'https://exemplo.test', null)`)))?.code).toBe("23514");
    });
    await aluno(async () => {
      const titulos = (await avisos()).filter((x) => x.kind === "comunicado").map((x) => x.title).sort();
      expect(titulos).toEqual(["[TESTE] Novidade para todos", "[TESTE] Só do curso T501"]);
    });
    await outro(async () => {
      expect((await avisos()).filter((x) => x.kind === "comunicado").map((x) => x.title)).toEqual(["[TESTE] Novidade para todos"]);
    });
  });

  it("marcar como lido: um, todos e nunca o aviso de outro aluno", async () => {
    let alheio = "";
    await outro(async () => {
      alheio = (await avisos()).find((x) => x.kind === "liberado")!.id!;
    });
    await aluno(async () => {
      const antes = await naoLidos();
      expect(antes).toBe(7);
      const um = (await avisos()).find((x) => x.kind === "certificado")!.id!;
      expect((await one<{ n: number }>(`select audita.training_mark_notifications_read($1) n`, [[um]])).n).toBe(1);
      expect(await naoLidos()).toBe(6);
      expect((await one<{ n: number }>(`select audita.training_mark_notifications_read($1) n`, [[alheio]])).n).toBe(0);
      await q(`select audita.training_mark_notifications_read(null)`);
      expect(await naoLidos()).toBe(0);
    });
    await outro(async () => expect(await naoLidos()).toBe(2));
  });

  it("aviso de prazo é calculado na leitura (matrícula em andamento) e não conta como não lido", async () => {
    const enrOutro = (await one<{ id: string }>(`select id from audita.training_enrollments where student_id = $1`, [other])).id;
    await admin(() => q(`update audita.training_enrollments set access_until = (now() at time zone 'America/Sao_Paulo')::date + 10 where id = $1`, [enrOutro]));
    await outro(async () => {
      const p = (await avisos()).filter((x) => x.kind === "prazo");
      expect(p).toHaveLength(1);
      expect(p[0]).toMatchObject({ id: null, is_read: null, title: "Seu acesso ao curso termina em 10 dias", link: `/curso/${enrOutro}` });
      expect(await naoLidos()).toBe(2);
    });
    await admin(() => q(`update audita.training_enrollments set access_until = null where id = $1`, [enrOutro]));
    await outro(async () => expect((await avisos()).filter((x) => x.kind === "prazo")).toHaveLength(0));
    // Curso já concluído não recebe aviso de prazo
    await admin(() => q(`update audita.training_enrollments set access_until = (now() at time zone 'America/Sao_Paulo')::date + 10 where id = $1`, [enr]));
    await aluno(async () => expect((await avisos()).filter((x) => x.kind === "prazo")).toHaveLength(0));
  });

  it("financeiro: só os pedidos do próprio aluno; link de pagamento só no pendente em vigor; aviso de pagamento", async () => {
    const pedido = async (email: string, status: string, extra = "") => {
      const r = await one<{ id: string }>(
        `insert into audita.training_orders (course_id, version_id, course_code, course_title, buyer_name, buyer_email, amount, status, terms_accepted_at, mp_init_point, expires_at${extra ? ", " + extra.split("=")[0] : ""})
         select $1, v.id, 'T501', '[TESTE] Curso fictício', '[TESTE] Comprador', $2, 10, $3, now(), 'https://exemplo.test/pagar', now() + interval '1 day'${extra ? ", " + extra.split("=")[1] : ""}
           from audita.training_versions v where v.course_id = $1 limit 1 returning id`,
        [course, email, status],
      );
      return r.id;
    };
    await db.exec(`reset role`);
    const pend = await pedido("aluno@exemplo.test", "pendente");
    const venc = await pedido("aluno@exemplo.test", "pendente", "created_at=now() - interval '10 days'");
    await db.query(`update audita.training_orders set expires_at = now() - interval '7 days' where id = $1`, [venc]);
    await pedido("outro@exemplo.test", "pendente");
    const pago = await pedido("aluno@exemplo.test", "pendente");
    await db.query(`update audita.training_orders set status = 'aprovado', paid_at = now(), mp_payment_method = 'pix', student_id = $2 where id = $1`, [pago, student]);
    await aluno(async () => {
      const o = await q<{ id: string; status: string; pay_url: string | null; expired: boolean; payment_method: string | null }>(`select * from audita.training_my_orders()`);
      expect(o).toHaveLength(3);
      expect(o.find((x) => x.id === pend)).toMatchObject({ pay_url: "https://exemplo.test/pagar", expired: false });
      expect(o.find((x) => x.id === venc)).toMatchObject({ pay_url: null, expired: true });
      expect(o.find((x) => x.id === pago)).toMatchObject({ status: "aprovado", payment_method: "pix", pay_url: null });
      expect(await q(`select * from audita.training_orders`)).toHaveLength(0);
      expect((await avisos()).filter((x) => x.kind === "pagamento").map((x) => [x.title, x.link])).toEqual([["Pagamento aprovado", "/financeiro"]]);
    });
    await outro(async () => expect(await q(`select * from audita.training_my_orders()`)).toHaveLength(1));
  });

  it("visitante (anon) não executa nenhuma função nova", async () => {
    await asUser(db, null, async () => {
      for (const f of [
        "audita.training_my_notifications(50)",
        "audita.training_unread_notifications()",
        "audita.training_my_orders()",
        `audita.training_my_history('${enr}')`,
      ])
        expect((await err(q(`select * from ${f}`)))?.code).toBe("42501");
    });
    expect(other).not.toBe("");
    expect(course2).not.toBe("");
  });
});
