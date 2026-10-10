-- I9.1 — Permissões no modo MAIS RESTRITIVO (decisão do Diretor em 10/10/2026, após a validação do I9).
-- Regra: entra só o que o AUDDOC017 §10 já define para cada nível; todo ponto em aberto da matriz D7 do caderno de
-- pendências ("?") fica SEM acesso até a resposta do Diretor.
--   • Operador administrativo: clientes, unidades e contatos; demandas; preparar orçamentos (itens, horas, despesas,
--     conteúdo). NÃO vê preços, custos de hora, margens nem revisões/documentos emitidos; NÃO conclui revisão, emite,
--     registra aceite/recusa, autoriza desconto ou adota parâmetros; NÃO usa autocadastro; NÃO acessa a biblioteca.
--   • Marketing: nenhum módulo até o I10 (comunicação); apenas a própria conta.
-- Somente aditiva: políticas RESTRITIVAS adicionais (somam-se às permissivas da migração anterior) e as verificações
-- das funções do fluxo voltam a exigir o administrador. Quando o D7 for respondido, a liberação será feita por nova
-- migração, com aprovação.

-- 1) Tabelas que o operador deixa de ler/gravar
create policy parameter_sets_restrito_operador on audita.pricing_parameter_sets as restrictive
  for select to authenticated using (not (select audita.has_role('operador')));
create policy quote_revisions_restrito_operador on audita.quote_revisions as restrictive
  for select to authenticated using (not (select audita.has_role('operador')));
create policy generated_documents_restrito_operador on audita.generated_documents as restrictive
  for select to authenticated using (not (select audita.has_role('operador')));
create policy service_status_history_restrito_operador on audita.service_status_history as restrictive
  for select to authenticated using (not (select audita.has_role('operador')));
create policy client_invites_restrito_operador on audita.client_invites as restrictive
  for all to authenticated using (not (select audita.has_role('operador'))) with check (not (select audita.has_role('operador')));
create policy requests_restrito_operador on audita.client_registration_requests as restrictive
  for all to authenticated using (not (select audita.has_role('operador'))) with check (not (select audita.has_role('operador')));
create policy consent_terms_restrito_operador on audita.consent_terms as restrictive
  for select to authenticated using (not (select audita.has_role('operador')));

-- Biblioteca: nem operador nem marketing
create policy library_documents_restrito_niveis on audita.library_documents as restrictive
  for select to authenticated using (not (select audita.has_role('operador', 'marketing')));
create policy library_revisions_restrito_niveis on audita.library_revisions as restrictive
  for select to authenticated using (not (select audita.has_role('operador', 'marketing')));

-- Histórico: o operador vê só o histórico de clientes, unidades, contatos e demandas (sem preços)
create policy audit_log_restrito_operador on audita.audit_log as restrictive
  for select to authenticated
  using (not (select audita.has_role('operador'))
         or entity = any (array['clients', 'client_units', 'client_contacts', 'demands', 'demand_events']));

-- 2) Arquivos: escopo limitado aos buckets do AUDITA (não afeta outros sistemas do mesmo projeto)
create policy audita_documentos_restrito_operador on storage.objects as restrictive
  for all to authenticated
  using (bucket_id <> 'audita-documentos' or not (select audita.has_role('operador')))
  with check (bucket_id <> 'audita-documentos' or not (select audita.has_role('operador')));
create policy audita_biblioteca_restrito_niveis on storage.objects as restrictive
  for all to authenticated
  using (bucket_id <> 'audita-biblioteca' or not (select audita.has_role('operador', 'marketing')))
  with check (bucket_id <> 'audita-biblioteca' or not (select audita.has_role('operador', 'marketing')));

-- 3) Preços no item e versão de parâmetros da cotação: só o administrador
create or replace function audita.pricing_admin_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if audita.is_admin() or current_user = 'postgres' then
    return new;
  end if;
  if tg_table_name = 'quote_items' then
    if tg_op = 'INSERT' then
      if new.contingency is not null or new.margin is not null or new.discount is not null
         or new.discount_reason is not null or coalesce(new.discount_authorized, false) then
        raise exception 'Somente o administrador define contingência, margem e desconto do item.' using errcode = '42501';
      end if;
    elsif new.contingency is distinct from old.contingency or new.margin is distinct from old.margin
       or new.discount is distinct from old.discount or new.discount_reason is distinct from old.discount_reason
       or new.discount_authorized is distinct from old.discount_authorized then
      raise exception 'Somente o administrador define contingência, margem e desconto do item.' using errcode = '42501';
    end if;
  elsif tg_table_name = 'quotes' then
    if (tg_op = 'INSERT' and new.parameter_set_id is not null)
       or (tg_op = 'UPDATE' and new.parameter_set_id is distinct from old.parameter_set_id) then
      raise exception 'Somente o administrador define a versão de parâmetros da cotação.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function audita.pricing_admin_guard() from public, anon, authenticated;

create trigger quote_items_pricing_admin_guard
  before insert or update on audita.quote_items
  for each row execute function audita.pricing_admin_guard();
create trigger quotes_pricing_admin_guard
  before insert or update on audita.quotes
  for each row execute function audita.pricing_admin_guard();

-- 4) Funções do fluxo: voltam a exigir o administrador (troca exata e conferida, como na migração anterior)
do $$
declare
  r record;
  v_def text;
begin
  for r in
    select * from (values
      ('approve_registration',    'if not audita.can_operate() then', 'if not audita.is_admin() then'),
      ('freeze_quote_revision',   'if not audita.can_operate() then', 'if not audita.is_admin() then'),
      ('register_emission',       'if not audita.can_operate() then', 'if not audita.is_admin() then'),
      ('register_quote_decision', 'if not audita.can_operate() then', 'if not audita.is_admin() then'),
      ('reopen_quote',            'if not audita.can_operate() then', 'if not audita.is_admin() then'),
      ('log_document_download',   'if not audita.can_operate() then', 'if not audita.is_admin() then'),
      ('log_library_download',    'if not audita.has_role(''admin'', ''operador'', ''marketing'') then', 'if not audita.is_admin() then')
    ) as t(fn, old_txt, new_txt)
  loop
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'audita' and p.proname = r.fn;
    if v_def is null then
      raise exception 'Função % não encontrada', r.fn;
    end if;
    if (length(v_def) - length(replace(v_def, r.old_txt, ''))) / length(r.old_txt) <> 1 then
      raise exception 'Função %: verificação esperada não encontrada exatamente uma vez', r.fn;
    end if;
    execute replace(v_def, r.old_txt, r.new_txt);
  end loop;
end;
$$;


-- 5) Autoverificação passa a informar se cada política de Storage é permissiva ou restritiva
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
      select coalesce(jsonb_agg(jsonb_build_object('name', p.policyname, 'cmd', p.cmd, 'roles', p.roles, 'permissive', p.permissive) order by p.policyname), '[]'::jsonb)
      from pg_catalog.pg_policies p
      where p.schemaname = 'storage' and p.tablename = 'objects' and p.policyname like 'audita\_%'
    ),
    'anon_schema_usage', pg_catalog.has_schema_privilege('anon', 'audita', 'USAGE')
  ) into v;
  return v;
end;
$$;
