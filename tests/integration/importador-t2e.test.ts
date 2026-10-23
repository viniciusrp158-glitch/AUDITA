/**
 * T2e — Importador do pacote: cria o treinamento, a ficha e os módulos de uma vez (ou a nova versão de um treinamento
 * existente), só para administradores, sem sobrepor rascunho nem versão já existente. PGlite. Dados fictícios.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000074a1";
const OTHER = "00000000-0000-4000-8000-0000000074b1";

const modules = [
  { position: 1, title: "Ambientação", objective: "Conhecer a plataforma.", content_summary: "Boas-vindas.", video_minutes: 8, reading_minutes: 7, activity_minutes: 5 },
  { position: 2, title: "[TESTE] Tema fictício", objective: "Aplicar.", content_summary: "Conceito A.", video_minutes: 15, reading_minutes: 10, activity_minutes: 5 },
  { position: 3, title: "[TESTE] Avaliação final", objective: null, content_summary: null, video_minutes: null, reading_minutes: null, activity_minutes: 20 },
];
const ficha = { workload_minutes: 120, instructor_name: "[TESTE] Instrutor", modality: "100% EAD", important_notice: "Curso fictício." };

describe("T2e — importador do pacote (PGlite)", () => {
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
  const admin = <T>(fn: () => Promise<T>) => asUser(db, ADMIN, fn);
  type Out = { course_id: string; version_id: string; created_course: boolean; modules: Record<string, string> };
  const run = async (code: string, version: string, mods = modules) =>
    (await q<{ r: Out }>(`select audita.training_import_package($1, '[TESTE] Curso importado', $2, $3, $4) r`, [code, version, JSON.stringify(ficha), JSON.stringify(mods)]))[0].r;

  beforeAll(async () => {
    db = await migratedDb();
    await db.exec(`
      insert into auth.users (id, email) values ('${ADMIN}', 'admin@exemplo.test'), ('${OTHER}', 'outro@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values ('${ADMIN}', '[TESTE] Admin', 'admin');
    `);
  }, 120000);
  afterAll(async () => db?.close());

  it("treinamento novo: versão em rascunho com a ficha e os módulos na ordem", async () => {
    await admin(async () => {
      const r = await run("T401", "1.2");
      expect(r.created_course).toBe(true);
      expect(Object.keys(r.modules)).toEqual(["1", "2", "3"]);
      const v = (await q(`select version_label, status, workload_minutes, instructor_name, important_notice from audita.training_versions where id = $1`, [r.version_id]))[0];
      expect(v).toEqual({ version_label: "1.2", status: "rascunho", workload_minutes: 120, instructor_name: "[TESTE] Instrutor", important_notice: "Curso fictício." });
      const m = await q(`select position, title, is_orientation, video_minutes, activity_minutes, objective from audita.training_modules where version_id = $1 order by position`, [r.version_id]);
      expect(m).toEqual([
        { position: 1, title: "Ambientação", is_orientation: true, video_minutes: 8, activity_minutes: 5, objective: "Conhecer a plataforma." },
        { position: 2, title: "[TESTE] Tema fictício", is_orientation: false, video_minutes: 15, activity_minutes: 5, objective: "Aplicar." },
        { position: 3, title: "[TESTE] Avaliação final", is_orientation: false, video_minutes: null, activity_minutes: 20, objective: null },
      ]);
      const m2 = (await q<{ id: string }>(`select id from audita.training_modules where version_id = $1 and position = 2`, [r.version_id]))[0].id;
      expect(r.modules["2"]).toBe(m2);
    });
  });

  it("treinamento existente: recusa com rascunho aberto ou versão repetida; depois da publicação, cria a nova versão", async () => {
    await admin(async () => {
      expect((await err(run("T401", "1.3")))?.message).toContain("já tem uma versão em rascunho");
      const v = (await q<{ id: string }>(`select v.id from audita.training_versions v join audita.training_courses c on c.id = v.course_id where c.course_code = 'T401'`))[0].id;
      await db.exec(`reset role`);
      await db.query(`select set_config('audita.training_flow', 'on', false)`);
      await db.query(`update audita.training_versions set status = 'publicada', published_at = now() where id = $1`, [v]);
      await db.query(`select set_config('audita.training_flow', 'off', false)`);
      await db.exec(`set role authenticated`);
      expect((await err(run("T401", "1.2")))?.code).toBe("23505");
      const r = await run("T401", "1.3");
      expect(r.created_course).toBe(false);
      expect(await q(`select version_label from audita.training_versions where course_id = $1 order by version_label`, [r.course_id])).toEqual([
        { version_label: "1.2" },
        { version_label: "1.3" },
      ]);
    });
  });

  it("valida o pacote e exige administrador", async () => {
    await admin(async () => {
      expect((await err(run("x", "1.0")))?.message).toContain("Código do treinamento");
      expect((await err(run("T402", "1")))?.message).toContain("Versão do material");
      expect((await err(run("T402", "1.0", modules.slice(1))))?.message).toContain("Módulo 01");
      expect((await err(run("T402", "1.0", [modules[0], modules[2], modules[1]])))?.message).toContain("fora de ordem");
      expect(await q(`select id from audita.training_courses where course_code = 'T402'`)).toHaveLength(0);
    });
    await asUser(db, OTHER, async () => {
      expect((await err(run("T403", "1.0")))?.code).toBe("42501");
    });
    await asUser(db, null, async () => {
      expect((await err(run("T403", "1.0")))?.code).toBe("42501");
    });
  });
});
