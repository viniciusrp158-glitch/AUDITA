/**
 * Aplica todas as migrações do repositório, na ordem, num Postgres descartável (PGlite) com as estruturas mínimas
 * que o Supabase fornece (auth, storage, papéis). Uso: node scripts/verificar-migracoes.mjs
 * Serve para conferir uma migração nova ANTES de aplicá-la no banco de desenvolvimento.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const db = await PGlite.create({ extensions: { pg_trgm, pgcrypto, unaccent } });
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role authenticator nologin;
  create schema extensions;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid, created_at timestamptz default now());
  alter table storage.objects enable row level security;
`);
const files = readdirSync(join(ROOT, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  const sql = readFileSync(join(ROOT, "supabase", "migrations", f), "utf8").replace(/^\s*notify\s+pgrst.*$/gim, "");
  try {
    await db.exec(sql);
    console.log("ok ", f);
  } catch (e) {
    console.error("ERRO", f, e.message);
    process.exit(1);
  }
}
const extra = process.argv[2];
if (extra) console.log(JSON.stringify((await db.query(extra)).rows, null, 1));
