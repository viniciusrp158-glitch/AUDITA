/**
 * T2g — Avaliação com o tempo esgotado e o aluno fora da página (relato do Diretor, 23/10/2026): ao voltar e clicar em
 * "Continuar avaliação", a tentativa vencida é enviada, a avaliação sem nota fica concluída e o módulo seguinte abre;
 * antes, o aviso "já foi concluída" desfazia o envio e o módulo travava. Na avaliação com nota, a tentativa vencida e
 * reprovada abre uma nova tentativa. PGlite. Dados fictícios.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000077a1";
const ALUNO = "00000000-0000-4000-8000-0000000077b1";
const q1 = (code: string) => ({
  code,
  kind: "objetiva",
  statement: `[TESTE] Enunciado ${code}?`,
  options: ["A", "B"].map((k) => ({ key: k, text: `Alternativa ${k}` })),
  correct_key: "A",
  feedback: "Retorno.",
});

describe("T2g — prova com tempo esgotado (PGlite)", () => {
  let db: PGlite;
  let mods: { id: string; position: number }[] = [];
  let enr = "";
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
  const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0];
  const admin = <T>(fn: () => Promise<T>) => asUser(db, ADMIN, fn);
  const aluno = <T>(fn: () => Promise<T>) => asUser(db, ALUNO, fn);
  const expire = async (attempt: string) => {
    await db.exec(`reset role; select set_config('audita.training_flow', 'on', false);
      update audita.training_attempts set deadline_at = now() - interval '5 minutes' where id = '${attempt}';
      select set_config('audita.training_flow', 'off', false);`);
  };
  const start = async (m: string) => (await one<{ id: string }>(`select audita.training_attempt_start($1, $2) id`, [enr, m])).id;

  beforeAll(async () => {
    db = await migratedDb();
    await db.exec(`grant usage on schema storage, extensions to authenticated; grant select on storage.objects to authenticated;
      insert into auth.users (id, email) values ('${ADMIN}', 'admin@exemplo.test'), ('${ALUNO}', 'aluno@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values ('${ADMIN}', '[TESTE] Admin', 'admin');`);
    await admin(async () => {
      const course = (await one<{ id: string }>(`select audita.training_create_course('T701', '[TESTE] Curso', '1.0') id`)).id;
      const version = (await one<{ id: string }>(`select id from audita.training_versions where course_id = $1`, [course])).id;
      await q(`update audita.training_versions set workload_minutes = 60 where id = $1`, [version]);
      await q(`select audita.training_add_module($1, '[TESTE] Final')`, [version]);
      mods = await q(`select id, position from audita.training_modules where version_id = $1 order by position`, [version]);
      for (const m of mods) {
        const path = `training/${course}/apostila-${m.position}.pdf`;
        await db.exec(`reset role; insert into storage.objects (bucket_id, name) values ('audita-treinamentos', '${path}'); set role authenticated;`);
        await q(
          `insert into audita.training_files (version_id, module_id, kind, storage_path, original_name, mime_type, size_bytes, sha256)
           values ($1, $2, 'apostila', $3, 'a.pdf', 'application/pdf', 100, $4)`,
          [version, m.id, path, "f".repeat(64)],
        );
        await q(`select audita.training_import_questions($1, $2)`, [m.id, JSON.stringify([q1(`M0${m.position}-Q01`)])]);
      }
      await q(`update audita.training_assessments set time_limit_minutes = 5 where version_id = $1`, [version]);
      await q(`update audita.training_assessments set pass_score = 1 where module_id = $1`, [mods[1].id]);
      await q(`select audita.training_publish_version($1)`, [version]);
      const sid = (await one<{ id: string }>(`insert into audita.training_students (user_id, full_name, email, source, is_test) values ($1, '[TESTE] Aluna', 'aluno@exemplo.test', 'gestao', true) returning id`, [ALUNO])).id;
      enr = (await one<{ id: string }>(`select audita.training_enroll($1, $2, null, 'gestao') id`, [sid, course])).id;
    });
  }, 120000);
  afterAll(async () => db?.close());

  it("avaliação sem nota: tempo esgotado fora da página → envia, conclui e libera o próximo módulo", async () => {
    await aluno(async () => {
      await q(`select audita.training_complete_step($1, $2, 'apostila')`, [enr, mods[0].id]);
      const t = await start(mods[0].id);
      await expire(t);
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${ALUNO}', false);`);
      // "Continuar avaliação": devolve a própria tentativa (sem erro) e ela fica enviada
      expect(await start(mods[0].id)).toBe(t);
      expect((await one<{ status: string; submitted_by_timeout: boolean }>(`select status, submitted_by_timeout from audita.training_attempts where id = $1`, [t]))).toEqual({
        status: "enviada",
        submitted_by_timeout: true,
      });
      const o = await q<{ position: number; completed: boolean; unlocked: boolean }>(`select position, completed, unlocked from audita.training_outline($1)`, [enr]);
      expect(o).toEqual([
        { position: 1, completed: true, unlocked: true },
        { position: 2, completed: false, unlocked: true },
      ]);
      // Já concluída: a tela mostra "Ver resultado"; uma nova tentativa continua recusada
      await expect(start(mods[0].id)).rejects.toThrow("já foi concluída");
    });
  });

  it("avaliação com nota: tentativa vencida e em branco é reprovada e abre nova tentativa", async () => {
    await aluno(async () => {
      await q(`select audita.training_complete_step($1, $2, 'apostila')`, [enr, mods[1].id]);
      const t1 = await start(mods[1].id);
      await expire(t1);
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${ALUNO}', false);`);
      const t2 = await start(mods[1].id);
      expect(t2).not.toBe(t1);
      expect(await q(`select attempt_number, status, passed from audita.training_attempts where id in ($1, $2) order by attempt_number`, [t1, t2])).toEqual([
        { attempt_number: 1, status: "enviada", passed: false },
        { attempt_number: 2, status: "em_andamento", passed: null },
      ]);
    });
  });
});
