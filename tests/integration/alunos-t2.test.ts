/**
 * T2 — Alunos e matrículas: matrícula só pela função (na versão publicada, com prazo padrão do treinamento), aluno
 * enxerga apenas o próprio cadastro, as próprias matrículas e o conteúdo do aluno das versões em que está matriculado
 * (nunca roteiro, gabarito ou slides); prazo vencido corta o acesso; aluno não acessa nada da equipe.
 * PGlite com todas as migrações. Dados fictícios de teste.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000072a1";
const ALUNO = "00000000-0000-4000-8000-0000000072b1";
const OUTRO = "00000000-0000-4000-8000-0000000072b2";
const SHA = "b".repeat(64);

describe("T2 — alunos e matrículas (PGlite)", () => {
  let db: PGlite;
  let course = "";
  let version = "";
  let student = "";
  let other = "";
  const apostila = { path: "", id: "" };
  const roteiro = { path: "", id: "" };
  const err = async (p: Promise<unknown>) => {
    try {
      await p;
      return null;
    } catch (e) {
      return e as { code?: string; message: string };
    }
  };
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
  const admin = <T>(fn: () => Promise<T>) => asUser(db, ADMIN, fn);
  const aluno = <T>(fn: () => Promise<T>) => asUser(db, ALUNO, fn);

  async function addFile(module: string, kind: string, name: string) {
    const path = `training/${course}/${name}`;
    await db.query(`insert into storage.objects (bucket_id, name) values ('audita-treinamentos', $1)`, [path]);
    const id = await admin(async () =>
      (
        await q<{ id: string }>(
          `insert into audita.training_files (version_id, module_id, kind, storage_path, original_name, mime_type, size_bytes, sha256)
           values ($1, $2, $3, $4, $5, 'application/pdf', 100, $6) returning id`,
          [version, module, kind, path, name, SHA],
        )
      )[0].id,
    );
    return { path, id };
  }

  beforeAll(async () => {
    db = await migratedDb();
    // Permissões padrão do Supabase que o PGlite não traz (a RLS decide o que cada um vê)
    await db.exec(`grant usage on schema storage, extensions to authenticated; grant select on storage.objects to authenticated;`);
    await db.exec(`
      insert into auth.users (id, email) values ('${ADMIN}', 'admin@exemplo.test'), ('${ALUNO}', 'aluno@exemplo.test'), ('${OUTRO}', 'outro@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values ('${ADMIN}', '[TESTE] Admin', 'admin');
    `);
    await admin(async () => {
      course = (await q<{ id: string }>(`select audita.training_create_course('T201', '[TESTE] Curso fictício', '1.0') id`))[0].id;
      version = (await q<{ id: string }>(`select id from audita.training_versions where course_id = $1`, [course]))[0].id;
      await q(`update audita.training_versions set workload_minutes = 60 where id = $1`, [version]);
      await q(`select audita.training_add_module($1, '[TESTE] Módulo 2')`, [version]);
    });
    const mods = await admin(() => q<{ id: string; position: number }>(`select id, position from audita.training_modules where version_id = $1 order by position`, [version]));
    for (const m of mods) {
      const f = await addFile(m.id, "apostila", `apostila-${m.position}.pdf`);
      if (m.position === 2) Object.assign(apostila, f);
    }
    Object.assign(roteiro, await addFile(mods[1].id, "roteiro", "roteiro-2.pdf"));
    await admin(async () => {
      await q(`update audita.training_courses set access_days = 30 where id = $1`, [course]);
      student = (
        await q<{ id: string }>(
          `insert into audita.training_students (user_id, full_name, email, source, is_test) values ($1, '[TESTE] Aluno Fictício', 'ALUNO@Exemplo.test', 'gestao', true) returning id`,
          [ALUNO],
        )
      )[0].id;
      other = (
        await q<{ id: string }>(
          `insert into audita.training_students (user_id, full_name, email, source, is_test) values ($1, '[TESTE] Outro Aluno', 'outro@exemplo.test', 'lote', true) returning id`,
          [OUTRO],
        )
      )[0].id;
    });
  }, 120000);
  afterAll(async () => db?.close());

  it("matrícula exige versão publicada e só é criada pela função; prazo padrão vem do treinamento", async () => {
    await admin(async () => {
      expect((await err(q(`select audita.training_enroll($1, $2, null, 'gestao')`, [student, course])))?.message).toContain("versão publicada");
      await q(`select audita.training_publish_version($1)`, [version]);
      expect(
        (await err(q(`insert into audita.training_enrollments (student_id, course_id, version_id, source) values ($1, $2, $3, 'gestao')`, [student, course, version])))?.code,
      ).toBe("42501");
      await q(`select audita.training_enroll($1, $2, null, 'gestao')`, [student, course]);
      const e = (await q<{ status: string; version_id: string; days: number }>(
        `select status, version_id, access_until - starts_on as days from audita.training_enrollments where student_id = $1`,
        [student],
      ))[0];
      expect(e).toMatchObject({ status: "ativa", version_id: version, days: 30 });
      expect((await err(q(`select audita.training_enroll($1, $2, null, 'gestao')`, [student, course])))?.code).toBe("23505");
      expect((await err(q(`select audita.training_enroll($1, $2, '2000-01-01', 'lote')`, [other, course])))?.code).toBe("23514");
      expect((await q<{ email: string }>(`select email from audita.training_students where id = $1`, [student]))[0].email).toBe("aluno@exemplo.test");
    });
  });

  it("aluno vê só o próprio cadastro, a própria matrícula e o conteúdo do aluno", async () => {
    await aluno(async () => {
      expect((await q<{ id: string }>(`select * from audita.training_me()`))[0].id).toBe(student);
      expect(await q(`select id from audita.training_students`)).toHaveLength(1);
      expect(await q(`select id from audita.training_enrollments`)).toHaveLength(1);
      expect(await q(`select id from audita.training_courses`)).toHaveLength(1);
      expect(await q(`select id from audita.training_modules`)).toHaveLength(2);
      const files = await q<{ kind: string }>(`select kind from audita.training_files order by kind`);
      expect(files.every((f) => f.kind === "apostila")).toBe(true);
      expect(await q(`select name from storage.objects where name = $1`, [apostila.path])).toHaveLength(1);
      expect(await q(`select name from storage.objects where name = $1`, [roteiro.path])).toHaveLength(0);
      // Nada da equipe, nada de escrita
      expect(await q(`select * from audita.clients`)).toHaveLength(0);
      expect((await err(q(`select audita.training_enroll($1, $2, null, 'gestao')`, [other, course])))?.code).toBe("42501");
      expect(await q(`update audita.training_enrollments set access_until = '2099-12-31' returning id`)).toHaveLength(0);
      expect((await err(q(`update audita.training_students set full_name = 'Outro nome' where id = $1`, [student])))).toBeNull();
      expect(await q(`select full_name from audita.training_students where full_name = 'Outro nome'`)).toHaveLength(0);
    });
    await asUser(db, OUTRO, async () => {
      expect(await q(`select id from audita.training_courses`)).toHaveLength(0);
      expect(await q(`select id from audita.training_files`)).toHaveLength(0);
      expect(await q(`select name from storage.objects where name = $1`, [apostila.path])).toHaveLength(0);
    });
  });

  it("prazo vencido ou matrícula suspensa cortam o acesso ao conteúdo", async () => {
    // Simula uma matrícula antiga (datas fixas, por fora dos gatilhos)
    await db.exec(`set session_replication_role = replica`);
    await db.query(`update audita.training_enrollments set starts_on = current_date - 10, access_until = current_date - 1 where student_id = $1`, [student]);
    await db.exec(`set session_replication_role = origin`);
    await aluno(async () => {
      expect(await q(`select id from audita.training_modules`)).toHaveLength(0);
      expect(await q(`select name from storage.objects where name = $1`, [apostila.path])).toHaveLength(0);
      expect(await q(`select id from audita.training_enrollments`)).toHaveLength(1);
    });
    await admin(async () => {
      await q(`update audita.training_enrollments set access_until = null where student_id = $1`, [student]);
      await q(`update audita.training_enrollments set status = 'suspensa' where student_id = $1`, [student]);
    });
    await aluno(async () => expect(await q(`select id from audita.training_modules`)).toHaveLength(0));
    await admin(async () => {
      await q(`update audita.training_enrollments set status = 'ativa' where student_id = $1`, [student]);
      expect((await err(q(`update audita.training_enrollments set status = 'concluida' where student_id = $1`, [student])))?.code).toBe("42501");
      await q(`update audita.training_enrollments set status = 'cancelada', status_note = 'Teste' where student_id = $1`, [student]);
      expect((await err(q(`update audita.training_enrollments set status = 'ativa' where student_id = $1`, [student])))?.code).toBe("23514");
      // Nova matrícula depois do cancelamento é permitida
      await q(`select audita.training_enroll($1, $2, null, 'cortesia')`, [student, course]);
    });
    await aluno(async () => expect(await q(`select id from audita.training_modules`)).toHaveLength(2));
  });

  it("aluno inativado perde o acesso; e-mail e conta do aluno são permanentes", async () => {
    await admin(async () => {
      expect((await err(q(`update audita.training_students set email = 'x@exemplo.test' where id = $1`, [student])))?.code).toBe("42501");
      await q(`update audita.training_students set status = 'inativo' where id = $1`, [student]);
    });
    await aluno(async () => {
      expect(await q(`select * from audita.training_me()`)).toHaveLength(0);
      expect(await q(`select id from audita.training_modules`)).toHaveLength(0);
    });
  });
});
