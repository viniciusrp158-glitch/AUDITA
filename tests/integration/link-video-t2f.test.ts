/**
 * T2f — Troca do link da videoaula em versão publicada: só o administrador, só trocar um link que já existe (sem
 * incluir nem retirar videoaula), link do YouTube válido; o resto do módulo continua congelado. PGlite. Dados fictícios.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000075a1";
const OTHER = "00000000-0000-4000-8000-0000000075b1";
const OLD = "https://youtu.be/abcdefghijk";
const NEW = "https://www.youtube.com/watch?v=zyxwvutsrqp";

describe("T2f — troca do link da videoaula (PGlite)", () => {
  let db: PGlite;
  let version = "";
  let mods: { id: string; position: number }[] = [];
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
  const replace = (id: string, url: string | null) => q(`select audita.training_replace_video_url($1, $2)`, [id, url]);

  beforeAll(async () => {
    db = await migratedDb();
    await db.exec(`
      insert into auth.users (id, email) values ('${ADMIN}', 'admin@exemplo.test'), ('${OTHER}', 'outro@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values ('${ADMIN}', '[TESTE] Admin', 'admin');
    `);
    await admin(async () => {
      const course = (await q<{ id: string }>(`select audita.training_create_course('T501', '[TESTE] Curso fictício', '1.0') id`))[0].id;
      version = (await q<{ id: string }>(`select id from audita.training_versions where course_id = $1`, [course]))[0].id;
      await q(`update audita.training_versions set workload_minutes = 60 where id = $1`, [version]);
      await q(`select audita.training_add_module($1, '[TESTE] Módulo 2')`, [version]);
      mods = await q(`select id, position from audita.training_modules where version_id = $1 order by position`, [version]);
      await q(`update audita.training_modules set video_url = $2 where id = $1`, [mods[1].id, OLD]);
      for (const m of mods) {
        const path = `training/${course}/apostila-${m.position}.pdf`;
        await db.exec(`reset role; insert into storage.objects (bucket_id, name) values ('audita-treinamentos', '${path}'); set role authenticated;`);
        await q(
          `insert into audita.training_files (version_id, module_id, kind, storage_path, original_name, mime_type, size_bytes, sha256)
           values ($1, $2, 'apostila', $3, 'apostila.pdf', 'application/pdf', 100, $4)`,
          [version, m.id, path, "d".repeat(64)],
        );
      }
      expect((await err(replace(mods[1].id, NEW)))?.message).toContain("versões publicadas");
      await q(`select audita.training_publish_version($1)`, [version]);
    });
  }, 120000);
  afterAll(async () => db?.close());

  it("troca o link da versão publicada; o resto do módulo continua congelado", async () => {
    await admin(async () => {
      expect((await err(q(`update audita.training_modules set video_url = $2 where id = $1`, [mods[1].id, NEW])))?.code).toBe("42501");
      await replace(mods[1].id, NEW);
      expect((await q<{ video_url: string; title: string }>(`select video_url, title from audita.training_modules where id = $1`, [mods[1].id]))[0]).toEqual({
        video_url: NEW,
        title: "[TESTE] Módulo 2",
      });
      expect((await err(q(`update audita.training_modules set title = 'Outro' where id = $1`, [mods[1].id])))?.code).toBe("42501");
    });
  });

  it("não inclui nem retira videoaula, recusa link inválido e exige administrador", async () => {
    await admin(async () => {
      expect((await err(replace(mods[0].id, NEW)))?.message).toContain("não tem videoaula");
      expect((await err(replace(mods[1].id, "")))?.message).toContain("Informe o novo link");
      expect((await err(replace(mods[1].id, "https://vimeo.com/123")))?.code).toBe("23514");
    });
    await asUser(db, OTHER, async () => {
      expect((await err(replace(mods[1].id, NEW)))?.code).toBe("42501");
    });
  });
});
