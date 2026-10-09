-- AUDITA — I4 Demandas (Registro Único de Atendimento — RUA)
-- Referências: AUDDOC017 RF-06, FL-05; AUDDOC009 §8 (RUA, estados) e §8.1; AUDDOC013 (código não reutilizável).
-- Estados do AUDDOC009 §8.1 (decisão G-04 do S0): referências gerenciais, transições livres e opcionais.
-- Contrato recorrente: um único registro com vários eventos (visitas, contatos, notas), sem novo cadastro por visita.

create table audita.demands (
  id                  uuid primary key default gen_random_uuid(),
  demand_code         text not null unique,
  client_id           uuid not null references audita.clients (id) on delete restrict,
  unit_id             uuid references audita.client_units (id) on delete restrict,
  contact_id          uuid references audita.client_contacts (id) on delete restrict,
  service_id          uuid references audita.services (id) on delete restrict,
  origin              text not null default 'outro'
                        check (origin in ('whatsapp', 'email', 'telefone', 'presencial', 'site', 'indicacao', 'outro')),
  summary             text not null check (length(btrim(summary)) between 3 and 200),
  description         text check (description is null or length(description) <= 4000),
  location            text check (location is null or length(location) <= 200),
  received_on         date not null default (now() at time zone 'America/Sao_Paulo')::date,
  due_on              date,
  is_recurring        boolean not null default false,
  viability_checked   boolean not null default false,
  viability_notes     text check (viability_notes is null or length(viability_notes) <= 2000),
  status              text not null default 'recebida'
                        check (status in ('recebida', 'em_analise', 'aguardando_cliente', 'proposta_enviada', 'aceita',
                                          'em_execucao', 'entregue', 'encerrada', 'nao_viavel', 'cancelada')),
  status_changed_at   timestamptz not null default now(),
  closed_at           timestamptz,
  notes               text check (notes is null or length(notes) <= 4000),
  is_test             boolean not null default false,
  search_text         text generated always as (audita.normalize_text(demand_code || ' ' || summary)) stored,
  created_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid,
  constraint demands_due_after_received check (due_on is null or due_on >= received_on),
  constraint demands_closed_consistent check (
    (status in ('encerrada', 'nao_viavel', 'cancelada')) = (closed_at is not null)
  )
);
comment on table audita.demands is 'Registro Único de Atendimento (AUDDOC009 §8). Código DEM-AAAA-NNNN permanente e não reutilizável.';
comment on column audita.demands.is_recurring is 'Contrato recorrente: visitas e contatos são registrados como eventos, sem novo cadastro.';
create index demands_client_idx on audita.demands (client_id, received_on desc);
create index demands_status_idx on audita.demands (status, due_on);
create index demands_search_trgm on audita.demands using gin (search_text extensions.gin_trgm_ops);

create table audita.demand_events (
  id            bigint generated always as identity primary key,
  demand_id     uuid not null references audita.demands (id) on delete restrict,
  event_type    text not null check (event_type in ('nota', 'contato', 'visita', 'situacao')),
  occurred_on   date not null default (now() at time zone 'America/Sao_Paulo')::date,
  description   text not null check (length(btrim(description)) between 2 and 4000),
  from_status   text,
  to_status     text,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  constraint demand_events_status_pair check ((event_type = 'situacao') = (to_status is not null))
);
comment on table audita.demand_events is 'Linha do tempo da demanda (somente inclusão): notas, contatos, visitas e mudanças de situação.';
create index demand_events_demand_idx on audita.demand_events (demand_id, id desc);

create trigger demand_events_immutable
  before update or delete on audita.demand_events
  for each row execute function audita.audit_log_block_changes();

-- ---------------------------------------------------------------------------
-- Regras de gravação
-- ---------------------------------------------------------------------------
create or replace function audita.demands_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.demand_code := 'DEM-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-'
      || lpad(audita.allocate_code('demand', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY'))::text, 4, '0');
    new.status := 'recebida';
    new.status_changed_at := now();
    new.closed_at := null;
    new.created_at := now();
    new.created_by := (select auth.uid());
  else
    if new.id is distinct from old.id or new.demand_code is distinct from old.demand_code
       or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
      raise exception 'O código da demanda é permanente e não pode ser alterado' using errcode = '42501';
    end if;
    if (new.status is distinct from old.status or new.status_changed_at is distinct from old.status_changed_at
        or new.closed_at is distinct from old.closed_at)
       and coalesce(current_setting('audita.demand_status_change', true), '') <> 'on' then
      raise exception 'A situação da demanda é alterada somente pela função de mudança de situação' using errcode = '42501';
    end if;
  end if;

  -- Vínculos coerentes com o cliente
  if new.unit_id is not null and not exists (
    select 1 from audita.client_units u where u.id = new.unit_id and u.client_id = new.client_id) then
    raise exception 'A unidade informada não pertence a este cliente' using errcode = '23514';
  end if;
  if new.contact_id is not null and not exists (
    select 1 from audita.client_contacts c where c.id = new.contact_id and c.client_id = new.client_id) then
    raise exception 'O contato informado não pertence a este cliente' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' or new.client_id is distinct from old.client_id then
    if exists (select 1 from audita.clients c where c.id = new.client_id and c.status = 'inativo') then
      raise exception 'Cliente inativo: reative o cadastro antes de registrar a demanda' using errcode = '23514';
    end if;
  end if;

  new.summary := btrim(regexp_replace(new.summary, '\s+', ' ', 'g'));
  return new;
end;
$$;

create trigger demands_before_write
  before insert or update on audita.demands
  for each row execute function audita.demands_before_write();
create trigger demands_set_updated_meta
  before update on audita.demands
  for each row execute function audita.set_updated_meta();
create trigger demands_audit
  after insert or update on audita.demands
  for each row execute function audita.log_row_change('id', 'client_id');

-- Evento de abertura
create or replace function audita.demands_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into audita.demand_events (demand_id, event_type, occurred_on, description, from_status, to_status)
  values (new.id, 'situacao', new.received_on, 'Demanda registrada.', null, 'recebida');
  return new;
end;
$$;
create trigger demands_after_insert
  after insert on audita.demands
  for each row execute function audita.demands_after_insert();

-- Mudança de situação (transições livres; cancelamento e "não viável" exigem motivo).
-- SECURITY DEFINER com verificação explícita de administrador: grava o evento 'situacao', vedado à inclusão direta.
create or replace function audita.change_demand_status(p_demand_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur text;
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select status into cur from audita.demands where id = p_demand_id for update;
  if not found then
    raise exception 'Demanda não encontrada' using errcode = 'P0002';
  end if;
  if p_status = cur then
    raise exception 'A demanda já está nesta situação' using errcode = '22023';
  end if;
  if p_status in ('nao_viavel', 'cancelada') and (note is null or length(note) < 3) then
    raise exception 'Informe o motivo para cancelar ou marcar como não viável' using errcode = '23514';
  end if;

  perform set_config('audita.demand_status_change', 'on', true);
  update audita.demands
     set status = p_status,
         status_changed_at = now(),
         closed_at = case when p_status in ('encerrada', 'nao_viavel', 'cancelada') then now() end
   where id = p_demand_id;
  perform set_config('audita.demand_status_change', 'off', true);

  insert into audita.demand_events (demand_id, event_type, description, from_status, to_status)
  values (p_demand_id, 'situacao', coalesce(note, 'Situação alterada.'), cur, p_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS e privilégios
-- ---------------------------------------------------------------------------
alter table audita.demands enable row level security;
alter table audita.demand_events enable row level security;

create policy demands_select on audita.demands for select to authenticated using ((select audita.is_admin()));
create policy demands_insert on audita.demands for insert to authenticated with check ((select audita.is_admin()));
create policy demands_update on audita.demands for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));
create policy demand_events_select on audita.demand_events for select to authenticated using ((select audita.is_admin()));
create policy demand_events_insert on audita.demand_events for insert to authenticated
  with check ((select audita.is_admin()) and event_type in ('nota', 'contato', 'visita'));

revoke all on audita.demands, audita.demand_events from public, anon, authenticated;
grant select, insert, update on audita.demands to authenticated;
grant select, insert on audita.demand_events to authenticated;

revoke all on function audita.demands_before_write(), audita.demands_after_insert(),
  audita.change_demand_status(uuid, text, text) from public, anon, authenticated;
grant execute on function audita.change_demand_status(uuid, text, text) to authenticated;

grant all on all tables in schema audita to service_role;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
