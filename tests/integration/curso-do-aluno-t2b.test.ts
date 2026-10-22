/**
 * T2b/c/d — Curso do aluno: questões importadas só em rascunho e congeladas na publicação; o aluno nunca lê a resposta
 * certa; módulos em sequência (Apostila → Videoaula → Avaliação); prova corrigida no servidor, com tempo de prova,
 * tentativas e retorno conforme a política; conclusão do curso com certificado e verificação só pela chave de serviço.
 * PGlite com todas as migrações. Dados fictícios de teste.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000073a1";
const ALUNO = "00000000-0000-4000-8000-0000000073b1";
const OUTRO = "00000000-0000-4000-8000-0000000073b2";
const SHA = "c".repeat(64);
const VIDEO = "https://www.youtube.com/watch?v=abcdefghijk";

const obj = (code: string, correct: string, feedback = `Retorno ${code}.`) => ({
  code,
  kind: "objetiva",
  statement: `[TESTE] Enunciado ${code}?`,
  options: ["A", "B", "C", "D"].map((k) => ({ key: k, text: `Alternativa ${k}` })),
  correct_key: correct,
  feedback,
});
const open = (code: string) => ({ code, kind: "aberta", statement: `[TESTE] Atividade ${code}.`, feedback: "Resposta de referência." });

describe("T2b — curso do aluno, provas e certificado (PGlite)", () => {
  let db: PGlite;
  let course = "";
  let version = "";
  let mods: { id: string; position: number }[] = [];
  let enr = "";
  let enrOther = "";
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
  type Outline = { module_id: string; position: number; unlocked: boolean; completed: boolean; required_steps: string[]; done_steps: string[] };
  const outline = (e: string) => q<Outline>(`select * from audita.training_outline($1)`, [e]);
  type View = { questions: { id: string; code: string; kind: string; correct_key?: string }[]; status: string };
  const start = async (e: string, m: string) => (await one<{ id: string }>(`select audita.training_attempt_start($1, $2) id`, [e, m])).id;
  const view = async (t: string) => (await one<{ v: View }>(`select audita.training_attempt_view($1) v`, [t])).v;
  const save = (t: string, qid: string, choice: string | null, text: string | null = null) =>
    q(`select audita.training_attempt_save($1, $2, $3, $4)`, [t, qid, choice, text]);
  const result = async (t: string) => (await one<{ r: Record<string, unknown> & { items: Record<string, unknown>[] } }>(`select audita.training_attempt_result($1) r`, [t])).r;

  beforeAll(async () => {
    db = await migratedDb();
    await db.exec(`grant usage on schema storage, extensions to authenticated; grant select on storage.objects to authenticated;`);
    await db.exec(`
      insert into auth.users (id, email) values ('${ADMIN}', 'admin@exemplo.test'), ('${ALUNO}', 'aluno@exemplo.test'), ('${OUTRO}', 'outro@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values ('${ADMIN}', '[TESTE] Admin', 'admin');
    `);
    await admin(async () => {
      course = (await one<{ id: string }>(`select audita.training_create_course('T301', '[TESTE] Curso fictício', '1.0') id`)).id;
      version = (await one<{ id: string }>(`select id from audita.training_versions where course_id = $1`, [course])).id;
      await q(`update audita.training_versions set workload_minutes = 120, instructor_name = '[TESTE] Instrutor' where id = $1`, [version]);
      await q(`select audita.training_add_module($1, '[TESTE] Módulo 2')`, [version]);
      await q(`select audita.training_add_module($1, '[TESTE] Avaliação final')`, [version]);
      mods = await q(`select id, position from audita.training_modules where version_id = $1 order by position`, [version]);
      await q(`update audita.training_modules set video_url = $2 where id = $1`, [mods[1].id, VIDEO]);
      await q(`update audita.training_modules set activity_minutes = 5 where id = $1`, [mods[0].id]);
      for (const m of mods) {
        const path = `training/${course}/apostila-${m.position}.pdf`;
        await db.exec(`reset role; insert into storage.objects (bucket_id, name) values ('audita-treinamentos', '${path}'); set role authenticated;`);
        await q(
          `insert into audita.training_files (version_id, module_id, kind, storage_path, original_name, mime_type, size_bytes, sha256)
           values ($1, $2, 'apostila', $3, 'apostila.pdf', 'application/pdf', 100, $4)`,
          [version, m.id, path, SHA],
        );
      }
      for (const [uid, name, email] of [
        [ALUNO, "[TESTE] Aluna Fictícia", "aluno@exemplo.test"],
        [OUTRO, "[TESTE] Outro Aluno", "outro@exemplo.test"],
      ])
        await q(`insert into audita.training_students (user_id, full_name, email, source, is_test) values ($1, $2, $3, 'gestao', true)`, [uid, name, email]);
    });
  }, 120000);
  afterAll(async () => db?.close());

  it("importação só em rascunho; publicação confere nota mínima; versão publicada fica congelada", async () => {
    await admin(async () => {
      expect((await one<{ n: number }>(`select audita.training_import_questions($1, $2) n`, [mods[0].id, JSON.stringify([obj("M01-Q01", "B")])])).n).toBe(1);
      await q(`select audita.training_import_questions($1, $2)`, [mods[1].id, JSON.stringify([obj("M02-Q01", "A"), obj("M02-Q02", "C"), open("M02-A01")])]);
      await q(`select audita.training_import_questions($1, $2)`, [mods[2].id, JSON.stringify([obj("M03-Q01", "A", "Retorno. (Módulo 02)"), obj("M03-Q02", "B", "Retorno. (Módulo 01)"), obj("M03-Q03", "C", "Retorno. (Módulo 02)")])]);
      // Reimportar atualiza pelo código e inativa o que saiu (nada é excluído)
      await q(`select audita.training_import_questions($1, $2)`, [mods[0].id, JSON.stringify([obj("M01-Q01", "B", "Retorno revisado."), obj("M01-Q02", "D")])]);
      await q(`select audita.training_import_questions($1, $2)`, [mods[0].id, JSON.stringify([obj("M01-Q01", "B", "Retorno revisado.")])]);
      const m1 = await q<{ code: string; status: string; feedback: string }>(
        `select q.code, q.status, q.feedback from audita.training_questions q join audita.training_assessments a on a.id = q.assessment_id where a.module_id = $1 order by q.code`,
        [mods[0].id],
      );
      expect(m1).toEqual([
        { code: "M01-Q01", status: "ativo", feedback: "Retorno revisado." },
        { code: "M01-Q02", status: "inativo", feedback: "Retorno M01-Q02." },
      ]);
      expect((await one<{ t: number }>(`select time_limit_minutes t from audita.training_assessments where module_id = $1`, [mods[0].id])).t).toBe(5);
      expect(
        (await err(q(`select audita.training_import_questions($1, $2)`, [mods[0].id, JSON.stringify([{ ...obj("M01-Q03", "E") }])])))?.message,
      ).toContain("uma das alternativas");
      await q(`update audita.training_assessments set pass_score = 4, max_attempts = 2 where module_id = $1`, [mods[2].id]);
      expect((await err(q(`select audita.training_publish_version($1)`, [version])))?.message).toContain("maior que o número de questões objetivas");
      await q(`update audita.training_assessments set pass_score = 2 where module_id = $1`, [mods[2].id]);
      await q(`select audita.training_publish_version($1)`, [version]);
      expect((await err(q(`select audita.training_import_questions($1, $2)`, [mods[0].id, JSON.stringify([obj("M01-Q01", "A")])])))?.code).toBe("42501");
      expect((await err(q(`update audita.training_questions set correct_key = 'A' where code = 'M01-Q01'`)))?.code).toBe("42501");
      expect((await err(q(`update audita.training_assessments set pass_score = 1 where module_id = $1`, [mods[2].id])))?.code).toBe("42501");
      for (const email of ["aluno@exemplo.test", "outro@exemplo.test"]) {
        const sid = (await one<{ id: string }>(`select id from audita.training_students where email = $1`, [email])).id;
        const id = (await one<{ id: string }>(`select audita.training_enroll($1, $2, null, 'gestao') id`, [sid, course])).id;
        if (email.startsWith("aluno")) enr = id;
        else enrOther = id;
      }
    });
  });

  it("aluno não lê questões nem respostas; módulos abrem em sequência", async () => {
    await aluno(async () => {
      expect(await q(`select * from audita.training_questions`)).toHaveLength(0);
      expect(await q(`select * from audita.training_assessments`)).toHaveLength(0);
      expect((await err(q(`select * from audita.training_outline($1)`, [enrOther])))?.code).toBe("P0002");
      const o = await outline(enr);
      expect(o.map((m) => [m.position, m.unlocked, m.completed])).toEqual([
        [1, true, false],
        [2, false, false],
        [3, false, false],
      ]);
      expect(o[1].required_steps).toEqual(["apostila", "video", "avaliacao"]);
      expect((await err(q(`select audita.training_complete_step($1, $2, 'apostila')`, [enr, mods[1].id])))?.message).toContain("módulo anterior");
      expect((await err(start(enr, mods[0].id)))?.message).toContain("apostila");
      expect((await err(q(`insert into audita.training_progress (enrollment_id, module_id, step) values ($1, $2, 'apostila')`, [enr, mods[0].id])))?.code).toBe("42501");
    });
  });

  it("avaliação sem nota: correção no servidor, retorno completo e próximo módulo liberado", async () => {
    await aluno(async () => {
      await q(`select audita.training_complete_step($1, $2, 'apostila')`, [enr, mods[0].id]);
      const t = await start(enr, mods[0].id);
      expect(await start(enr, mods[0].id)).toBe(t); // retoma a mesma tentativa
      const v = await view(t);
      expect(v.questions).toHaveLength(1);
      expect(JSON.stringify(v)).not.toContain("correct_key");
      expect(JSON.stringify(v)).not.toContain("Retorno");
      expect((await err(save(t, v.questions[0].id, "Z")))?.message).toContain("Alternativa inválida");
      expect((await err(q(`select audita.training_attempt_submit($1)`, [t])))?.message).toContain("Responda todas");
      await save(t, v.questions[0].id, "A");
      await q(`select audita.training_attempt_submit($1)`, [t]);
      const r = await result(t);
      expect(r).toMatchObject({ score: 0, max_score: 1, passed: true, show_feedback: true });
      expect(r.items[0]).toMatchObject({ code: "M01-Q01", choice: "A", is_correct: false, correct_key: "B", feedback: "Retorno revisado." });
      expect((await err(start(enr, mods[0].id)))?.message).toContain("já foi concluída");
      const o = await outline(enr);
      expect(o.map((m) => [m.completed, m.unlocked])).toEqual([
        [true, true],
        [false, true],
        [false, false],
      ]);
    });
  });

  it("módulo com vídeo e atividade aberta: ordem das etapas e resposta mínima", async () => {
    await aluno(async () => {
      expect((await err(q(`select audita.training_complete_step($1, $2, 'video')`, [enr, mods[1].id])))?.message).toContain("apostila");
      await q(`select audita.training_complete_step($1, $2, 'apostila')`, [enr, mods[1].id]);
      expect((await err(start(enr, mods[1].id)))?.message).toContain("videoaula");
      await q(`select audita.training_complete_step($1, $2, 'video')`, [enr, mods[1].id]);
      const t = await start(enr, mods[1].id);
      const v = await view(t);
      const byCode = Object.fromEntries(v.questions.map((x) => [x.code, x.id]));
      await save(t, byCode["M02-Q01"], "A");
      await save(t, byCode["M02-Q02"], "C");
      await save(t, byCode["M02-A01"], null, "curta");
      expect((await err(q(`select audita.training_attempt_submit($1)`, [t])))?.message).toContain("10 caracteres");
      await save(t, byCode["M02-A01"], null, "Minha resposta fictícia com raciocínio completo.");
      await q(`select audita.training_attempt_submit($1)`, [t]);
      const r = await result(t);
      expect(r).toMatchObject({ score: 2, max_score: 2, passed: true });
      expect(r.items.find((i) => i.code === "M02-A01")).toMatchObject({ kind: "aberta", feedback: "Resposta de referência." });
      expect((await err(save(t, byCode["M02-Q01"], "B")))?.message).toContain("já foi enviada");
    });
  });

  it("avaliação final: sem retorno antes da aprovação, limite de tentativas, conclusão e certificado", async () => {
    await aluno(async () => {
      await q(`select audita.training_complete_step($1, $2, 'apostila')`, [enr, mods[2].id]);
      const t1 = await start(enr, mods[2].id);
      for (const x of (await view(t1)).questions) await save(t1, x.id, "D");
      await q(`select audita.training_attempt_submit($1)`, [t1]);
      const r1 = await result(t1);
      expect(r1).toMatchObject({ score: 0, max_score: 3, passed: false, show_feedback: false, can_retry: true, attempts_used: 1, max_attempts: 2 });
      expect(r1.items.every((i) => i.correct_key === null && i.feedback === null && i.is_correct === null)).toBe(true);
      expect([...(r1.review_modules as string[])].sort()).toEqual(["01", "02"]);
      expect(await q(`select id from audita.training_certificates`)).toHaveLength(0);

      const t2 = await start(enr, mods[2].id);
      const v2 = await view(t2);
      const key: Record<string, string> = { "M03-Q01": "A", "M03-Q02": "B", "M03-Q03": "D" };
      for (const x of v2.questions) await save(t2, x.id, key[x.code]);
      await q(`select audita.training_attempt_submit($1)`, [t2]);
      const r2 = await result(t2);
      expect(r2).toMatchObject({ score: 2, passed: true, show_feedback: true });
      expect((await one<{ status: string }>(`select status from audita.training_enrollments where id = $1`, [enr])).status).toBe("concluida");
      const c = await one<{ code: string; student_name: string; final_score: number; final_max_score: number; workload_minutes: number; status: string }>(
        `select code, student_name, final_score, final_max_score, workload_minutes, status from audita.training_certificates`,
      );
      expect(c.code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
      expect(c).toMatchObject({ student_name: "[TESTE] Aluna Fictícia", final_score: 2, final_max_score: 3, workload_minutes: 120, status: "valido" });
      // Concluído: nada mais é registrado, mas o resultado continua consultável
      expect((await err(q(`select audita.training_complete_step($1, $2, 'apostila')`, [enr, mods[0].id])))?.message).toContain("concluída");
      expect((await err(q(`select * from audita.training_verify_certificate($1)`, [c.code])))?.code).toBe("42501");
    });
    await asUser(db, null, async () => {
      expect((await err(q(`select * from audita.training_verify_certificate('0000-0000-0000')`)))?.code).toBe("42501");
    });
    const code = (await one<{ code: string }>(`select code from audita.training_certificates`)).code;
    await db.exec(`set role service_role`);
    try {
      expect(await one(`select status, student_name, course_code from audita.training_verify_certificate($1)`, [code.toLowerCase()])).toEqual({
        status: "valido",
        student_name: "[TESTE] Aluna Fictícia",
        course_code: "T301",
      });
    } finally {
      await db.exec(`reset role`);
    }
    await admin(async () => {
      expect((await err(q(`update audita.training_certificates set student_name = 'Outro'`)))?.code).toBe("42501");
      expect((await err(q(`update audita.training_certificates set status = 'cancelado'`)))?.message).toContain("motivo");
      const p = await one<{ modules_done: number; modules_total: number; certificate_code: string }>(
        `select * from audita.training_enrollment_progress($1) where enrollment_id = $2`,
        [course, enr],
      );
      expect(p).toMatchObject({ modules_done: 3, modules_total: 3, certificate_code: code });
    });
  });

  it("tempo esgotado envia com o que estiver salvo; tentativas esgotadas liberam o retorno", async () => {
    await outro(async () => {
      await q(`select audita.training_complete_step($1, $2, 'apostila')`, [enrOther, mods[0].id]);
      const t = await start(enrOther, mods[0].id);
      expect((await err(q(`insert into audita.training_attempts (enrollment_id, assessment_id, attempt_number, question_ids) values ($1, gen_random_uuid(), 9, '{}')`, [enrOther])))?.code).toBe("42501");
      await db.exec(`reset role; select set_config('audita.training_flow', 'on', false);
        update audita.training_attempts set deadline_at = now() - interval '2 minutes' where id = '${t}';
        select set_config('audita.training_flow', 'off', false); set role authenticated;`);
      const qid = (await one<{ id: string }>(`select (audita.training_attempt_view($1)->'questions'->0->>'id') id`, [t])).id;
      expect((await err(save(t, qid, "B")))?.message).toContain("já foi enviada");
      const r = await result(t);
      expect(r).toMatchObject({ by_timeout: true, score: 0, passed: true });
      // Final com duas tentativas erradas: o retorno aparece ao esgotar
      for (const step of [mods[1].id]) {
        await q(`select audita.training_complete_step($1, $2, 'apostila')`, [enrOther, step]);
        await q(`select audita.training_complete_step($1, $2, 'video')`, [enrOther, step]);
        const t2 = await start(enrOther, step);
        for (const x of (await view(t2)).questions) await save(t2, x.id, x.kind === "objetiva" ? "A" : null, x.kind === "aberta" ? "Resposta fictícia suficiente." : null);
        await q(`select audita.training_attempt_submit($1)`, [t2]);
      }
      await q(`select audita.training_complete_step($1, $2, 'apostila')`, [enrOther, mods[2].id]);
      let last = "";
      for (let i = 0; i < 2; i++) {
        last = await start(enrOther, mods[2].id);
        for (const x of (await view(last)).questions) await save(last, x.id, "D");
        await q(`select audita.training_attempt_submit($1)`, [last]);
      }
      const rl = await result(last);
      expect(rl).toMatchObject({ passed: false, can_retry: false, show_feedback: true });
      expect(rl.items[0].correct_key).toBe("A");
      expect((await err(start(enrOther, mods[2].id)))?.message).toContain("2 tentativas");
    });
  });

  it("nova versão copia avaliações e questões ativas", async () => {
    await admin(async () => {
      const v2 = (await one<{ id: string }>(`select audita.training_new_version($1, '1.1') id`, [course])).id;
      const rows = await q<{ position: number; n: number; pass_score: number | null }>(
        `select m.position, a.pass_score, (select count(*) from audita.training_questions q where q.assessment_id = a.id)::int n
           from audita.training_assessments a join audita.training_modules m on m.id = a.module_id where a.version_id = $1 order by m.position`,
        [v2],
      );
      expect(rows).toEqual([
        { position: 1, pass_score: null, n: 1 },
        { position: 2, pass_score: null, n: 3 },
        { position: 3, pass_score: 2, n: 3 },
      ]);
    });
  });
});
