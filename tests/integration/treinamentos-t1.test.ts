/**
 * T1 — Treinamentos EAD: cadastro, versões (rascunho → publicada congelada → nova versão), módulos (Ambientação
 * sempre primeiro, ordem só pela função de mover) e arquivos privados (aluno × equipe, nunca substituídos).
 * PGlite com todas as migrações. Dados fictícios de teste.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000071a1";
const OPER = "00000000-0000-4000-8000-0000000071a2";
const SHA = "a".repeat(64);

describe("T1 — treinamentos (PGlite)", () => {
  let db: PGlite;
  let course = "";
  let draft = "";
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
  /** Simula o envio ao bucket (o gatilho confere se o objeto existe) e registra o arquivo como administrador. */
  async function addFile(version: string, module: string | null, kind: string, name: string, position = 1) {
    const path = `training/${course}/${Math.random().toString(36).slice(2)}_${name}`;
    await db.query(`insert into storage.objects (bucket_id, name) values ('audita-treinamentos', $1)`, [path]);
    return admin(async () =>
      (
        await q<{ id: string }>(
          `insert into audita.training_files (version_id, module_id, kind, position, storage_path, original_name, mime_type, size_bytes, sha256)
           values ($1, $2, $3, $4, $5, $6, 'application/pdf', 1000, $7) returning id`,
          [version, module, kind, position, path, name, SHA],
        )
      )[0].id,
    );
  }

  beforeAll(async () => {
    db = await migratedDb();
    await db.exec(`
      insert into auth.users (id, email) values ('${ADMIN}', 'admin@exemplo.test'), ('${OPER}', 'oper@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values ('${ADMIN}', '[TESTE] Admin', 'admin'), ('${OPER}', '[TESTE] Operador', 'operador');
    `);
  }, 120000);
  afterAll(async () => db?.close());

  it("cria o treinamento com a versão em rascunho e o Módulo 01 (Ambientação)", async () => {
    course = await admin(async () => (await q<{ id: string }>(`select audita.training_create_course('l01', 'Segurança do Trabalho: Primeiros Passos', '1.2') id`))[0].id);
    const v = await admin(() => q<{ id: string; status: string; version_label: string; title: string }>(`select id, status, version_label, title from audita.training_versions where course_id = $1`, [course]));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ status: "rascunho", version_label: "1.2" });
    draft = v[0].id;
    const m = await admin(() => q(`select position, title, is_orientation from audita.training_modules where version_id = $1`, [draft]));
    expect(m).toEqual([{ position: 1, title: "Ambientação", is_orientation: true }]);
    expect((await admin(() => q<{ course_code: string }>(`select course_code from audita.training_courses`)))[0].course_code).toBe("L01");
    expect((await q(`select 1 from audita.audit_log where entity = 'training_courses' and entity_id = $1`, [course])).length).toBe(1);
  });

  it("operador e visitante não veem nem criam treinamentos", async () => {
    await asUser(db, OPER, async () => {
      expect(await q(`select * from audita.training_courses`)).toHaveLength(0);
      expect((await err(q(`select audita.training_create_course('X01', 'Treinamento qualquer', '1.0')`)))?.code).toBe("42501");
      expect((await err(q(`insert into audita.training_files (version_id, kind, storage_path, original_name, mime_type, size_bytes, sha256) values ($1, 'ficha_tecnica', 'training/x/y.pdf', 'y.pdf', 'application/pdf', 1, $2)`, [draft, SHA])))).not.toBeNull();
    });
    await asUser(db, null, async () => {
      expect((await err(q(`select * from audita.training_courses`)))?.code).toBe("42501");
    });
  });

  it("módulos: novos vão para o fim; a ordem muda só pela função de mover; a Ambientação fica em primeiro", async () => {
    const ids = await admin(async () => {
      const a = (await q<{ id: string }>(`select audita.training_add_module($1, 'Fundamentos de SST') id`, [draft]))[0].id;
      const b = (await q<{ id: string }>(`select audita.training_add_module($1, 'Perigos e riscos') id`, [draft]))[0].id;
      return { a, b };
    });
    await admin(async () => {
      await q(`select audita.training_move_module($1, -1)`, [ids.b]);
      const order = await q<{ title: string }>(`select title from audita.training_modules where version_id = $1 order by position`, [draft]);
      expect(order.map((r) => r.title)).toEqual(["Ambientação", "Perigos e riscos", "Fundamentos de SST"]);
      await q(`select audita.training_move_module($1, -1)`, [ids.b]); // já está logo após a Ambientação: não muda
      await q(`select audita.training_move_module($1, 1)`, [ids.b]);
      const back = await q<{ title: string }>(`select title from audita.training_modules where version_id = $1 order by position`, [draft]);
      expect(back.map((r) => r.title)).toEqual(["Ambientação", "Fundamentos de SST", "Perigos e riscos"]);
      const orient = (await q<{ id: string }>(`select id from audita.training_modules where version_id = $1 and is_orientation`, [draft]))[0].id;
      expect((await err(q(`select audita.training_move_module($1, 1)`, [orient])))?.code).toBe("23514");
      expect((await err(q(`update audita.training_modules set position = 5 where id = $1`, [ids.a])))?.code).toBe("42501");
      expect((await err(q(`update audita.training_modules set status = 'inativo' where id = $1`, [orient])))?.code).toBe("23514");
      await q(`update audita.training_modules set objective = 'Explicar a finalidade da SST.', video_url = 'https://youtu.be/abcdefghijk' where id = $1`, [ids.a]);
      expect((await err(q(`update audita.training_modules set video_url = 'https://vimeo.com/123' where id = $1`, [ids.a])))?.code).toBe("23514");
    });
  });

  it("arquivos: só com o objeto no armazenamento, um ativo por tipo, nunca alterados; remover não apaga", async () => {
    const [m2] = await admin(() => q<{ id: string }>(`select id from audita.training_modules where version_id = $1 and position = 2`, [draft]));
    const ap = await addFile(draft, m2.id, "apostila", "L01_M02_Apostila.pdf");
    expect((await admin(() => q<{ audience: string }>(`select audience from audita.training_files where id = $1`, [ap])))[0].audience).toBe("aluno");
    const rot = await addFile(draft, m2.id, "roteiro", "L01_M02_Roteiro.pdf");
    expect((await admin(() => q<{ audience: string }>(`select audience from audita.training_files where id = $1`, [rot])))[0].audience).toBe("equipe");
    await addFile(draft, m2.id, "slide_imagem", "L01_M02_Slide_01.png", 1);
    await addFile(draft, m2.id, "slide_imagem", "L01_M02_Slide_02.png", 2);
    expect((await err(addFile(draft, m2.id, "apostila", "outra.pdf")))?.code).toBe("23505");
    expect((await err(addFile(draft, null, "apostila", "sem-modulo.pdf")))?.code).toBe("23514");
    await admin(async () => {
      expect(
        (await err(q(`insert into audita.training_files (version_id, kind, storage_path, original_name, mime_type, size_bytes, sha256) values ($1, 'ficha_tecnica', $2, 'ficha.pdf', 'application/pdf', 10, $3)`, [draft, `training/${course}/fantasma.pdf`, SHA])))?.code,
      ).toBe("22023");
      expect((await err(q(`update audita.training_files set original_name = 'x.pdf' where id = $1`, [ap])))?.code).toBe("42501");
      await q(`update audita.training_files set status = 'removido' where id = $1`, [rot]);
      const r = (await q<{ status: string; removed_at: string | null }>(`select status, removed_at from audita.training_files where id = $1`, [rot]))[0];
      expect(r.status).toBe("removido");
      expect(r.removed_at).not.toBeNull();
      expect((await err(q(`update audita.training_files set status = 'ativo' where id = $1`, [rot])))?.code).toBe("42501");
    });
    await addFile(draft, m2.id, "roteiro", "L01_M02_Roteiro_v2.pdf");
  });

  it("publicar exige carga horária e apostila em todo módulo ativo; publicada fica congelada", async () => {
    await admin(async () => {
      expect((await err(q(`select audita.training_publish_version($1)`, [draft])))?.message).toContain("carga horária");
      await q(`update audita.training_versions set workload_minutes = 240, instructor_name = 'Instrutor Fictício' where id = $1`, [draft]);
      expect((await err(q(`select audita.training_publish_version($1)`, [draft])))?.message).toContain("apostila");
    });
    const mods = await admin(() => q<{ id: string; position: number }>(`select id, position from audita.training_modules where version_id = $1 and position <> 2`, [draft]));
    for (const m of mods) await addFile(draft, m.id, "apostila", `L01_M0${m.position}_Apostila.pdf`);
    await addFile(draft, null, "ficha_tecnica", "L01_Ficha_Tecnica.pdf");
    await admin(async () => {
      await q(`select audita.training_publish_version($1)`, [draft]);
      const v = (await q<{ status: string; published_at: string | null }>(`select status, published_at from audita.training_versions where id = $1`, [draft]))[0];
      expect(v.status).toBe("publicada");
      expect(v.published_at).not.toBeNull();
      expect((await err(q(`update audita.training_versions set title = 'Outro título qualquer' where id = $1`, [draft])))?.code).toBe("42501");
      expect((await err(q(`update audita.training_modules set title = 'Outro' where version_id = $1`, [draft])))?.code).toBe("42501");
      expect((await err(q(`update audita.training_versions set status = 'rascunho' where id = $1`, [draft])))?.code).toBe("42501");
      // Preço e prazo de acesso valem para o treinamento e podem mudar a qualquer momento
      await q(`update audita.training_courses set price = 197.00, access_days = 365 where id = $1`, [course]);
      expect((await err(q(`update audita.training_courses set course_code = 'L02' where id = $1`, [course])))?.code).toBe("42501");
    });
    expect((await err(addFile(draft, null, "plano_pedagogico", "L01_Plano.pdf")))?.code).toBe("42501");
  });

  it("nova versão copia a publicada; publicar a nova substitui a anterior; rascunho só é cancelado com motivo", async () => {
    const v2 = await admin(async () => (await q<{ id: string }>(`select audita.training_new_version($1, '1.3') id`, [course]))[0].id);
    await admin(async () => {
      expect((await err(q(`select audita.training_new_version($1, '1.4')`, [course])))?.message).toContain("rascunho");
      const src = await q<{ n: number }>(`select count(*)::int n from audita.training_files where version_id = $1 and status = 'ativo'`, [draft]);
      const dst = await q<{ n: number }>(`select count(*)::int n from audita.training_files where version_id = $1 and status = 'ativo'`, [v2]);
      expect(dst[0].n).toBe(src[0].n);
      const mods = await q<{ title: string; video_url: string | null }>(`select title, video_url from audita.training_modules where version_id = $1 order by position`, [v2]);
      expect(mods.map((m) => m.title)).toEqual(["Ambientação", "Fundamentos de SST", "Perigos e riscos"]);
      expect(mods[1].video_url).toBe("https://youtu.be/abcdefghijk");
      await q(`update audita.training_versions set summary = 'Resumo revisado.' where id = $1`, [v2]);
      await q(`select audita.training_publish_version($1)`, [v2]);
      const all = await q<{ version_label: string; status: string; status_note: string | null }>(
        `select version_label, status, status_note from audita.training_versions where course_id = $1 order by version_label`,
        [course],
      );
      expect(all.map((r) => [r.version_label, r.status])).toEqual([
        ["1.2", "substituida"],
        ["1.3", "publicada"],
      ]);
      expect(all[0].status_note).toContain("1.3");
      const v3 = (await q<{ id: string }>(`select audita.training_new_version($1, '1.4') id`, [course]))[0].id;
      expect((await err(q(`select audita.training_cancel_version($1, 'x')`, [v3])))?.code).toBe("23514");
      await q(`select audita.training_cancel_version($1, 'Versão aberta por engano')`, [v3]);
      expect((await q<{ status: string }>(`select status from audita.training_versions where id = $1`, [v3]))[0].status).toBe("cancelada");
    });
  });
});
