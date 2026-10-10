/**
 * I9 — Teste de cópia de segurança e restauração (AUDDOC017 §10: "Backups e recuperação testável antes da operação com dados reais").
 *
 * 1. CÓPIA  — com o login do administrador (sem chave privilegiada): exporta todas as tabelas do schema `audita`
 *             em CSV (texto exato do Postgres, sem perda de casas decimais) e baixa todos os arquivos dos buckets
 *             privados, conferindo o SHA-256 de cada um com o registrado no banco.
 * 2. RESTAURAÇÃO — num Postgres separado e descartável (PGlite, em memória): recria a estrutura aplicando as
 *             migrações do repositório na ordem, carrega os dados e confere, tabela a tabela, quantidade de linhas e
 *             assinatura MD5 do conteúdo; depois executa funções do sistema sobre a base restaurada.
 *
 * Uso: node scripts/backup-restauracao.mjs <pasta-de-saída>
 * Saída: <pasta>/dados/*.csv, <pasta>/arquivos/<bucket>/..., <pasta>/relatorio.json
 * As assinaturas impressas podem ser comparadas com a mesma consulta executada no banco de origem (ver SQL_ASSINATURA).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const out = process.argv[2];
if (!out) {
  console.error("Informe a pasta de saída: node scripts/backup-restauracao.mjs <pasta>");
  process.exit(1);
}
const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key } = process.env;
const email = process.env.AUDITA_BACKUP_EMAIL ?? process.env.TEST_ADMIN_EMAIL;
const password = process.env.AUDITA_BACKUP_PASSWORD ?? process.env.TEST_ADMIN_PASSWORD;
const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const started = new Date();

/** Mesma expressão usada no banco de origem e no restaurado. */
export const SQL_ASSINATURA = (t) =>
  `select count(*)::int as n, md5(coalesce(string_agg(x.t, E'\\n' order by x.t), '')) as md5 from (select r::text as t from audita.${t} r) x`;

const sb = createClient(url, key, { db: { schema: "audita" }, auth: { persistSession: false, autoRefreshToken: false } });
const login = await sb.auth.signInWithPassword({ email, password });
if (login.error) throw new Error(`Login: ${login.error.message}`);

// ---------------------------------------------------------------- 1. CÓPIA: tabelas
const check = await sb.rpc("security_self_check");
if (check.error) throw new Error(check.error.message);
const tables = check.data.tables.map((t) => t.name);
mkdirSync(join(out, "dados"), { recursive: true });
const exported = {};
for (const t of tables) {
  const probe = await sb.from(t).select("*", { count: "exact", head: true });
  if (probe.error) throw new Error(`${t}: ${probe.error.message}`);
  const total = probe.count ?? 0;
  const first = await sb.from(t).select("*").limit(1);
  const cols = first.data?.[0] ? Object.keys(first.data[0]) : [];
  const orderCol = cols.includes("id") ? "id" : cols[0];
  let header = null;
  const lines = [];
  for (let from = 0; from < Math.max(total, 1); from += 1000) {
    let q = sb.from(t).select("*");
    if (orderCol) q = q.order(orderCol, { ascending: true });
    const page = await q.range(from, from + 999).csv();
    if (page.error) throw new Error(`${t}: ${page.error.message}`);
    const text = page.data ?? "";
    const nl = text.indexOf("\n");
    const h = nl < 0 ? text : text.slice(0, nl);
    header ??= h;
    if (nl >= 0) lines.push(text.slice(nl + 1));
  }
  const csv = [header, ...lines.filter(Boolean)].join("\n");
  writeFileSync(join(out, "dados", `${t}.csv`), csv);
  exported[t] = { linhas: total };
}

// ---------------------------------------------------------------- 1. CÓPIA: arquivos
async function listAll(bucket, prefix) {
  const res = [];
  for (let offset = 0; ; offset += 100) {
    const l = await sb.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (l.error) throw new Error(`${bucket}/${prefix}: ${l.error.message}`);
    for (const e of l.data) {
      const p = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id) res.push(p);
      else res.push(...(await listAll(bucket, p)));
    }
    if (l.data.length < 100) break;
  }
  return res;
}
const expectedSha = new Map();
for (const [t, bucket] of [["generated_documents", "audita-documentos"], ["library_revisions", "audita-biblioteca"]]) {
  const r = await sb.from(t).select("storage_path, sha256").limit(10000);
  if (r.error) throw new Error(r.error.message);
  for (const row of r.data) expectedSha.set(`${bucket}/${row.storage_path}`, row.sha256);
}
const files = [];
for (const bucket of ["audita-documentos", "audita-biblioteca"]) {
  for (const path of await listAll(bucket, "")) {
    const d = await sb.storage.from(bucket).download(path);
    if (d.error) throw new Error(`${bucket}/${path}: ${d.error.message}`);
    const buf = Buffer.from(await d.data.arrayBuffer());
    const sha = createHash("sha256").update(buf).digest("hex");
    const dest = join(out, "arquivos", bucket, path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, buf);
    const exp = expectedSha.get(`${bucket}/${path}`) ?? null;
    files.push({ bucket, path, bytes: buf.length, sha256: sha, registrado: exp, confere: exp === null ? null : exp === sha });
  }
}
await sb.auth.signOut();

// ---------------------------------------------------------------- 2. RESTAURAÇÃO em Postgres separado
const db = await PGlite.create({ extensions: { pg_trgm, pgcrypto, unaccent } });
await db.exec(`
  set timezone = 'UTC';
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role authenticator nologin;
  create schema extensions;
  -- Estruturas mínimas que o Supabase fornece (auth e storage) — apenas o necessário às migrações
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid, created_at timestamptz default now());
  alter table storage.objects enable row level security;
`);
const migrations = readdirSync(join(ROOT, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
for (const f of migrations) {
  const sql = readFileSync(join(ROOT, "supabase", "migrations", f), "utf8").replace(/^\s*notify\s+pgrst.*$/gim, "");
  try {
    await db.exec(sql);
  } catch (e) {
    throw new Error(`Migração ${f} falhou na restauração: ${e.message}`);
  }
}

// usuários (Auth é gerido pelo Supabase; aqui só os IDs referenciados) e objetos do Storage
await db.exec(`set session_replication_role = replica;`);
for (const f of files) await db.query("insert into storage.objects (bucket_id, name) values ($1, $2)", [f.bucket, f.path]);

// dados: CSV → tabela de passagem → tabela final (colunas geradas são recalculadas pelo banco restaurado)
for (const t of tables) {
  const csv = readFileSync(join(out, "dados", `${t}.csv`), "utf8");
  const header = csv.split("\n")[0];
  if (!header) continue;
  const genCols = (
    await db.query(`select column_name from information_schema.columns where table_schema = 'audita' and table_name = $1 and is_generated = 'ALWAYS'`, [t])
  ).rows.map((r) => r.column_name);
  const cols = header.split(",").map((c) => c.replace(/^"|"$/g, ""));
  const keep = cols.filter((c) => !genCols.includes(c)).map((c) => `"${c}"`).join(", ");
  await db.exec(`create temp table stage_${t} as select * from audita.${t} with no data;`);
  await db.query(`copy stage_${t} (${cols.map((c) => `"${c}"`).join(", ")}) from '/dev/blob' with (format csv, header true)`, [], {
    blob: new Blob([csv]),
  });
  await db.exec(`insert into audita.${t} (${keep}) overriding system value select ${keep} from stage_${t};`);
}
await db.exec(`insert into auth.users (id) select user_id from audita.app_users on conflict do nothing;`);
await db.exec(`set session_replication_role = origin;`);

const signatures = {};
for (const t of tables) {
  const r = (await db.query(SQL_ASSINATURA(t))).rows[0];
  signatures[t] = { linhas_exportadas: exported[t].linhas, linhas_restauradas: r.n, md5_restaurado: r.md5 };
}

// funções do sistema sobre a base restaurada (como o administrador)
const admin = (await db.query(`select user_id from audita.app_users where role = 'admin' and status = 'ativo' limit 1`)).rows[0]?.user_id;
await db.exec(`set request.jwt.claim.sub = '${admin}';`);
const funcs = {
  is_admin: (await db.query(`select audita.is_admin() as v`)).rows[0].v,
  indicadores_2026: (await db.query(`select audita.dashboard_indicators('2026-01-01', '2026-12-31', true) as v`)).rows[0].v,
};

const report = {
  executado_em: started.toISOString(),
  migracoes_aplicadas: migrations,
  tabelas: signatures,
  arquivos: {
    total: files.length,
    bytes: files.reduce((s, f) => s + f.bytes, 0),
    conferidos_com_banco: files.filter((f) => f.confere === true).length,
    divergentes: files.filter((f) => f.confere === false).map((f) => `${f.bucket}/${f.path}`),
    sem_registro: files.filter((f) => f.confere === null).map((f) => `${f.bucket}/${f.path}`),
  },
  registros_sem_arquivo: [...expectedSha.keys()].filter((k) => !files.some((f) => `${f.bucket}/${f.path}` === k)),
  funcoes_na_base_restaurada: funcs,
};
writeFileSync(join(out, "relatorio.json"), JSON.stringify(report, null, 2));
const tableOk = Object.values(signatures).every((s) => s.linhas_exportadas === s.linhas_restauradas);
console.log(JSON.stringify({ tabelas: Object.keys(signatures).length, linhas_ok: tableOk, arquivos: report.arquivos, registros_sem_arquivo: report.registros_sem_arquivo.length, is_admin: funcs.is_admin }, null, 2));
for (const [t, s] of Object.entries(signatures)) console.log(`${t}\t${s.linhas_restauradas}\t${s.md5_restaurado}`);
process.exit(tableOk && report.arquivos.divergentes.length === 0 && report.registros_sem_arquivo.length === 0 ? 0 : 3);
