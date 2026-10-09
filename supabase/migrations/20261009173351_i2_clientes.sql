-- AUDITA — I2 Clientes
-- Cadastro mestre de clientes, unidades e contatos com código permanente (CLI-NNNN).
-- Referências: AUDDOC017 RF-02, RF-03, RF-04, RF-08, FL-01, CA-02, CA-03; AUDDOC013 §§3–5.
-- Migração aditiva; somente schema `audita` (+ extensões em `extensions`).

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------
-- Texto normalizado para busca: minúsculas, sem acentos, espaços simples.
create or replace function audita.normalize_text(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, ''))), '\s+', ' ', 'g')), '');
$$;

create or replace function audita.only_digits(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '');
$$;

create or replace function audita.is_valid_cnpj(value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d int[];
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int; r int; i int;
begin
  if value is null or value !~ '^\d{14}$' or value ~ '^(\d)\1{13}$' then
    return false;
  end if;
  d := string_to_array(value, null)::int[];
  s := 0; for i in 1..12 loop s := s + d[i] * w1[i]; end loop;
  r := s % 11; if (case when r < 2 then 0 else 11 - r end) <> d[13] then return false; end if;
  s := 0; for i in 1..13 loop s := s + d[i] * w2[i]; end loop;
  r := s % 11; return (case when r < 2 then 0 else 11 - r end) = d[14];
end;
$$;

create or replace function audita.is_valid_cpf(value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d int[]; s int; r int; i int;
begin
  if value is null or value !~ '^\d{11}$' or value ~ '^(\d)\1{10}$' then
    return false;
  end if;
  d := string_to_array(value, null)::int[];
  s := 0; for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> d[10] then return false; end if;
  s := 0; for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = d[11];
end;
$$;

-- ---------------------------------------------------------------------------
-- Contadores de códigos legíveis (alocação atômica, sem reutilização)
-- ---------------------------------------------------------------------------
create table audita.code_counters (
  code_type   text not null,
  scope       text not null,
  last_value  bigint not null check (last_value >= 0),
  updated_at  timestamptz not null default now(),
  primary key (code_type, scope)
);
comment on table audita.code_counters is 'Último número emitido por tipo de código. Nunca decresce; códigos não são reutilizados.';

create or replace function audita.allocate_code(p_type text, p_scope text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v bigint;
begin
  insert into audita.code_counters (code_type, scope, last_value)
  values (p_type, p_scope, 1)
  on conflict (code_type, scope)
  do update set last_value = audita.code_counters.last_value + 1, updated_at = now()
  returning last_value into v;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trilha: vínculo com a entidade-mãe (ex.: unidade → cliente) para o histórico
-- ---------------------------------------------------------------------------
alter table audita.audit_log add column parent_entity_id text;
create index audit_log_parent_idx on audita.audit_log (parent_entity_id) where parent_entity_id is not null;

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
  parent  text := case when tg_nargs > 1 then tg_argv[1] end;
  ignored text[] := array['updated_at', 'updated_by', 'search_text'];
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(new_row) loop
      if not (k = any (ignored)) and (old_row -> k) is distinct from (new_row -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_object('de', old_row -> k, 'para', new_row -> k));
      end if;
    end loop;
    if diff = '{}'::jsonb then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    diff := new_row - 'created_at' - 'updated_at' - 'updated_by' - 'search_text';
  else
    diff := old_row;
  end if;

  insert into audita.audit_log (actor_user_id, action, entity, entity_id, parent_entity_id, summary, origin)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(new_row ->> pk, old_row ->> pk),
    case when parent is not null then coalesce(new_row ->> parent, old_row ->> parent) end,
    diff,
    'db'
  );
  return coalesce(new, old);
end;
$$;

-- Carimbo de autoria em atualizações
create or replace function audita.set_updated_meta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------
create table audita.clients (
  id                   uuid primary key default gen_random_uuid(),
  client_code          text not null unique,
  person_type          text not null default 'PJ' check (person_type in ('PJ', 'PF')),
  legal_name           text not null check (length(btrim(legal_name)) between 2 and 200),
  trade_name           text check (trade_name is null or length(btrim(trade_name)) between 1 and 200),
  tax_id               text,
  cnae                 text check (cnae is null or cnae ~ '^\d{7}$'),
  segment              text check (segment is null or length(btrim(segment)) <= 160),
  email                text check (email is null or (length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  phone                text check (phone is null or phone ~ '^\d{10,13}$'),
  address_zip          text check (address_zip is null or address_zip ~ '^\d{8}$'),
  address_street       text check (address_street is null or length(address_street) <= 200),
  address_number       text check (address_number is null or length(address_number) <= 20),
  address_complement   text check (address_complement is null or length(address_complement) <= 100),
  address_district     text check (address_district is null or length(address_district) <= 100),
  address_city         text check (address_city is null or length(address_city) <= 100),
  address_state        text check (address_state is null or address_state ~ '^[A-Z]{2}$'),
  notes                text check (notes is null or length(notes) <= 4000),
  status               text not null default 'ativo' check (status in ('ativo', 'inativo')),
  inactivated_at       timestamptz,
  inactivation_reason  text,
  is_test              boolean not null default false,
  search_text          text generated always as (
                         audita.normalize_text(client_code || ' ' || legal_name || ' ' || coalesce(trade_name, '') || ' ' || coalesce(tax_id, ''))
                       ) stored,
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid,
  constraint clients_tax_id_valid check (
    tax_id is null
    or (person_type = 'PJ' and audita.is_valid_cnpj(tax_id))
    or (person_type = 'PF' and audita.is_valid_cpf(tax_id))
  ),
  constraint clients_inactivation_consistent check (
    (status = 'ativo' and inactivated_at is null)
    or (status = 'inativo' and inactivated_at is not null and length(btrim(coalesce(inactivation_reason, ''))) >= 3)
  )
);
comment on table audita.clients is 'Cadastro mestre de clientes (AUDDOC013). id UUID permanente + client_code legível imutável e não reutilizável.';
comment on column audita.clients.tax_id is 'CNPJ (14 dígitos) ou CPF (11 dígitos), somente números. Opcional.';
comment on column audita.clients.is_test is 'Registro fictício de teste. Excluído dos indicadores reais.';

create unique index clients_tax_id_unique on audita.clients (tax_id) where tax_id is not null;
create index clients_search_trgm on audita.clients using gin (search_text extensions.gin_trgm_ops);
create index clients_status_idx on audita.clients (status, legal_name);

-- Código gerado pelo banco; imutável
create or replace function audita.clients_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.client_code := 'CLI-' || lpad(audita.allocate_code('client', 'global')::text, 4, '0');
    new.created_at := now();
    new.created_by := (select auth.uid());
  else
    if new.id is distinct from old.id or new.client_code is distinct from old.client_code then
      raise exception 'O código do cliente é permanente e não pode ser alterado' using errcode = '42501';
    end if;
    if new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
      raise exception 'Dados de criação não podem ser alterados' using errcode = '42501';
    end if;
    if new.status = 'ativo' then
      new.inactivated_at := null;
      new.inactivation_reason := null;
    elsif old.status = 'ativo' and new.status = 'inativo' then
      new.inactivated_at := now();
    end if;
  end if;
  new.legal_name := btrim(regexp_replace(new.legal_name, '\s+', ' ', 'g'));
  new.trade_name := nullif(btrim(regexp_replace(coalesce(new.trade_name, ''), '\s+', ' ', 'g')), '');
  return new;
end;
$$;

create trigger clients_before_write
  before insert or update on audita.clients
  for each row execute function audita.clients_before_write();

create trigger clients_set_updated_meta
  before update on audita.clients
  for each row execute function audita.set_updated_meta();

create trigger clients_audit
  after insert or update or delete on audita.clients
  for each row execute function audita.log_row_change('id', 'id');

-- ---------------------------------------------------------------------------
-- Unidades
-- ---------------------------------------------------------------------------
create table audita.client_units (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references audita.clients (id) on delete restrict,
  name                 text not null check (length(btrim(name)) between 2 and 160),
  tax_id               text check (tax_id is null or audita.is_valid_cnpj(tax_id)),
  address_zip          text check (address_zip is null or address_zip ~ '^\d{8}$'),
  address_street       text check (address_street is null or length(address_street) <= 200),
  address_number       text check (address_number is null or length(address_number) <= 20),
  address_complement   text check (address_complement is null or length(address_complement) <= 100),
  address_district     text check (address_district is null or length(address_district) <= 100),
  address_city         text check (address_city is null or length(address_city) <= 100),
  address_state        text check (address_state is null or address_state ~ '^[A-Z]{2}$'),
  local_contact        text check (local_contact is null or length(local_contact) <= 200),
  notes                text check (notes is null or length(notes) <= 2000),
  status               text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid
);
comment on table audita.client_units is 'Unidades/estabelecimentos do cliente, sem duplicar o cadastro mestre (AUDDOC013).';
create index client_units_client_idx on audita.client_units (client_id, status, name);
create unique index client_units_name_unique on audita.client_units (client_id, audita.normalize_text(name));

create or replace function audita.child_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.client_id is distinct from old.client_id then
      raise exception 'O vínculo com o cliente não pode ser alterado' using errcode = '42501';
    end if;
    if new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
      raise exception 'Dados de criação não podem ser alterados' using errcode = '42501';
    end if;
  else
    new.created_at := now();
    new.created_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger client_units_before_write
  before insert or update on audita.client_units
  for each row execute function audita.child_before_write();
create trigger client_units_set_updated_meta
  before update on audita.client_units
  for each row execute function audita.set_updated_meta();
create trigger client_units_audit
  after insert or update or delete on audita.client_units
  for each row execute function audita.log_row_change('id', 'client_id');

-- ---------------------------------------------------------------------------
-- Contatos
-- ---------------------------------------------------------------------------
create table audita.client_contacts (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references audita.clients (id) on delete restrict,
  unit_id      uuid references audita.client_units (id) on delete restrict,
  full_name    text not null check (length(btrim(full_name)) between 2 and 160),
  role_title   text check (role_title is null or length(role_title) <= 120),
  email        text check (email is null or (length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  phone        text check (phone is null or phone ~ '^\d{10,13}$'),
  is_primary   boolean not null default false,
  purpose      text check (purpose is null or length(purpose) <= 300),
  status       text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);
comment on table audita.client_contacts is 'Contatos e responsáveis do cliente. Dados pessoais mínimos, conforme finalidade (LGPD).';
create index client_contacts_client_idx on audita.client_contacts (client_id, status, full_name);
create unique index client_contacts_one_primary on audita.client_contacts (client_id) where is_primary and status = 'ativo';

-- A unidade do contato deve pertencer ao mesmo cliente
create or replace function audita.client_contacts_check_unit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.unit_id is not null and not exists (
    select 1 from audita.client_units u where u.id = new.unit_id and u.client_id = new.client_id
  ) then
    raise exception 'A unidade informada não pertence a este cliente' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger client_contacts_before_write
  before insert or update on audita.client_contacts
  for each row execute function audita.child_before_write();
create trigger client_contacts_check_unit
  before insert or update on audita.client_contacts
  for each row execute function audita.client_contacts_check_unit();
create trigger client_contacts_set_updated_meta
  before update on audita.client_contacts
  for each row execute function audita.set_updated_meta();
create trigger client_contacts_audit
  after insert or update or delete on audita.client_contacts
  for each row execute function audita.log_row_change('id', 'client_id');

-- ---------------------------------------------------------------------------
-- Detecção de duplicidade plausível (RF-03): mesmo documento ou nome semelhante
-- ---------------------------------------------------------------------------
create or replace function audita.find_similar_clients(p_name text, p_tax_id text default null, p_exclude uuid default null)
returns table (
  id uuid,
  client_code text,
  legal_name text,
  trade_name text,
  tax_id text,
  status text,
  reason text,
  score real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select audita.normalize_text(p_name) as n, audita.only_digits(p_tax_id) as t
  )
  select c.id, c.client_code, c.legal_name, c.trade_name, c.tax_id, c.status,
         case when p.t is not null and c.tax_id = p.t then 'mesmo_documento' else 'nome_semelhante' end as reason,
         case when p.t is not null and c.tax_id = p.t then 1::real
              else greatest(
                     extensions.similarity(audita.normalize_text(c.legal_name), p.n),
                     extensions.similarity(coalesce(audita.normalize_text(c.trade_name), ''), p.n)
                   ) end as score
  from audita.clients c, params p
  where (p_exclude is null or c.id <> p_exclude)
    and (
      (p.t is not null and c.tax_id = p.t)
      or (p.n is not null and (
            extensions.similarity(audita.normalize_text(c.legal_name), p.n) >= 0.45
         or extensions.similarity(coalesce(audita.normalize_text(c.trade_name), ''), p.n) >= 0.45))
    )
  order by score desc
  limit 5;
$$;

-- ---------------------------------------------------------------------------
-- RLS e privilégios
-- ---------------------------------------------------------------------------
alter table audita.code_counters enable row level security;
alter table audita.clients enable row level security;
alter table audita.client_units enable row level security;
alter table audita.client_contacts enable row level security;

create policy clients_select on audita.clients for select to authenticated using ((select audita.is_admin()));
create policy clients_insert on audita.clients for insert to authenticated with check ((select audita.is_admin()));
create policy clients_update on audita.clients for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));

create policy client_units_select on audita.client_units for select to authenticated using ((select audita.is_admin()));
create policy client_units_insert on audita.client_units for insert to authenticated with check ((select audita.is_admin()));
create policy client_units_update on audita.client_units for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));

create policy client_contacts_select on audita.client_contacts for select to authenticated using ((select audita.is_admin()));
create policy client_contacts_insert on audita.client_contacts for insert to authenticated with check ((select audita.is_admin()));
create policy client_contacts_update on audita.client_contacts for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));

-- Sem DELETE (inativação lógica, RF-08). code_counters: sem acesso direto.
revoke all on audita.code_counters, audita.clients, audita.client_units, audita.client_contacts from public, anon, authenticated;
grant select, insert, update on audita.clients, audita.client_units, audita.client_contacts to authenticated;

revoke all on function audita.allocate_code(text, text) from public, anon, authenticated;
revoke all on function audita.clients_before_write() from public, anon, authenticated;
revoke all on function audita.child_before_write() from public, anon, authenticated;
revoke all on function audita.client_contacts_check_unit() from public, anon, authenticated;
revoke all on function audita.set_updated_meta() from public, anon, authenticated;
revoke all on function audita.log_row_change() from public, anon, authenticated;
revoke all on function audita.find_similar_clients(text, text, uuid) from public, anon;
grant execute on function audita.find_similar_clients(text, text, uuid) to authenticated;
revoke all on function audita.normalize_text(text), audita.only_digits(text),
  audita.is_valid_cnpj(text), audita.is_valid_cpf(text) from public, anon;
grant execute on function audita.normalize_text(text), audita.only_digits(text),
  audita.is_valid_cnpj(text), audita.is_valid_cpf(text) to authenticated;

-- Funções futuras do schema não ficam executáveis por PUBLIC/anon por padrão
alter default privileges in schema audita revoke execute on functions from public;
alter default privileges in schema audita revoke execute on functions from anon;

grant all on all tables in schema audita to service_role;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
