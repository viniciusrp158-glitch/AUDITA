/**
 * C1 — Artes com IA na Comunicação (D-08 decidida pelo Diretor em 27/10/2026). PGlite com todas as migrações:
 * pedido só com peça em rascunho, um pedido em andamento por peça, conclusão única, artes imutáveis e sem conteúdo
 * ativo, arte só da própria peça, operador sem acesso e o art_id congelado no snapshot da revisão.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb } from "../helpers/pglite";

const ADMIN = "00000000-0000-4000-8000-0000000002ad";
const MKT = "00000000-0000-4000-8000-0000000002ac";
const OPER = "00000000-0000-4000-8000-0000000002a0";
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="800"><rect width="1080" height="800" fill="#F3F4F6"/><text x="80" y="200">[TESTE] NR-35</text></svg>`;

describe("C1 — artes com IA (PGlite)", () => {
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
  const newPiece = () =>
    asUser(db, MKT, async () => (await q<{ id: string }>(`insert into audita.comm_pieces (template, brand, theme, channel, title, is_test) values ('post_quadrado', 'audita', '[TESTE] NR-35', 'instagram', '[TESTE] Título', true) returning id`))[0].id);

  beforeAll(async () => {
    db = await migratedDb();
    await db.exec(`
      insert into auth.users (id, email) values ('${ADMIN}', 'a2@exemplo.test'), ('${MKT}', 'm2@exemplo.test'), ('${OPER}', 'o2@exemplo.test');
      insert into audita.app_users (user_id, full_name, role) values
        ('${ADMIN}', '[TESTE] Admin', 'admin'), ('${MKT}', '[TESTE] Marketing', 'marketing'), ('${OPER}', '[TESTE] Operador', 'operador');
    `);
  }, 120000);
  afterAll(async () => db?.close());

  it("pedido → arte → peça aponta para a arte; conclusão única e arte imutável", async () => {
    const piece = await newPiece();
    await asUser(db, MKT, async () => {
      const req = (await q<{ id: string; status: string }>(`insert into audita.comm_ai_requests (piece_id, mode, instruction, status, is_test) values ($1, 'criar', '[TESTE] Propaganda de NR-35', 'concluida', true) returning id, status`, [piece]))[0];
      expect(req.status).toBe("gerando"); // a situação inicial é sempre "gerando"
      // Um pedido em andamento por peça
      expect((await err(db.query(`insert into audita.comm_ai_requests (piece_id, mode, instruction) values ($1, 'ajustar', '[TESTE] outro')`, [piece])))?.code).toBe("23505");
      // Conteúdo ativo é recusado
      expect(await err(db.query(`insert into audita.comm_piece_arts (piece_id, request_id, svg) values ($1, $2, $3)`, [piece, req.id, SVG.replace("<rect", "<script>alert(1)</script><rect")]))).not.toBeNull();
      const art = (await q<{ id: string; is_test: boolean }>(`insert into audita.comm_piece_arts (piece_id, request_id, svg, alt_text) values ($1, $2, $3, '[TESTE]') returning id, is_test`, [piece, req.id, SVG]))[0];
      expect(art.is_test).toBe(true);
      await db.query(`update audita.comm_pieces set art_id = $2 where id = $1`, [piece, art.id]);
      await db.query(`update audita.comm_ai_requests set status = 'concluida', model = 'claude-opus-5-5' where id = $1`, [req.id]);
      const done = (await q<{ finished_at: string | null }>(`select finished_at from audita.comm_ai_requests where id = $1`, [req.id]))[0];
      expect(done.finished_at).not.toBeNull();
      // Pedido concluído fica fora da política de alteração: a mudança não atinge nenhuma linha
      await db.query(`update audita.comm_ai_requests set status = 'erro' where id = $1`, [req.id]);
      expect((await q<{ status: string }>(`select status from audita.comm_ai_requests where id = $1`, [req.id]))[0].status).toBe('concluida');
      expect(await err(db.query(`update audita.comm_piece_arts set svg = $2 where id = $1`, [art.id, SVG]))).not.toBeNull();
      expect(await err(db.query(`delete from audita.comm_piece_arts where id = $1`, [art.id]))).not.toBeNull();
      // Arte nova exige um pedido em andamento
      expect(await err(db.query(`insert into audita.comm_piece_arts (piece_id, request_id, svg) values ($1, $2, $3)`, [piece, req.id, SVG]))).not.toBeNull();
    });
    // O envio para revisão congela o art_id no snapshot
    await asUser(db, MKT, async () => {
      const vid = (await q<{ v: string }>(`select audita.submit_comm_piece($1) as v`, [piece]))[0].v;
      const snap = (await q<{ art: string | null }>(`select snapshot #>> '{piece,art_id}' as art from audita.comm_piece_versions where id = $1`, [vid]))[0];
      expect(snap.art).not.toBeNull();
      // Peça em revisão não recebe novo pedido
      expect((await err(db.query(`insert into audita.comm_ai_requests (piece_id, mode, instruction) values ($1, 'ajustar', '[TESTE] ajuste')`, [piece])))?.code).toBe("22023");
    });
  });

  it("imagens enviadas: só com pedido em andamento, uma foto de fundo por pedido, imutáveis e da própria peça", async () => {
    const piece = await newPiece();
    const other = await newPiece();
    const B64 = "A".repeat(200);
    await asUser(db, MKT, async () => {
      const req = (await q<{ id: string }>(`insert into audita.comm_ai_requests (piece_id, mode, instruction) values ($1, 'criar', '[TESTE] com foto') returning id`, [piece]))[0].id;
      const ref = (await q<{ id: string }>(`insert into audita.comm_ai_references (request_id, piece_id, position, mime_type, data_base64, width, height, use_as_background) values ($1, $2, 1, 'image/jpeg', $3, 1600, 900, true) returning id`, [req, piece, B64]))[0].id;
      // Segunda foto de fundo no mesmo pedido é recusada
      expect((await err(db.query(`insert into audita.comm_ai_references (request_id, piece_id, position, mime_type, data_base64, width, height, use_as_background) values ($1, $2, 2, 'image/jpeg', $3, 10, 10, true)`, [req, piece, B64])))?.code).toBe("23505");
      // Tipo fora da lista é recusado
      expect(await err(db.query(`insert into audita.comm_ai_references (request_id, piece_id, position, mime_type, data_base64, width, height) values ($1, $2, 2, 'image/svg+xml', $3, 10, 10)`, [req, piece, B64]))).not.toBeNull();
      expect(await err(db.query(`update audita.comm_ai_references set width = 1 where id = $1`, [ref]))).not.toBeNull();
      const art = (await q<{ id: string }>(`insert into audita.comm_piece_arts (piece_id, request_id, svg, background_ref_id) values ($1, $2, $3, $4) returning id`, [piece, req, SVG, ref]))[0].id;
      expect(art).toBeTruthy();
      // Foto de fundo de outra peça é recusada
      const req2 = (await q<{ id: string }>(`insert into audita.comm_ai_requests (piece_id, mode, instruction) values ($1, 'criar', '[TESTE] outra') returning id`, [other]))[0].id;
      expect((await err(db.query(`insert into audita.comm_piece_arts (piece_id, request_id, svg, background_ref_id) values ($1, $2, $3, $4)`, [other, req2, SVG, ref])))?.code).toBe("23514");
    });
  });

  it("a peça não aponta para arte de outra peça; operador não vê nem cria", async () => {
    const a = await newPiece();
    const b = await newPiece();
    const artA = await asUser(db, MKT, async () => {
      const r = (await q<{ id: string }>(`insert into audita.comm_ai_requests (piece_id, mode, instruction) values ($1, 'criar', '[TESTE] A') returning id`, [a]))[0].id;
      return (await q<{ id: string }>(`insert into audita.comm_piece_arts (piece_id, request_id, svg) values ($1, $2, $3) returning id`, [a, r, SVG]))[0].id;
    });
    await asUser(db, MKT, async () => {
      expect((await err(db.query(`update audita.comm_pieces set art_id = $2 where id = $1`, [b, artA])))?.code).toBe("23514");
    });
    await asUser(db, OPER, async () => {
      expect(await q(`select id from audita.comm_piece_arts`)).toHaveLength(0);
      expect(await err(db.query(`insert into audita.comm_ai_requests (piece_id, mode, instruction) values ($1, 'criar', '[TESTE] op')`, [b]))).not.toBeNull();
    });
  });
});
