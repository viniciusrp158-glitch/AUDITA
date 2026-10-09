-- AUDITA — I5 Parâmetros financeiros e cotações (motor AUDDOC011)
-- Referências: AUDDOC017 RF-09 a RF-14, §7, CA-05/06/07; AUDDOC011 §§3–9 e ANX01 (aba Parâmetros e Simulador).
-- Parâmetros: versionados, inicialmente NÃO preenchidos (todos os valores podem ser nulos). Vigente é imutável;
-- mudanças exigem nova versão. Cálculo: motor da aplicação (decimal exato); emissão/snapshots: I6.

create table audita.pricing_parameter_sets (
  id               uuid primary key default gen_random_uuid(),
  version          integer not null unique,
  label            text not null check (length(btrim(label)) between 3 and 120),
  status           text not null default 'rascunho' check (status in ('rascunho', 'vigente', 'substituido')),
  pro_labore       numeric(14,2) check (pro_labore is null or pro_labore >= 0),
  fixed_costs      numeric(14,2) check (fixed_costs is null or fixed_costs >= 0),
  billable_hours   numeric(10,2) check (billable_hours is null or billable_hours >= 0),
  taxes            numeric(9,6) check (taxes is null or (taxes >= 0 and taxes < 1)),
  payment_fees     numeric(9,6) check (payment_fees is null or (payment_fees >= 0 and payment_fees < 1)),
  commission       numeric(9,6) check (commission is null or (commission >= 0 and commission < 1)),
  contingency      numeric(9,6) check (contingency is null or (contingency >= 0 and contingency <= 5)),
  target_margin    numeric(9,6) check (target_margin is null or (target_margin >= 0 and target_margin < 1)),
  max_discount     numeric(9,6) check (max_discount is null or (max_discount >= 0 and max_discount <= 1)),
  reference_date   date,
  validated_by     text check (validated_by is null or length(validated_by) <= 300),
  notes            text check (notes is null or length(notes) <= 2000),
  is_test          boolean not null default false,
  published_at     timestamptz,
  published_by     uuid,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  constraint parameter_sets_published_consistent check ((status = 'rascunho') = (published_at is null))
);
comment on table audita.pricing_parameter_sets is 'Parâmetros AUDDOC011-ANX01 (aba Parâmetros), versionados. Valores ausentes ⇒ cálculo PENDENTE. Percentuais em fração.';
create unique index parameter_sets_one_vigente on audita.pricing_parameter_sets (status) where status = 'vigente';

create or replace function audita.parameter_sets_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.version := audita.allocate_code('pricing_parameters', 'global');
    new.status := 'rascunho';
    new.published_at := null;
    new.published_by := null;
    new.created_at := now();
    new.created_by := (select auth.uid());
    return new;
  end if;
  if new.id is distinct from old.id or new.version is distinct from old.version
     or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'Versão e dados de criação são permanentes' using errcode = '42501';
  end if;
  if old.status <> 'rascunho' then
    -- Vigente/substituído: imutáveis; única transição permitida é vigente → substituído (pela publicação de outra versão)
    if not (old.status = 'vigente' and new.status = 'substituido'
            and coalesce(current_setting('audita.parameter_publish', true), '') = 'on'
            and (to_jsonb(new) - 'status' - 'updated_at' - 'updated_by') = (to_jsonb(old) - 'status' - 'updated_at' - 'updated_by')) then
      raise exception 'Parâmetros publicados não podem ser alterados; crie uma nova versão' using errcode = '42501';
    end if;
  elsif new.status <> 'rascunho' and coalesce(current_setting('audita.parameter_publish', true), '') <> 'on' then
    raise exception 'Use a publicação para tornar a versão vigente' using errcode = '42501';
  elsif new.status = 'rascunho' then
    new.published_by := null;
  end if;
  return new;
end;
$$;
create trigger parameter_sets_before_write
  before insert or update on audita.pricing_parameter_sets
  for each row execute function audita.parameter_sets_before_write();
create trigger parameter_sets_set_updated_meta
  before update on audita.pricing_parameter_sets
  for each row execute function audita.set_updated_meta();
create trigger parameter_sets_audit
  after insert or update or delete on audita.pricing_parameter_sets
  for each row execute function audita.log_row_change('id');

-- Rascunho pode ser descartado; publicados nunca
create or replace function audita.parameter_sets_before_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'rascunho' then
    raise exception 'Parâmetros publicados não podem ser excluídos' using errcode = '42501';
  end if;
  if exists (select 1 from audita.quotes q where q.parameter_set_id = old.id) then
    raise exception 'Versão em uso por cotação' using errcode = '23503';
  end if;
  return old;
end;
$$;

create or replace function audita.publish_parameter_set(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  st text;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select status into st from audita.pricing_parameter_sets where id = p_id for update;
  if not found then
    raise exception 'Versão não encontrada' using errcode = 'P0002';
  elsif st <> 'rascunho' then
    raise exception 'Somente rascunhos podem ser publicados' using errcode = '22023';
  end if;
  perform set_config('audita.parameter_publish', 'on', true);
  update audita.pricing_parameter_sets set status = 'substituido' where status = 'vigente';
  update audita.pricing_parameter_sets
     set status = 'vigente', published_at = now(), published_by = (select auth.uid())
   where id = p_id;
  perform set_config('audita.parameter_publish', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Cotações (uma por demanda — AUDDOC011 §2) e itens
-- ---------------------------------------------------------------------------
create table audita.quotes (
  id                 uuid primary key default gen_random_uuid(),
  quote_code         text not null unique,
  demand_id          uuid not null unique references audita.demands (id) on delete restrict,
  client_id          uuid not null references audita.clients (id) on delete restrict,
  parameter_set_id   uuid references audita.pricing_parameter_sets (id) on delete restrict,
  status             text not null default 'rascunho'
                       check (status in ('rascunho', 'revisada', 'emitida', 'aceita', 'recusada', 'cancelada')),
  validity_days      integer check (validity_days is null or validity_days between 1 and 365),
  payment_terms      text check (payment_terms is null or length(payment_terms) <= 1000),
  notes              text check (notes is null or length(notes) <= 4000),
  is_test            boolean not null default false,
  created_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);
comment on table audita.quotes is 'Cotação PROP-AAAA-NNNN vinculada à demanda. No I5 apenas rascunho; revisões, emissão e aceite no I6.';
create index quotes_client_idx on audita.quotes (client_id);

create table audita.quote_items (
  id                  uuid primary key default gen_random_uuid(),
  quote_id            uuid not null references audita.quotes (id) on delete restrict,
  position            integer not null default 1 check (position between 1 and 200),
  service_id          uuid references audita.services (id) on delete restrict,
  description         text not null check (length(btrim(description)) between 3 and 300),
  periodicity         text not null default 'unica' check (periodicity in ('unica', 'mensal')),
  quantity_ref        text check (quantity_ref is null or length(quantity_ref) <= 120),
  hours_preparation   numeric(10,2) check (hours_preparation is null or hours_preparation >= 0),
  hours_execution     numeric(10,2) check (hours_execution is null or hours_execution >= 0),
  hours_delivery      numeric(10,2) check (hours_delivery is null or hours_delivery >= 0),
  hours_followup      numeric(10,2) check (hours_followup is null or hours_followup >= 0),
  hours_travel        numeric(10,2) check (hours_travel is null or hours_travel >= 0),
  cost_travel         numeric(14,2) check (cost_travel is null or cost_travel >= 0),
  cost_materials      numeric(14,2) check (cost_materials is null or cost_materials >= 0),
  cost_external       numeric(14,2) check (cost_external is null or cost_external >= 0),
  cost_other          numeric(14,2) check (cost_other is null or cost_other >= 0),
  contingency         numeric(9,6) check (contingency is null or (contingency >= 0 and contingency <= 5)),
  margin              numeric(9,6) check (margin is null or (margin >= 0 and margin < 1)),
  discount            numeric(9,6) check (discount is null or (discount >= 0 and discount <= 1)),
  discount_reason     text check (discount_reason is null or length(discount_reason) <= 500),
  scope_notes         text check (scope_notes is null or length(scope_notes) <= 2000),
  created_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid
);
comment on table audita.quote_items is 'Itens da cotação (RF-13): cada linha com escopo e cálculo próprios; horas em 5 campos (G-02); periodicidade única/mensal (G-07).';
create index quote_items_quote_idx on audita.quote_items (quote_id, position);

create or replace function audita.quotes_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dem_client uuid;
  dem_status text;
begin
  select client_id, status into dem_client, dem_status from audita.demands where id = new.demand_id;
  new.client_id := dem_client;
  if tg_op = 'INSERT' then
    if dem_status in ('encerrada', 'nao_viavel', 'cancelada') then
      raise exception 'Demanda encerrada, não viável ou cancelada não recebe cotação' using errcode = '23514';
    end if;
    new.quote_code := 'PROP-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-'
      || lpad(audita.allocate_code('quote', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY'))::text, 4, '0');
    new.status := 'rascunho';
    new.created_at := now();
    new.created_by := (select auth.uid());
  else
    if new.id is distinct from old.id or new.quote_code is distinct from old.quote_code or new.demand_id is distinct from old.demand_id
       or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
      raise exception 'Código e demanda da cotação são permanentes' using errcode = '42501';
    end if;
    if old.status <> 'rascunho' then
      raise exception 'Somente cotações em rascunho podem ser alteradas' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      raise exception 'A situação da cotação é controlada pelo fluxo de emissão (I6)' using errcode = '42501';
    end if;
  end if;
  if new.parameter_set_id is not null
     and (tg_op = 'INSERT' or new.parameter_set_id is distinct from old.parameter_set_id)
     and not exists (select 1 from audita.pricing_parameter_sets p where p.id = new.parameter_set_id and p.status = 'vigente') then
    raise exception 'A cotação só pode adotar a versão vigente dos parâmetros' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger quotes_before_write
  before insert or update on audita.quotes
  for each row execute function audita.quotes_before_write();
create trigger quotes_set_updated_meta
  before update on audita.quotes
  for each row execute function audita.set_updated_meta();
create trigger quotes_audit
  after insert or update on audita.quotes
  for each row execute function audita.log_row_change('id', 'client_id');

create or replace function audita.quote_items_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  qid uuid := coalesce(new.quote_id, old.quote_id);
begin
  if not exists (select 1 from audita.quotes q where q.id = qid and q.status = 'rascunho') then
    raise exception 'Itens só podem ser alterados em cotações em rascunho' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.quote_id is distinct from old.quote_id or new.created_at is distinct from old.created_at) then
    raise exception 'O vínculo do item com a cotação é permanente' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := (select auth.uid());
  end if;
  return coalesce(new, old);
end;
$$;
create trigger quote_items_guard
  before insert or update or delete on audita.quote_items
  for each row execute function audita.quote_items_guard();
create trigger quote_items_set_updated_meta
  before update on audita.quote_items
  for each row execute function audita.set_updated_meta();
create trigger quote_items_audit
  after insert or update or delete on audita.quote_items
  for each row execute function audita.log_row_change('id', 'quote_id');

create trigger parameter_sets_before_delete
  before delete on audita.pricing_parameter_sets
  for each row execute function audita.parameter_sets_before_delete();

-- ---------------------------------------------------------------------------
-- RLS e privilégios
-- ---------------------------------------------------------------------------
alter table audita.pricing_parameter_sets enable row level security;
alter table audita.quotes enable row level security;
alter table audita.quote_items enable row level security;

create policy parameter_sets_select on audita.pricing_parameter_sets for select to authenticated using ((select audita.is_admin()));
create policy parameter_sets_insert on audita.pricing_parameter_sets for insert to authenticated with check ((select audita.is_admin()));
create policy parameter_sets_update on audita.pricing_parameter_sets for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));
create policy parameter_sets_delete on audita.pricing_parameter_sets for delete to authenticated using ((select audita.is_admin()));

create policy quotes_select on audita.quotes for select to authenticated using ((select audita.is_admin()));
create policy quotes_insert on audita.quotes for insert to authenticated with check ((select audita.is_admin()));
create policy quotes_update on audita.quotes for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));

create policy quote_items_select on audita.quote_items for select to authenticated using ((select audita.is_admin()));
create policy quote_items_insert on audita.quote_items for insert to authenticated with check ((select audita.is_admin()));
create policy quote_items_update on audita.quote_items for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));
create policy quote_items_delete on audita.quote_items for delete to authenticated using ((select audita.is_admin()));

revoke all on audita.pricing_parameter_sets, audita.quotes, audita.quote_items from public, anon, authenticated;
grant select, insert, update, delete on audita.pricing_parameter_sets to authenticated;
grant select, insert, update on audita.quotes to authenticated;
grant select, insert, update, delete on audita.quote_items to authenticated;

revoke all on function audita.parameter_sets_before_write(), audita.parameter_sets_before_delete(),
  audita.publish_parameter_set(uuid), audita.quotes_before_write(), audita.quote_items_guard() from public, anon, authenticated;
grant execute on function audita.publish_parameter_set(uuid) to authenticated;

grant all on all tables in schema audita to service_role;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
