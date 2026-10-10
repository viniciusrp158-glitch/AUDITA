/**
 * I7 — Biblioteca documental por chamada direta à API (AUDDOC017 RF-19 a RF-22, RF-24, CA-09, CA-10).
 * Ambiente de DESENVOLVIMENTO; documentos de teste usam códigos AUDDOC9NN e título "[TESTE]".
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ready = Boolean(url && key && process.env.TEST_ADMIN_EMAIL && process.env.TEST_INTRUSO_EMAIL);
const BUCKET = "audita-biblioteca";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function client() {
  return createClient(url!, key!, { db: { schema: "audita" }, auth: { persistSession: false, autoRefreshToken: false } });
}
async function signedIn(email: string, password: string) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return c;
}
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describe.skipIf(!ready)("I7 — biblioteca documental", () => {
  type C = ReturnType<typeof client>;
  let admin: C;
  let intruso: C;
  let anon: C;

  const rand = (n: number) => Math.floor(Math.random() * n);

  /** Documento principal de teste AUDDOC9NN (reutilizado entre execuções — códigos são permanentes). */
  async function testParent(nn = rand(100)) {
    const code = `AUDDOC9${String(nn).padStart(2, "0")}`;
    const found = await admin.from("library_documents").select("id, doc_code").eq("doc_code", code).maybeSingle();
    if (found.data) return found.data;
    const r = await admin
      .from("library_documents")
      .insert({ doc_code: code, title: `[TESTE] Documento fictício ${code}`, family: "Teste", phase: "fase3" })
      .select("id, doc_code")
      .single();
    if (r.error && r.error.code !== "23505") throw new Error(r.error.message);
    return r.data ?? (await admin.from("library_documents").select("id, doc_code").eq("doc_code", code).single()).data!;
  }

  /** Documento de teste novo: anexo AUDDOC9NN-ANXMM sob um principal de teste (≈ 9.900 códigos livres). */
  async function newDoc() {
    for (let i = 0; i < 40; i++) {
      const parent = await testParent();
      const code = `${parent.doc_code}-ANX${String(1 + rand(99)).padStart(2, "0")}`;
      const r = await admin
        .from("library_documents")
        .insert({ doc_code: code, title: `[TESTE] Anexo fictício ${code}`, family: "Teste", phase: "fase3", kind: "anexo", parent_id: parent.id })
        .select("id, doc_code")
        .single();
      if (!r.error) return r.data!;
      if (r.error.code !== "23505") throw new Error(r.error.message);
    }
    throw new Error("Sem código de teste livre");
  }

  /** Envia um arquivo fictício ao bucket e registra a revisão (rascunho). */
  async function addRevision(docId: string, revision: string, content = `conteúdo ${revision} ${Date.now()}`, extra: Record<string, unknown> = {}) {
    const buf = Buffer.from(content);
    const path = `library/${docId}/rev${revision.slice(4)}/${Date.now()}_teste.docx`;
    const up = await admin.storage.from(BUCKET).upload(path, buf, { contentType: DOCX, upsert: false });
    if (up.error) throw new Error(up.error.message);
    const r = await admin
      .from("library_revisions")
      .insert({ document_id: docId, revision, storage_path: path, original_name: "teste.docx", mime_type: DOCX, size_bytes: buf.length, sha256: sha(buf), ...extra })
      .select("id, status")
      .single();
    return { ...r, path, buf };
  }

  const approve = (id: string) =>
    admin.from("library_revisions").update({ approved_by: "[TESTE] Diretor", approved_on: "2026-10-10", issued_on: "2026-10-10" }).eq("id", id);

  beforeAll(async () => {
    admin = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    intruso = await signedIn(process.env.TEST_INTRUSO_EMAIL!, process.env.TEST_INTRUSO_PASSWORD!);
    anon = client();
  });

  it("RF-19: código no padrão AUDDOC; anexo exige documento principal; código e vínculo permanentes", async () => {
    const bad = await admin.from("library_documents").insert({ doc_code: "DOC-1", title: "[TESTE] x", family: "Teste", phase: "fase3" }).select();
    expect(bad.error?.code).toBe("23514");
    const annexCode = (await newDoc()).doc_code.replace(/-ANX\d{2}$/, "-ANX00");
    const orphan = await admin
      .from("library_documents")
      .insert({ doc_code: annexCode, title: "[TESTE] anexo", family: "Teste", phase: "fase3", kind: "anexo" })
      .select();
    expect(orphan.error?.code).toBe("23514");
    const notAnnex = await admin.from("library_documents").insert({ doc_code: annexCode, title: "[TESTE] x", family: "Teste", phase: "fase3", kind: "documento" }).select();
    expect(notAnnex.error?.code).toBe("23514");
    const annex = await newDoc();
    // Trocar o documento principal (para outro AUDDOC9NN) é recusado: vínculo permanente
    const otherParent = await testParent((Number(annex.doc_code.slice(7, 9)) + 1) % 100);
    const moved = await admin.from("library_documents").update({ parent_id: otherParent.id }).eq("id", annex.id).select();
    expect(moved.error?.code).toBe("42501");
    const rename = await admin.from("library_documents").update({ doc_code: "AUDDOC998" }).eq("id", annex.id).select();
    expect(rename.error?.code).toBe("42501");
    expect((await admin.from("library_documents").delete().eq("id", annex.id).select()).data ?? []).toHaveLength(0);
  });

  it("revisão só existe com arquivo no bucket privado, no caminho do próprio documento", async () => {
    const d = await newDoc();
    const ghost = await admin
      .from("library_revisions")
      .insert({ document_id: d.id, revision: "Rev.00", storage_path: `library/${d.id}/rev00/inexistente.docx`, original_name: "x.docx", mime_type: DOCX, size_bytes: 1, sha256: "0".repeat(64) })
      .select();
    expect(ghost.error?.message).toContain("Arquivo não encontrado");
    const other = await newDoc();
    const buf = Buffer.from("x");
    const wrongPath = `library/${other.id}/rev00/${Date.now()}_x.docx`;
    await admin.storage.from(BUCKET).upload(wrongPath, buf, { contentType: DOCX });
    const outside = await admin
      .from("library_revisions")
      .insert({ document_id: d.id, revision: "Rev.00", storage_path: wrongPath, original_name: "x.docx", mime_type: DOCX, size_bytes: 1, sha256: sha(buf) })
      .select();
    expect(outside.error?.message).toContain("fora do documento");
  });

  it("FL-03 / CA-09: rascunho → vigente só com aprovação; nova revisão substitui sem apagar a anterior", async () => {
    const d = await newDoc();
    const r0 = await addRevision(d.id, "Rev.00", "versão zero");
    expect(r0.error).toBeNull();
    expect(r0.data!.status).toBe("rascunho");
    expect((await admin.from("library_revisions").update({ status: "vigente" }).eq("id", r0.data!.id)).error?.code).toBe("42501");
    expect((await admin.rpc("publish_library_revision", { p_revision_id: r0.data!.id })).error?.message).toContain("aprovou");
    await approve(r0.data!.id);
    expect((await admin.rpc("publish_library_revision", { p_revision_id: r0.data!.id })).error).toBeNull();

    const r1 = await addRevision(d.id, "Rev.01", "versão um");
    await approve(r1.data!.id);
    expect((await admin.rpc("publish_library_revision", { p_revision_id: r1.data!.id })).error).toBeNull();

    const revs = (await admin.from("library_revisions").select("revision, status, status_note").eq("document_id", d.id).order("revision")).data!;
    expect(revs.map((r) => [r.revision, r.status])).toEqual([
      ["Rev.00", "substituido"],
      ["Rev.01", "vigente"],
    ]);
    expect(revs[0].status_note).toContain("Substituída pela Rev.01");
    // A anterior continua acessível e íntegra
    const dl = await admin.storage.from(BUCKET).download(r0.path);
    expect(sha(Buffer.from(await dl.data!.arrayBuffer()))).toBe(sha(r0.buf));
    // Mesma revisão não pode ser enviada duas vezes
    const dup = await addRevision(d.id, "Rev.01", "outra");
    expect(dup.error?.code).toBe("23505");
  });

  it("revisão publicada é imutável (arquivo, SHA-256 e metadados); arquivo nunca muda nem mesmo no rascunho", async () => {
    const d = await newDoc();
    const r = await addRevision(d.id, "Rev.00");
    expect((await admin.from("library_revisions").update({ sha256: "f".repeat(64) }).eq("id", r.data!.id)).error?.code).toBe("42501");
    await approve(r.data!.id);
    await admin.rpc("publish_library_revision", { p_revision_id: r.data!.id });
    expect((await admin.from("library_revisions").update({ notes: "alterar" }).eq("id", r.data!.id)).error?.code).toBe("42501");
    expect((await admin.from("library_revisions").delete().eq("id", r.data!.id).select()).data ?? []).toHaveLength(0);
  });

  it("cancelamento só de rascunho e com motivo; o registro permanece", async () => {
    const d = await newDoc();
    const r = await addRevision(d.id, "Rev.00");
    expect((await admin.rpc("cancel_library_revision", { p_revision_id: r.data!.id, p_reason: "" })).error?.message).toContain("motivo");
    expect((await admin.rpc("cancel_library_revision", { p_revision_id: r.data!.id, p_reason: "[TESTE] arquivo errado" })).error).toBeNull();
    const row = (await admin.from("library_revisions").select("status, status_note").eq("id", r.data!.id).single()).data!;
    expect(row).toEqual({ status: "cancelado", status_note: "[TESTE] arquivo errado" });
    expect((await admin.rpc("publish_library_revision", { p_revision_id: r.data!.id })).error?.message).toContain("Somente rascunhos");
  });

  it("CA-10: anônimo e não autorizado não leem nada; sem sobrescrita nem exclusão; download vai para a trilha", async () => {
    const d = await newDoc();
    const r = await addRevision(d.id, "Rev.00");
    for (const c of [anon, intruso]) {
      expect((await c.storage.from(BUCKET).download(r.path)).data).toBeNull();
      expect((await c.storage.from(BUCKET).createSignedUrl(r.path, 60)).data).toBeNull();
      for (const t of ["library_documents", "library_revisions"]) expect((await c.from(t).select("id").limit(3)).data ?? [], t).toHaveLength(0);
      expect((await c.from("library_documents").insert({ doc_code: "AUDDOC997", title: "invasão", family: "x", phase: "fase3" }).select()).error).not.toBeNull();
      expect((await c.rpc("publish_library_revision", { p_revision_id: r.data!.id })).error).not.toBeNull();
    }
    expect((await admin.storage.from(BUCKET).upload(r.path, Buffer.from("y"), { contentType: DOCX, upsert: true })).error).not.toBeNull();
    expect((await admin.storage.from(BUCKET).remove([r.path])).data ?? []).toHaveLength(0);
    expect((await admin.storage.from(BUCKET).upload(`outros/${Date.now()}.docx`, Buffer.from("z"), { contentType: DOCX })).error).not.toBeNull();

    expect((await admin.rpc("log_library_download", { p_revision_id: r.data!.id })).error).toBeNull();
    const log = await admin.from("audit_log").select("action, parent_entity_id").eq("entity", "library_revisions").eq("entity_id", r.data!.id).eq("action", "download");
    expect(log.data).toEqual([{ action: "download", parent_entity_id: d.id }]);
  });

  it("acervo oficial (quando importado): minuta não vigente; modelos M01/M02 com o mesmo SHA-256 do anexo vigente", async () => {
    const { data: docs } = await admin
      .from("library_documents")
      .select("doc_code, library_revisions(status, sha256)")
      .in("doc_code", ["AUDDOC001", "AUDDOC010-ANX01", "AUDDOC010-ANX02"]);
    if (!docs || docs.length < 3) return; // importação ainda não executada neste banco
    const by = Object.fromEntries(docs.map((d) => [d.doc_code, d.library_revisions as { status: string; sha256: string }[]]));
    expect(by.AUDDOC001.some((r) => r.status === "vigente")).toBe(false);
    const tpl = (await admin.from("document_templates").select("template_code, source_sha256")).data!;
    for (const t of tpl) {
      const vig = by[t.template_code].find((r) => r.status === "vigente");
      expect(vig?.sha256, t.template_code).toBe(t.source_sha256);
    }
  });
});
