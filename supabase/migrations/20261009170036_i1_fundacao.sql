-- AUDITA — I1 Fundação
-- Schema próprio `audita`, usuários autorizados, trilha de auditoria e RLS.
-- Referências: AUDDOC017 RF-01, RF-08, §10 (segurança), §12 (banco compartilhado).
-- Migração aditiva: não cria nem altera nada fora do schema `audita`.

create schema if not exists audita;
comment on schema audita is 'Sistema AUDITA (operação interna). Dados exclusivos; não compartilhar com PRO/HUB sem integração homologada.';

revoke all on schema audita from public;
grant usage on schema audita to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Utilitário: updated_at
-- ---------------------------------------------------------------------------
create or replace function audita.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Usuários autorizados (lista explícita; estar autenticado não basta)
-- ---------------------------------------------------------------------------
create table audita.app_users (
  user_id     uuid primary key references auth.users (id) on delete restrict,
  full_name   text not null check (length(btrim(full_name)) between 2 and 160),
  role        text not null default 'admin' check (role in ('admin')), -- novos papéis só por migração aprovada
  status      text not null default 'active' check (status in ('active', 'inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table audita.app_users is 'Usuários com acesso ao AUDITA. MVP: apenas administrador. Usuários de outros sistemas no mesmo projeto não têm acesso.';

create trigger app_users_set_updated_at
  before update on audita.app_users
  for each row execute function audita.set_updated_at();

-- Papel do usuário corrente (null = sem acesso)
create or replace function audita.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from audita.app_users u
  where u.user_id = (select auth.uid())
    and u.status = 'active';
$$;

create or replace function audita.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(audita.current_app_role() = 'admin', false);
$$;

-- ---------------------------------------------------------------------------
-- Trilha de auditoria (append-only)
-- ---------------------------------------------------------------------------
create table audita.audit_log (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  actor_user_id  uuid,
  action         text not null check (action in ('insert', 'update', 'delete', 'login', 'logout', 'access_denied')),
  entity         text not null,
  entity_id      text,
  summary        jsonb not null default '{}'::jsonb,
  origin         text not null default 'db' check (origin in ('db', 'app'))
);
comment on table audita.audit_log is 'Registro de alterações e eventos de acesso. Não armazena senhas nem tokens. Somente inserção.';
create index audit_log_occurred_at_idx on audita.audit_log (occurred_at desc);
create index audit_log_entity_idx on audita.audit_log (entity, entity_id);

create or replace function audita.audit_log_block_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A trilha de auditoria não pode ser alterada ou excluída'
    using errcode = '42501';
end;
$$;

create trigger audit_log_immutable
  before update or delete on audita.audit_log
  for each row execute function audita.audit_log_block_changes();

-- Gatilho genérico: registra somente os campos alterados (antes/depois mínimo)
create or replace function audita.log_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  diff    jsonb := '{}'::jsonb;
  k       text;
  pk      text := tg_argv[0];
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(new_row) loop
      if k <> 'updated_at' and (old_row -> k) is distinct from (new_row -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_object('de', old_row -> k, 'para', new_row -> k));
      end if;
    end loop;
    if diff = '{}'::jsonb then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    diff := new_row - 'created_at' - 'updated_at';
  else
    diff := old_row;
  end if;

  insert into audita.audit_log (actor_user_id, action, entity, entity_id, summary, origin)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(new_row ->> pk, old_row ->> pk),
    diff,
    'db'
  );
  return coalesce(new, old);
end;
$$;

create trigger app_users_audit
  after insert or update or delete on audita.app_users
  for each row execute function audita.log_row_change('user_id');

-- Eventos de acesso registrados pela aplicação
create or replace function audita.log_access_event(event text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if event not in ('login', 'logout', 'access_denied') then
    raise exception 'Evento não permitido' using errcode = '22023';
  end if;
  -- login/logout só para usuários autorizados; access_denied registra tentativas de quem não está na lista
  if event in ('login', 'logout') and not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  insert into audita.audit_log (actor_user_id, action, entity, entity_id, summary, origin)
  values (uid, event, 'session', uid::text, '{}'::jsonb, 'app');
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS e privilégios (mínimo necessário; nada para anon)
-- ---------------------------------------------------------------------------
alter table audita.app_users enable row level security;
alter table audita.audit_log enable row level security;

create policy app_users_select on audita.app_users
  for select to authenticated
  using (user_id = (select auth.uid()) or (select audita.is_admin()));

create policy app_users_insert on audita.app_users
  for insert to authenticated
  with check ((select audita.is_admin()));

create policy app_users_update on audita.app_users
  for update to authenticated
  using ((select audita.is_admin()))
  with check ((select audita.is_admin()));

create policy audit_log_select on audita.audit_log
  for select to authenticated
  using ((select audita.is_admin()));

revoke all on all tables in schema audita from public, anon, authenticated;
grant select, insert, update on audita.app_users to authenticated;
grant select on audita.audit_log to authenticated;

revoke all on all functions in schema audita from public, anon;
grant execute on function audita.current_app_role() to authenticated;
grant execute on function audita.is_admin() to authenticated;
grant execute on function audita.log_access_event(text) to authenticated;
revoke execute on function audita.log_row_change() from authenticated;
revoke execute on function audita.audit_log_block_changes() from authenticated;
revoke execute on function audita.set_updated_at() from authenticated;

grant all on all tables in schema audita to service_role;
grant all on all functions in schema audita to service_role;
