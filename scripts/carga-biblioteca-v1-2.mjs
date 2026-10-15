/**
 * V1.2 — Carga da Biblioteca a partir do caderno de pendências (14/10/2026):
 *  - D10.02: Rev.01 do AUDDOC014 e do AUDDOC015 corrigindo só a propriedade de título do arquivo Word (conteúdo igual);
 *  - AUDDOC018 (Modelos Operacionais de SST e Treinamento) e seus anexos ANX01–ANX10, Rev.00 aprovada em 12/10/2026;
 *  - D10.01: envio do arquivo aprovado do AUDDOC001 Rev.00 (modo "auddoc001-envio"); a troca do arquivo da minuta e a
 *    publicação são feitas em seguida (ver docs/HISTORICO.md, V1.2).
 * Idempotente: o que já existe com o mesmo SHA-256 é mantido. Credenciais: AUDITA_IMPORT_* (ou TEST_ADMIN_* no desenvolvimento).
 *
 * Uso: node scripts/carga-biblioteca-v1-2.mjs <pasta com os arquivos> [auddoc001-envio|auddoc001-publicar]
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";

const dir = process.argv[2];
const mode = process.argv[3] ?? "carga";
if (!dir) {
  console.error("Uso: node scripts/carga-biblioteca-v1-2.mjs <pasta> [auddoc001-envio|auddoc001-publicar]");
  process.exit(1);
}
const DIRETOR = "Vinicius Rocha Pereira — Diretor";
const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const sha = (b) => createHash("sha256").update(b).digest("hex");
const safe = (n) => n.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: "audita" },
  auth: { persistSession: false },
});
const { error: authError } = await db.auth.signInWithPassword({
  email: process.env.AUDITA_IMPORT_EMAIL ?? process.env.TEST_ADMIN_EMAIL,
  password: process.env.AUDITA_IMPORT_PASSWORD ?? process.env.TEST_ADMIN_PASSWORD,
});
if (authError) throw authError;

async function docId(code, meta) {
  const { data } = await db.from("library_documents").select("id").eq("doc_code", code).maybeSingle();
  if (data) return data.id;
  if (!meta) throw new Error(`${code} não existe na Biblioteca.`);
  const ins = await db.from("library_documents").insert({ doc_code: code, visibility: "interno", ...meta }).select("id").single();
  if (ins.error) throw new Error(`${code}: ${ins.error.message}`);
  return ins.data.id;
}

async function addRevision(id, code, revision, name, buf, notes, approvedOn, publish = true) {
  const { data: existing } = await db.from("library_revisions").select("id, sha256, status").eq("document_id", id).eq("revision", revision).maybeSingle();
  if (existing) {
    if (existing.sha256 !== sha(buf)) throw new Error(`${code} ${revision} já existe com outro arquivo.`);
    console.log(`${code} ${revision}: já carregado (${existing.status}).`);
    return existing.id;
  }
  const ext = name.split(".").pop().toLowerCase();
  const path = `library/${id}/rev${revision.slice(4)}/${safe(name)}`;
  const up = await db.storage.from("audita-biblioteca").upload(path, buf, { contentType: MIME[ext], upsert: false });
  if (up.error && !/exists/i.test(up.error.message)) throw new Error(`${code}: envio falhou — ${up.error.message}`);
  const rev = await db
    .from("library_revisions")
    .insert({
      document_id: id,
      revision,
      approved_by: DIRETOR,
      approved_on: approvedOn,
      issued_on: approvedOn,
      storage_path: path,
      original_name: name,
      mime_type: MIME[ext],
      size_bytes: buf.length,
      sha256: sha(buf),
      notes,
    })
    .select("id")
    .single();
  if (rev.error) throw new Error(`${code}: ${rev.error.message}`);
  if (publish) {
    const pub = await db.rpc("publish_library_revision", { p_revision_id: rev.data.id });
    if (pub.error) throw new Error(`${code}: publicação falhou — ${pub.error.message}`);
  }
  console.log(`${code} ${revision}: carregado${publish ? " e publicado (vigente)" : ""} — SHA-256 ${sha(buf)}.`);
  return rev.data.id;
}

if (mode === "auddoc001-envio") {
  const name = "AUDDOC001_Padrao-de-Documentos-AUDITA_Rev00.docx";
  const buf = readFileSync(join(dir, name));
  const id = await docId("AUDDOC001");
  const path = `library/${id}/rev00/${name}`;
  const up = await db.storage.from("audita-biblioteca").upload(path, buf, { contentType: MIME.docx, upsert: false });
  if (up.error && !/exists/i.test(up.error.message)) throw up.error;
  console.log(JSON.stringify({ path, size: buf.length, sha256: sha(buf), name }));
  process.exit(0);
}
if (mode === "auddoc001-publicar") {
  const id = await docId("AUDDOC001");
  const { data } = await db.from("library_revisions").select("id, status").eq("document_id", id).eq("revision", "Rev.00").single();
  if (data.status !== "vigente") {
    const pub = await db.rpc("publish_library_revision", { p_revision_id: data.id });
    if (pub.error) throw pub.error;
  }
  console.log("AUDDOC001 Rev.00 vigente.");
  process.exit(0);
}

// 1) D10.02 — Rev.01 do AUDDOC014 e do AUDDOC015: só a propriedade de título
const TITLES = {
  AUDDOC014: "AUDDOC014 — Plano de Homologação dos Sistemas Audita PRO e Audita HUB — Rev.01",
  AUDDOC015: "AUDDOC015 — Verificação de Prontidão Operacional da AUDITA — Rev.01",
};
for (const code of ["AUDDOC014", "AUDDOC015"]) {
  const id = await docId(code);
  const { data: r0 } = await db.from("library_revisions").select("storage_path, original_name").eq("document_id", id).eq("revision", "Rev.00").single();
  const dl = await db.storage.from("audita-biblioteca").download(r0.storage_path);
  if (dl.error) throw dl.error;
  const zip = await JSZip.loadAsync(Buffer.from(await dl.data.arrayBuffer()));
  const core = await zip.file("docProps/core.xml").async("string");
  const fixed = core.replace(/<dc:title>[^<]*<\/dc:title>/, `<dc:title>${TITLES[code]}</dc:title>`);
  if (fixed === core && !core.includes("<dc:title>")) throw new Error(`${code}: arquivo sem propriedade de título.`);
  zip.file("docProps/core.xml", fixed);
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await addRevision(
    id,
    code,
    "Rev.01",
    r0.original_name.replace("Rev00", "Rev01"),
    buf,
    "Revisão controlada (caderno D10.02): corrige apenas a propriedade interna de título do arquivo Word ('Minuta v0.1'); conteúdo idêntico à Rev.00.",
    "2026-10-14",
  );
}

// 2) AUDDOC018 e anexos — modelos aprovados em 12/10/2026
const FILES = [
  ["AUDDOC018-ANX01", "Lista de Presença de Treinamento", "AUDDOC018-ANX01 - Lista de Presenca.docx"],
  ["AUDDOC018-ANX02", "Avaliação de Aprendizagem", "AUDDOC018-ANX02 - Avaliacao de Aprendizagem.docx"],
  ["AUDDOC018-ANX03", "Certificado de Capacitação", "AUDDOC018-ANX03 - Certificado de Capacitacao.pptx"],
  ["AUDDOC018-ANX04", "Avaliação de Resultado e Desempenho", "AUDDOC018-ANX04 - Avaliacao de Resultado e Desempenho.docx"],
  ["AUDDOC018-ANX05", "Checklist de Inspeção de SST", "AUDDOC018-ANX05 - Checklist de Inspecao de SST.docx"],
  ["AUDDOC018-ANX06", "Permissão de Trabalho (PT)", "AUDDOC018-ANX06 - Permissao de Trabalho.xlsx"],
  ["AUDDOC018-ANX07", "Análise Preliminar de Riscos (APR)", "AUDDOC018-ANX07 - Analise Preliminar de Riscos.xlsx"],
  ["AUDDOC018-ANX08", "Ficha de Controle de Entrega de EPI", "AUDDOC018-ANX08 - Ficha de Controle de Entrega de EPI.xlsx"],
  ["AUDDOC018-ANX09", "Relatório Técnico", "AUDDOC018-ANX09 - Relatorio Tecnico.docx"],
  ["AUDDOC018-ANX10", "Ordem de Serviço de SST", "AUDDOC018-ANX10 - Ordem de Servico de SST.docx"],
];
const parent = await docId("AUDDOC018", {
  title: "Modelos Operacionais de SST e Treinamento",
  kind: "documento",
  parent_id: null,
  family: "Operação",
  phase: "fase2",
  notes: "Família de modelos operacionais aprovada pelo Diretor em 12/10/2026 (anexos ANX01 a ANX10). Os arquivos estão nos anexos.",
});
console.log(`AUDDOC018: documento ${parent} (os arquivos estão nos anexos).`);
for (const [code, title, file] of FILES) {
  const id = await docId(code, { title, kind: "anexo", parent_id: parent, family: "Operação", phase: "fase2", notes: null });
  await addRevision(id, code, "Rev.00", file.replace(/ - /, "_").replace(/ /g, "_"), readFileSync(join(dir, file)), "Modelo aprovado pelo Diretor em 12/10/2026.", "2026-10-12");
}
console.log("Carga V1.2 concluída.");
