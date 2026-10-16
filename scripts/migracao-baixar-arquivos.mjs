/**
 * Migração para a VPS (guia GUIA-SISTEMA-AUDITA, passo 4 — Storage): baixa do Supabase em nuvem (audita-dev) os arquivos
 * que o sistema usa — revisões da Biblioteca e logos da marca — para a pasta _migracao/, conferindo o SHA-256 de cada um
 * com o registro do banco. Não altera nada na nuvem. Entra com o login de um administrador (pedido na tela; a senha não
 * aparece). Uso (na pasta do projeto): node scripts/migracao-baixar-arquivos.mjs
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : s.replace(/[^\r\n]/g, "*"));
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

console.log("Cópia dos arquivos da Biblioteca e da marca (banco audita-dev em nuvem) para a pasta _migracao.\n");
const email = await ask("Seu e-mail de acesso ao sistema: ");
const password = await ask("Sua senha (não aparece na tela): ", true);

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: "audita" },
  auth: { persistSession: false },
});
const { error: authError } = await db.auth.signInWithPassword({ email, password });
if (authError) throw new Error(`Não foi possível entrar: ${authError.message}`);

const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};
const revisions = must(await db.from("library_revisions").select("storage_path, sha256"), "revisões da Biblioteca");
const logos = must(await db.from("brand_asset_versions").select("storage_path, sha256"), "versões de logo");
const files = [
  ...revisions.map((r) => ({ bucket: "audita-biblioteca", ...r })),
  ...logos.map((r) => ({ bucket: "audita-marca", ...r })),
];

let ok = 0;
for (const f of files) {
  const { data, error } = await db.storage.from(f.bucket).download(f.storage_path);
  if (error) throw new Error(`Falha ao baixar ${f.bucket}/${f.storage_path}: ${error.message}`);
  const buf = Buffer.from(await data.arrayBuffer());
  const sha = createHash("sha256").update(buf).digest("hex");
  if (f.sha256 && sha !== f.sha256) throw new Error(`SHA-256 diferente do registro em ${f.storage_path}`);
  const dest = join("_migracao", f.bucket, f.storage_path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  ok++;
}
console.log(`\n${ok} arquivo(s) baixado(s) e conferido(s) pelo SHA-256 em _migracao/. Avise o Claude.`);
