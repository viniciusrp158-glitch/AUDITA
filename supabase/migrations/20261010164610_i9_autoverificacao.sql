-- I9 — Homologação: autoverificação de segurança (AUDDOC017 §10, CA-10, CA-12) e leitura dos contadores para backup.
-- Somente aditiva. Nada é alterado em tabelas existentes; nenhum acesso a anon.

-- 1) Autoverificação: lê apenas o catálogo do Postgres e devolve a situação de RLS, permissões, funções e buckets.
--    SECURITY DEFINER para enxergar os privilégios de anon/authenticated; só o administrador pode chamar.
create or replace function audita.security_self_check()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not audita.is_admin() then
    raise exception 'Somente o administrador pode executar a autoverificação.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'tables', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', c.relname,
        'rls', c.relrowsecurity,
        'policies', (select count(*) from pg_catalog.pg_policies p where p.schemaname = 'audita' and p.tablename = c.relname),
        'anon_privileges', (
          select coalesce(jsonb_agg(x.priv order by x.priv), '[]'::jsonb)
          from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) as x(priv)
          where pg_catalog.has_table_privilege('anon', c.oid, x.priv)),
        'public_privileges', (
          select coalesce(jsonb_agg(a.privilege_type order by a.privilege_type), '[]'::jsonb)
          from pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) a
          where a.grantee = 0)
      ) order by c.relname), '[]'::jsonb)
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'audita' and c.relkind in ('r', 'p')
    ),
    'views', (
      select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
      from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'audita' and c.relkind in ('v', 'm')
    ),
    'functions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', p.proname,
        'security_definer', p.prosecdef,
        'search_path_empty', coalesce(p.proconfig @> array['search_path=""'], false),
        'anon_execute', pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      ) order by p.proname), '[]'::jsonb)
      from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'audita'
    ),
    'buckets', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id, 'public', b.public, 'file_size_limit', b.file_size_limit, 'allowed_mime_types', b.allowed_mime_types
      ) order by b.id), '[]'::jsonb)
      from storage.buckets b where b.id like 'audita-%'
    ),
    'storage_policies', (
      select coalesce(jsonb_agg(jsonb_build_object('name', p.policyname, 'cmd', p.cmd, 'roles', p.roles) order by p.policyname), '[]'::jsonb)
      from pg_catalog.pg_policies p
      where p.schemaname = 'storage' and p.tablename = 'objects' and p.policyname like 'audita\_%'
    ),
    'anon_schema_usage', pg_catalog.has_schema_privilege('anon', 'audita', 'USAGE')
  ) into v;
  return v;
end;
$$;

revoke all on function audita.security_self_check() from public, anon;
grant execute on function audita.security_self_check() to authenticated;

-- 2) Contadores de código: o administrador passa a poder LER (necessário para cópia de segurança e conferência).
--    Escrita continua exclusiva da função allocate_code.
create policy code_counters_select_admin on audita.code_counters
  for select to authenticated
  using ((select audita.is_admin()));
grant select on audita.code_counters to authenticated;
