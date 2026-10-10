-- I9.1 — Minha conta, usuário mestre, níveis de acesso e tema (AUDDOC017 §1 e §10; AUDDOC013 §8).
-- Decisões do Diretor (10/10/2026):
--   • por enquanto só o usuário mestre; o mestre — e somente ele — cria contas de qualquer nível;
--   • Operador administrativo: clientes, demandas e orçamentos completos (vê preços e margens, conclui revisão,
--     emite, registra aceite/recusa e autoriza desconto); consulta/baixa a biblioteca; vê indicadores.
--     NÃO libera serviços, NÃO altera parâmetros, NÃO publica na biblioteca, NÃO gerencia usuários (AUDDOC017 §10);
--   • Marketing: até o I10, apenas consulta/baixa a biblioteca (sem preços nem dados de clientes);
--   • primeiro acesso com senha provisória e troca obrigatória.
-- Somente aditiva: as políticas existentes (administrador) ficam intactas; os novos níveis entram por políticas
-- PERMISSIVAS adicionais e o controle do mestre por políticas RESTRITIVAS adicionais. A restrição de papéis é ampliada.

-- ---------------------------------------------------------------------------------------------------------------
-- 1) Conta do usuário
-- ---------------------------------------------------------------------------------------------------------------
alter table audita.app_users drop constraint app_users_role_check;
alter table audita.app_users add constraint app_users_role_check check (role in ('admin', 'operador', 'marketing'));

alter table audita.app_users
  add column is_master             boolean not null default false,
  add column job_title             text check (job_title is null or length(btrim(job_title)) between 2 and 120),
  add column theme                 text check (theme is null or theme in ('claro', 'escuro')),
  add column must_change_password  boolean not null default false,
  add column created_by            uuid;

comment on column audita.app_users.is_master is 'Usuário mestre (Diretor): único que cria contas e altera níveis. Exatamente um.';
comment on column audita.app_users.must_change_password is 'Senha provisória: troca obrigatória no próximo acesso.';

create unique index app_users_one_master on audita.app_users (is_master) where is_master;

-- O mestre precisa ser administrador ativo
alter table audita.app_users add constraint app_users_master_is_admin
  check (not is_master or (role = 'admin' and status = 'active'));

-- Ambiente com um único administrador ativo e sem mestre ⇒ ele se torna o mestre (desenvolvimento e implantação inicial).
update audita.app_users set is_master = true
where role = 'admin' and status = 'active'
  and not exists (select 1 from audita.app_users m where m.is_master)
  and (select count(*) from audita.app_users a where a.role = 'admin' and a.status = 'active') = 1;

-- ---------------------------------------------------------------------------------------------------------------
-- 2) Funções de nível
-- ---------------------------------------------------------------------------------------------------------------
create or replace function audita.has_role(variadic p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(audita.current_app_role() = any (p_roles), false);
$$;

create or replace function audita.can_operate()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select audita.has_role('admin', 'operador');
$$;

create or replace function audita.is_master()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from audita.app_users u
    where u.user_id = (select auth.uid()) and u.is_master and u.status = 'active' and u.role = 'admin'
  );
$$;

revoke all on function audita.has_role(text[]) from public, anon;
revoke all on function audita.can_operate() from public, anon;
revoke all on function audita.is_master() from public, anon;
grant execute on function audita.has_role(text[]) to authenticated;
grant execute on function audita.can_operate() to authenticated;
grant execute on function audita.is_master() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 3) Usuários: só o mestre cria e altera níveis; cada um altera o próprio nome, cargo e tema
-- ---------------------------------------------------------------------------------------------------------------
create policy app_users_insert_master_only on audita.app_users as restrictive
  for insert to authenticated with check ((select audita.is_master()));

create policy app_users_update_master_or_self on audita.app_users as restrictive
  for update to authenticated
  using ((select audita.is_master()) or user_id = (select auth.uid()))
  with check ((select audita.is_master()) or user_id = (select auth.uid()));

create policy app_users_update_self on audita.app_users
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'active')
  with check (user_id = (select auth.uid()));

create or replace function audita.app_users_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_master boolean := audita.is_master();
begin
  if tg_op = 'INSERT' then
    if new.is_master then
      raise exception 'O usuário mestre não é criado pelo sistema.' using errcode = '42501';
    end if;
    if v_uid is not null then
      new.created_by := v_uid;
    end if;
    return new;
  end if;

  -- UPDATE
  if new.user_id is distinct from old.user_id or new.is_master is distinct from old.is_master
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Campo não pode ser alterado.' using errcode = '42501';
  end if;
  if (new.role is distinct from old.role or new.status is distinct from old.status) then
    if not v_master then
      raise exception 'Somente o usuário mestre altera nível ou situação de usuários.' using errcode = '42501';
    end if;
    if old.is_master then
      raise exception 'O usuário mestre não pode ter o nível ou a situação alterados.' using errcode = '42501';
    end if;
  end if;
  if new.must_change_password is distinct from old.must_change_password then
    -- o próprio usuário só pode concluir a troca (verdadeiro → falso); o mestre pode exigir nova troca
    if not (v_uid = old.user_id and old.must_change_password and not new.must_change_password) and not v_master then
      raise exception 'Alteração não permitida.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger app_users_guard
  before insert or update on audita.app_users
  for each row execute function audita.app_users_guard();

-- ---------------------------------------------------------------------------------------------------------------
-- 4) Operador administrativo — políticas adicionais (o administrador continua com as políticas originais)
-- ---------------------------------------------------------------------------------------------------------------
-- Clientes, unidades, contatos, convites e solicitações de autocadastro
create policy clients_operador_select on audita.clients for select to authenticated using ((select audita.has_role('operador')));
create policy clients_operador_insert on audita.clients for insert to authenticated with check ((select audita.has_role('operador')));
create policy clients_operador_update on audita.clients for update to authenticated
  using ((select audita.has_role('operador'))) with check ((select audita.has_role('operador')));
create policy client_units_operador_select on audita.client_units for select to authenticated using ((select audita.has_role('operador')));
create policy client_units_operador_insert on audita.client_units for insert to authenticated with check ((select audita.has_role('operador')));
create policy client_units_operador_update on audita.client_units for update to authenticated
  using ((select audita.has_role('operador'))) with check ((select audita.has_role('operador')));
create policy client_contacts_operador_select on audita.client_contacts for select to authenticated using ((select audita.has_role('operador')));
create policy client_contacts_operador_insert on audita.client_contacts for insert to authenticated with check ((select audita.has_role('operador')));
create policy client_contacts_operador_update on audita.client_contacts for update to authenticated
  using ((select audita.has_role('operador'))) with check ((select audita.has_role('operador')));
create policy client_invites_operador_select on audita.client_invites for select to authenticated using ((select audita.has_role('operador')));
create policy client_invites_operador_insert on audita.client_invites for insert to authenticated with check ((select audita.has_role('operador')));
create policy client_invites_operador_update on audita.client_invites for update to authenticated
  using ((select audita.has_role('operador'))) with check ((select audita.has_role('operador')));
create policy requests_operador_select on audita.client_registration_requests for select to authenticated using ((select audita.has_role('operador')));
create policy requests_operador_update on audita.client_registration_requests for update to authenticated
  using ((select audita.has_role('operador'))) with check ((select audita.has_role('operador')));
create policy consent_terms_operador_select on audita.consent_terms for select to authenticated using ((select audita.has_role('operador')));

-- Catálogo e parâmetros: somente leitura (não libera serviços nem altera preços — AUDDOC017 §10)
create policy services_operador_select on audita.services for select to authenticated using ((select audita.has_role('operador')));
create policy service_status_history_operador_select on audita.service_status_history for select to authenticated
  using ((select audita.has_role('operador')));
create policy parameter_sets_operador_select on audita.pricing_parameter_sets for select to authenticated
  using ((select audita.has_role('operador')));

-- Demandas
create policy demands_operador_select on audita.demands for select to authenticated using ((select audita.has_role('operador')));
create policy demands_operador_insert on audita.demands for insert to authenticated with check ((select audita.has_role('operador')));
create policy demands_operador_update on audita.demands for update to authenticated
  using ((select audita.has_role('operador'))) with check ((select audita.has_role('operador')));
create policy demand_events_operador_select on audita.demand_events for select to authenticated using ((select audita.has_role('operador')));
create policy demand_events_operador_insert on audita.demand_events for insert to authenticated
  with check ((select audita.has_role('operador')) and event_type = any (array['nota', 'contato', 'visita']));

-- Orçamentos, revisões e documentos emitidos
create policy quotes_operador_select on audita.quotes for select to authenticated using ((select audita.has_role('operador')));
create policy quotes_operador_insert on audita.quotes for insert to authenticated with check ((select audita.has_role('operador')));
create policy quotes_operador_update on audita.quotes for update to authenticated
  using ((select audita.has_role('operador'))) with check ((select audita.has_role('operador')));
create policy quote_items_operador_select on audita.quote_items for select to authenticated using ((select audita.has_role('operador')));
create policy quote_items_operador_insert on audita.quote_items for insert to authenticated with check ((select audita.has_role('operador')));
create policy quote_items_operador_update on audita.quote_items for update to authenticated
  using ((select audita.has_role('operador'))) with check ((select audita.has_role('operador')));
create policy quote_items_operador_delete on audita.quote_items for delete to authenticated using ((select audita.has_role('operador')));
create policy quote_revisions_operador_select on audita.quote_revisions for select to authenticated using ((select audita.has_role('operador')));
create policy document_templates_operador_select on audita.document_templates for select to authenticated using ((select audita.has_role('operador')));
create policy generated_documents_operador_select on audita.generated_documents for select to authenticated using ((select audita.has_role('operador')));

-- Histórico dos registros de negócio (ficha do cliente); trilha de usuários, parâmetros e catálogo continua só do administrador
create policy audit_log_operador_select on audita.audit_log for select to authenticated
  using ((select audita.has_role('operador')) and entity = any (array[
    'clients', 'client_units', 'client_contacts', 'client_invites', 'client_registration_requests',
    'demands', 'demand_events', 'quotes', 'quote_items', 'quote_revisions', 'generated_documents']));

-- ---------------------------------------------------------------------------------------------------------------
-- 5) Biblioteca: operador e marketing consultam e baixam revisões publicadas (vigente ou substituída)
-- ---------------------------------------------------------------------------------------------------------------
create policy library_documents_leitura_select on audita.library_documents for select to authenticated
  using ((select audita.has_role('operador', 'marketing')));
create policy library_revisions_leitura_select on audita.library_revisions for select to authenticated
  using ((select audita.has_role('operador', 'marketing')) and status in ('vigente', 'substituido'));

-- ---------------------------------------------------------------------------------------------------------------
-- 6) Arquivos (Storage): operador lê e grava propostas; operador e marketing leem revisões publicadas da biblioteca
-- ---------------------------------------------------------------------------------------------------------------
create policy audita_documentos_operador_select on storage.objects for select to authenticated
  using (bucket_id = 'audita-documentos' and (select audita.has_role('operador')));
create policy audita_documentos_operador_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'audita-documentos' and (select audita.has_role('operador')) and name like 'quotes/%');
create policy audita_biblioteca_leitura_select on storage.objects for select to authenticated
  using (
    bucket_id = 'audita-biblioteca' and (select audita.has_role('operador', 'marketing'))
    and exists (select 1 from audita.library_revisions r where r.storage_path = name and r.status in ('vigente', 'substituido'))
  );

-- ---------------------------------------------------------------------------------------------------------------
-- 7) Funções do fluxo: o operador passa a executar as mesmas etapas do administrador.
--    Troca exata e conferida da linha de verificação na definição vigente de cada função (nada mais muda).
-- ---------------------------------------------------------------------------------------------------------------
do $$
declare
  r record;
  v_def text;
  v_new text;
begin
  for r in
    select * from (values
      ('approve_registration',   'if not audita.is_admin() then', 'if not audita.can_operate() then'),
      ('change_demand_status',   'if not audita.is_admin() then', 'if not audita.can_operate() then'),
      ('freeze_quote_revision',  'if not audita.is_admin() then', 'if not audita.can_operate() then'),
      ('register_emission',      'if not audita.is_admin() then', 'if not audita.can_operate() then'),
      ('register_quote_decision','if not audita.is_admin() then', 'if not audita.can_operate() then'),
      ('reopen_quote',           'if not audita.is_admin() then', 'if not audita.can_operate() then'),
      ('log_document_download',  'if not audita.is_admin() then', 'if not audita.can_operate() then'),
      ('log_library_download',   'if not audita.is_admin() then', 'if not audita.has_role(''admin'', ''operador'', ''marketing'') then'),
      ('log_access_event',       'if event in (''login'', ''logout'') and not audita.is_admin() then',
                                 'if event in (''login'', ''logout'') and audita.current_app_role() is null then')
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
    v_new := replace(v_def, r.old_txt, r.new_txt);
    execute v_new;
  end loop;
end;
$$;
