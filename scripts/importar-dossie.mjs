/**
 * Importa os documentos oficiais do dossiê para a Biblioteca (AUDDOC017 RF-19, FL-03).
 * - Confere tamanho e SHA-256 de cada arquivo contra scripts/dossie-manifest.json ANTES de enviar (aborta se divergir).
 * - Cria o documento (código permanente), envia o arquivo ao bucket privado e registra a Rev.00.
 * - Publica como vigente apenas o que o manifesto marca como aprovado; minutas ficam em rascunho (AUDDOC017 §18).
 * - Idempotente: documentos/revisões já existentes com o mesmo SHA-256 são mantidos.
 *
 * Uso: node scripts/importar-dossie.mjs "<pasta do dossiê 'Projeto AUDITA'>"
 * Credenciais: AUDITA_IMPORT_EMAIL/AUDITA_IMPORT_PASSWORD (ou TEST_ADMIN_* no desenvolvimento) e as variáveis públicas do Supabase.
 */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.argv[2];
if (!root) {
  console.error('Informe a pasta do dossiê: node scripts/importar-dossie.mjs "<.../Projeto AUDITA>"');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(new URL("./dossie-manifest.json", import.meta.url), "utf8"));
const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const safe = (n) =>
  n.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_");

// 1) Conferência integral antes de qualquer envio
const files = [];
for (const d of manifest.documents) {
  const path = join(root, d.file);
  const buf = readFileSync(path);
  const sha = createHash("sha256").update(buf).digest("hex");
  if (sha !== d.sha256 || statSync(path).size !== d.size) {
    console.error(`DIVERGÊNCIA em ${d.code} (${d.file}): SHA-256/tamanho diferente do manifesto. Nada foi importado.`);
    process.exit(2);
  }
  files.push({ ...d, buf });
}
console.log(`Conferência OK: ${files.length} arquivos idênticos ao manifesto.`);

const email = process.env.AUDITA_IMPORT_EMAIL ?? process.env.TEST_ADMIN_EMAIL;
const password = process.env.AUDITA_IMPORT_PASSWORD ?? process.env.TEST_ADMIN_PASSWORD;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: "audita" },
  auth: { persistSession: false },
});
const { error: authError } = await db.auth.signInWithPassword({ email, password });
if (authError) throw authError;

const ids = {};
let created = 0;
let skipped = 0;
for (const d of files) {
  const parentCode = /-ANX\d{2}$/.test(d.code) ? d.code.replace(/-ANX\d{2}$/, "") : null;
  let { data: doc } = await db.from("library_documents").select("id").eq("doc_code", d.code).maybeSingle();
  if (!doc) {
    const ins = await db
      .from("library_documents")
      .insert({
        doc_code: d.code,
        title: d.title,
        kind: parentCode ? "anexo" : "documento",
        parent_id: parentCode ? ids[parentCode] : null,
        family: d.family,
        phase: d.phase,
        visibility: "interno",
        notes: d.publish ? null : d.notes,
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(`${d.code}: ${ins.error.message}`);
    doc = ins.data;
  }
  ids[d.code] = doc.id;

  const { data: existing } = await db.from("library_revisions").select("id, sha256, status").eq("document_id", doc.id).eq("revision", d.revision).maybeSingle();
  if (existing) {
    if (existing.sha256 !== d.sha256) throw new Error(`${d.code} ${d.revision} já existe com outro arquivo — verifique antes de prosseguir.`);
    skipped++;
    console.log(`${d.code} ${d.revision}: já importado (${existing.status}).`);
    continue;
  }
  const ext = d.file.split(".").pop().toLowerCase();
  const storagePath = `library/${doc.id}/rev${d.revision.slice(4)}/${safe(basename(d.file))}`;
  const up = await db.storage.from("audita-biblioteca").upload(storagePath, d.buf, { contentType: MIME[ext], upsert: false });
  if (up.error && !/exists/i.test(up.error.message)) throw new Error(`${d.code}: envio falhou — ${up.error.message}`);
  const rev = await db
    .from("library_revisions")
    .insert({
      document_id: doc.id,
      revision: d.revision,
      approved_by: d.approved_by,
      approved_on: d.approved_on,
      issued_on: d.approved_on,
      storage_path: storagePath,
      original_name: basename(d.file),
      mime_type: MIME[ext],
      size_bytes: d.size,
      sha256: d.sha256,
      notes: d.notes,
    })
    .select("id")
    .single();
  if (rev.error) throw new Error(`${d.code}: ${rev.error.message}`);
  if (d.publish) {
    const pub = await db.rpc("publish_library_revision", { p_revision_id: rev.data.id });
    if (pub.error) throw new Error(`${d.code}: publicação falhou — ${pub.error.message}`);
  }
  created++;
  console.log(`${d.code} ${d.revision}: importado (${d.publish ? "vigente" : "RASCUNHO — " + (d.notes ?? "")}).`);
}
console.log(`Concluído: ${created} importados, ${skipped} já existentes.`);
