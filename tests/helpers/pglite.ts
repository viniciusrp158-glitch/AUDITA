/**
 * Postgres descartável (PGlite) com todas as migrações do repositório e as estruturas mínimas do Supabase
 * (auth, storage, papéis) — o mesmo ambiente de scripts/verificar-migracoes.mjs. Serve para testar fluxos que
 * mudariam o estado do banco de desenvolvimento de forma permanente (ex.: publicar dados institucionais).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

export async function migratedDb(): Promise<PGlite> {
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
  const dir = join(__dirname, "..", "..", "supabase", "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8").replace(/^\s*notify\s+pgrst.*$/gim, ""));
  }
  return db;
}

/** Executa como um usuário autenticado (papel "authenticated" + sub do JWT), como faria o PostgREST. */
export async function asUser<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${userId ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
