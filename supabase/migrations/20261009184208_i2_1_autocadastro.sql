-- AUDITA — I2.1 Autocadastro do cliente por link individual
-- Convite de uso único (24 h), solicitação pendente, aceite versionado do termo e aprovação manual.
-- Referências: AUDDOC017 RF-02/03/04, §10; AUDDOC006 (formulário público: validação no servidor,
-- limitação de abuso, armazenamento controlado e privacidade); AUDDOC013 (cadastro mestre único).
-- Página pública NÃO acessa tabelas: apenas duas funções restritas (invite_context, submit_registration).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Termos de consentimento (versionados, imutáveis após publicação)
-- ---------------------------------------------------------------------------
create table audita.consent_terms (
  version       text primary key,
  title         text not null,
  body          text not null,
  published_at  timestamptz not null default now(),
  is_current    boolean not null default false
);
create unique index consent_terms_one_current on audita.consent_terms (is_current) where is_current;
comment on table audita.consent_terms is 'Versões do termo de declaração e proteção de dados apresentadas no autocadastro.';

create or replace function audita.consent_terms_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or new.body is distinct from old.body or new.title is distinct from old.title or new.version is distinct from old.version then
    raise exception 'Versões publicadas do termo não podem ser alteradas; publique nova versão' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger consent_terms_immutable
  before update or delete on audita.consent_terms
  for each row execute function audita.consent_terms_immutable();

insert into audita.consent_terms (version, title, body, is_current) values (
  'TERMO-CAD-v0.1',
  'Declaração e proteção de dados',
  'Declaro que as informações prestadas neste formulário são verdadeiras e que estou autorizado(a) a fornecê-las em nome da empresa.' || E'\n\n' ||
  'Os dados informados serão tratados pela AUDITA somente para cadastro, comunicação, elaboração de propostas e contratos e execução dos serviços contratados, com acesso restrito, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais — LGPD).' || E'\n\n' ||
  'Os dados de contato devem limitar-se ao necessário para o relacionamento com a AUDITA. O titular pode solicitar a confirmação, a atualização ou a correção dos seus dados pelo e-mail engenharia.audita@outlook.com.' || E'\n\n' ||
  'O envio deste formulário não constitui contratação de serviços. O cadastro será analisado pela AUDITA antes de ser efetivado.',
  true
);

-- ---------------------------------------------------------------------------
-- Convites (link individual, uso único, validade de 24 h)
-- ---------------------------------------------------------------------------
create table audita.client_invites (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  recipient     text not null check (length(btrim(recipient)) between 2 and 160),
  note          text check (note is null or length(note) <= 500),
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  used_at       timestamptz,
  cancelled_at  timestamptz,
  is_test       boolean not null default false,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  constraint client_invites_expiry_max check (expires_at <= created_at + interval '24 hours 1 minute'),
  constraint client_invites_single_outcome check (not (used_at is not null and cancelled_at is not null))
);
comment on table audita.client_invites is 'Links individuais de autocadastro. Armazena apenas o hash SHA-256 do token; o link é exibido uma única vez.';
comment on column audita.client_invites.recipient is 'Para quem o link foi enviado (empresa/contato), para acompanhamento.';
create index client_invites_created_idx on audita.client_invites (created_at desc);

create trigger client_invites_audit
  after insert or update on audita.client_invites
  for each row execute function audita.log_row_change('id');

-- ---------------------------------------------------------------------------
-- Solicitações de cadastro (área de quarentena; não são clientes)
-- ---------------------------------------------------------------------------
create table audita.client_registration_requests (
  id                 uuid primary key default gen_random_uuid(),
  invite_id          uuid not null unique references audita.client_invites (id) on delete restrict,
  status             text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  payload            jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 32768),
  terms_version      text not null references audita.consent_terms (version),
  terms_accepted_at  timestamptz not null,
  submitted_at       timestamptz not null default now(),
  reviewed_at        timestamptz,
  reviewed_by        uuid,
  review_note        text check (review_note is null or length(review_note) <= 1000),
  client_id          uuid references audita.clients (id) on delete restrict,
  constraint requests_review_consistent check (
    (status = 'pendente' and reviewed_at is null and client_id is null)
    or (status = 'aprovada' and reviewed_at is not null and client_id is not null)
    or (status = 'recusada' and reviewed_at is not null and client_id is null and length(btrim(coalesce(review_note, ''))) >= 3)
  )
);
comment on table audita.client_registration_requests is 'Dados enviados pelo cliente via link. Só viram cadastro após aprovação do administrador.';
create index requests_status_idx on audita.client_registration_requests (status, submitted_at desc);

create or replace function audita.requests_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status <> 'pendente' then
      raise exception 'Solicitação já analisada não pode ser alterada' using errcode = '42501';
    end if;
    if new.invite_id is distinct from old.invite_id or new.payload is distinct from old.payload
       or new.terms_version is distinct from old.terms_version or new.terms_accepted_at is distinct from old.terms_accepted_at
       or new.submitted_at is distinct from old.submitted_at then
      raise exception 'Os dados enviados pelo cliente são preservados como recebidos' using errcode = '42501';
    end if;
    if new.status <> 'pendente' then
      new.reviewed_at := now();
      new.reviewed_by := (select auth.uid());
    end if;
  end if;
  return new;
end;
$$;
create trigger requests_guard
  before update on audita.client_registration_requests
  for each row execute function audita.requests_guard();
create trigger requests_audit
  after insert or update on audita.client_registration_requests
  for each row execute function audita.log_row_change('id', 'client_id');

-- ---------------------------------------------------------------------------
-- Funções públicas (anon): somente estas duas
-- ---------------------------------------------------------------------------
create or replace function audita.token_hash(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Situação do link + termo vigente. Não revela para quem o link foi enviado.
create or replace function audita.invite_context(p_token text)
returns table (status text, expires_at timestamptz, terms_version text, terms_title text, terms_body text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  inv audita.client_invites%rowtype;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,128}$' then
    return query select 'invalido'::text, null::timestamptz, null::text, null::text, null::text;
    return;
  end if;
  select * into inv from audita.client_invites where token_hash = audita.token_hash(p_token);
  if not found then
    return query select 'invalido'::text, null::timestamptz, null::text, null::text, null::text;
    return;
  end if;
  return query
  select case
           when inv.used_at is not null then 'utilizado'
           when inv.cancelled_at is not null then 'cancelado'
           when inv.expires_at <= now() then 'expirado'
           else 'valido'
         end,
         inv.expires_at, t.version, t.title, t.body
  from audita.consent_terms t
  where t.is_current;
end;
$$;

-- Recebe o envio do cliente: valida link, termo e estrutura; grava como solicitação pendente.
create or replace function audita.submit_registration(p_token text, p_payload jsonb, p_terms_version text, p_accept boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inv audita.client_invites%rowtype;
  c jsonb := p_payload -> 'client';
  current_terms text;
  item jsonb;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,128}$' then
    raise exception 'Link inválido' using errcode = '22023';
  end if;

  select * into inv from audita.client_invites where token_hash = audita.token_hash(p_token) for update;
  if not found then
    raise exception 'Link inválido' using errcode = '22023';
  elsif inv.used_at is not null then
    raise exception 'Este link já foi utilizado' using errcode = '22023';
  elsif inv.cancelled_at is not null then
    raise exception 'Este link foi cancelado' using errcode = '22023';
  elsif inv.expires_at <= now() then
    raise exception 'Este link expirou' using errcode = '22023';
  end if;

  select version into current_terms from audita.consent_terms where is_current;
  if coalesce(p_accept, false) is not true or p_terms_version is distinct from current_terms then
    raise exception 'É necessário aceitar a versão vigente do termo' using errcode = '22023';
  end if;

  -- Estrutura mínima e limites (a aplicação valida campo a campo antes de chamar)
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 32768
     or c is null or jsonb_typeof(c) <> 'object' then
    raise exception 'Dados inválidos' using errcode = '22023';
  end if;
  if coalesce(c ->> 'person_type', '') not in ('PJ', 'PF')
     or length(btrim(coalesce(c ->> 'legal_name', ''))) not between 2 and 200 then
    raise exception 'Dados inválidos' using errcode = '22023';
  end if;
  if c ->> 'tax_id' is not null and not (
       (c ->> 'person_type' = 'PJ' and audita.is_valid_cnpj(c ->> 'tax_id'))
    or (c ->> 'person_type' = 'PF' and audita.is_valid_cpf(c ->> 'tax_id'))) then
    raise exception 'CNPJ/CPF inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_payload -> 'units', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_payload -> 'contacts', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_payload -> 'units', '[]'::jsonb)) > 5
     or jsonb_array_length(coalesce(p_payload -> 'contacts', '[]'::jsonb)) not between 1 and 5 then
    raise exception 'Dados inválidos' using errcode = '22023';
  end if;
  for item in select * from jsonb_array_elements(p_payload -> 'contacts') loop
    if length(btrim(coalesce(item ->> 'full_name', ''))) < 2 or (item ->> 'email' is null and item ->> 'phone' is null) then
      raise exception 'Cada contato precisa de nome e e-mail ou telefone' using errcode = '22023';
    end if;
  end loop;

  insert into audita.client_registration_requests (invite_id, payload, terms_version, terms_accepted_at)
  values (inv.id, p_payload, current_terms, now());

  -- Marca o convite como utilizado (bypass controlado do guard: apenas used_at)
  perform set_config('audita.allow_invite_use', 'on', true);
  update audita.client_invites set used_at = now() where id = inv.id;

  return 'recebido';
end;
$$;

-- Guard do convite: dados imutáveis; o uso só é registrado por dentro de submit_registration
create or replace function audita.client_invites_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := (select auth.uid());
    new.expires_at := least(coalesce(new.expires_at, now() + interval '24 hours'), now() + interval '24 hours');
    new.used_at := null;
    new.cancelled_at := null;
  else
    if new.token_hash is distinct from old.token_hash or new.created_at is distinct from old.created_at
       or new.created_by is distinct from old.created_by or new.expires_at is distinct from old.expires_at then
      raise exception 'Dados do convite não podem ser alterados' using errcode = '42501';
    end if;
    if new.used_at is distinct from old.used_at
       and not (old.used_at is null and coalesce(current_setting('audita.allow_invite_use', true), '') = 'on') then
      raise exception 'O uso do convite é registrado apenas pelo envio do formulário' using errcode = '42501';
    end if;
    if old.used_at is not null and new.cancelled_at is distinct from old.cancelled_at then
      raise exception 'Convite já utilizado não pode ser cancelado' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger client_invites_guard
  before insert or update on audita.client_invites
  for each row execute function audita.client_invites_guard();

-- ---------------------------------------------------------------------------
-- Aprovação (administrador): cria cliente, unidades e contatos numa única transação
-- ---------------------------------------------------------------------------
create or replace function audita.approve_registration(p_request_id uuid, p_client jsonb, p_is_test boolean)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  req audita.client_registration_requests%rowtype;
  new_client uuid;
  u jsonb;
  k jsonb;
  unit_ids jsonb := '{}'::jsonb;
  new_unit uuid;
  idx int := 0;
  primary_set boolean := false;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into req from audita.client_registration_requests where id = p_request_id for update;
  if not found then
    raise exception 'Solicitação não encontrada' using errcode = 'P0002';
  elsif req.status <> 'pendente' then
    raise exception 'Solicitação já analisada' using errcode = '42501';
  end if;

  insert into audita.clients (
    person_type, legal_name, trade_name, tax_id, cnae, segment, email, phone, notes,
    address_zip, address_street, address_number, address_complement, address_district, address_city, address_state, is_test)
  values (
    p_client ->> 'person_type', p_client ->> 'legal_name', p_client ->> 'trade_name', p_client ->> 'tax_id',
    p_client ->> 'cnae', p_client ->> 'segment', p_client ->> 'email', p_client ->> 'phone', p_client ->> 'notes',
    p_client ->> 'address_zip', p_client ->> 'address_street', p_client ->> 'address_number',
    p_client ->> 'address_complement', p_client ->> 'address_district', p_client ->> 'address_city',
    p_client ->> 'address_state', coalesce(p_is_test, false))
  returning id into new_client;

  for u in select * from jsonb_array_elements(coalesce(req.payload -> 'units', '[]'::jsonb)) loop
    insert into audita.client_units (client_id, name, tax_id, address_zip, address_street, address_number,
      address_complement, address_district, address_city, address_state, local_contact)
    values (new_client, u ->> 'name', u ->> 'tax_id', u ->> 'address_zip', u ->> 'address_street', u ->> 'address_number',
      u ->> 'address_complement', u ->> 'address_district', u ->> 'address_city', u ->> 'address_state', u ->> 'local_contact')
    returning id into new_unit;
    unit_ids := unit_ids || jsonb_build_object(idx::text, new_unit);
    idx := idx + 1;
  end loop;

  for k in select * from jsonb_array_elements(coalesce(req.payload -> 'contacts', '[]'::jsonb)) loop
    insert into audita.client_contacts (client_id, unit_id, full_name, role_title, email, phone, is_primary, purpose)
    values (
      new_client,
      case when k ->> 'unit_index' ~ '^\d+$' then (unit_ids ->> (k ->> 'unit_index'))::uuid end,
      k ->> 'full_name', k ->> 'role_title', k ->> 'email', k ->> 'phone',
      (coalesce((k ->> 'is_primary')::boolean, false) and not primary_set),
      k ->> 'purpose');
    primary_set := primary_set or coalesce((k ->> 'is_primary')::boolean, false);
  end loop;

  update audita.client_registration_requests
     set status = 'aprovada', client_id = new_client
   where id = p_request_id;

  return new_client;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS e privilégios
-- ---------------------------------------------------------------------------
alter table audita.consent_terms enable row level security;
alter table audita.client_invites enable row level security;
alter table audita.client_registration_requests enable row level security;

create policy consent_terms_select on audita.consent_terms for select to authenticated using ((select audita.is_admin()));
create policy client_invites_select on audita.client_invites for select to authenticated using ((select audita.is_admin()));
create policy client_invites_insert on audita.client_invites for insert to authenticated with check ((select audita.is_admin()));
create policy client_invites_update on audita.client_invites for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));
create policy requests_select on audita.client_registration_requests for select to authenticated using ((select audita.is_admin()));
create policy requests_update on audita.client_registration_requests for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));

revoke all on audita.consent_terms, audita.client_invites, audita.client_registration_requests from public, anon, authenticated;
grant select on audita.consent_terms to authenticated;
grant select, insert, update on audita.client_invites to authenticated;
grant select, update on audita.client_registration_requests to authenticated;

revoke all on function audita.consent_terms_immutable(), audita.client_invites_guard(), audita.requests_guard(),
  audita.token_hash(text), audita.approve_registration(uuid, jsonb, boolean),
  audita.invite_context(text), audita.submit_registration(text, jsonb, text, boolean) from public, anon, authenticated;

-- Acesso público mínimo: uso do schema + duas funções. Nenhuma tabela é concedida a anon.
grant usage on schema audita to anon;
grant execute on function audita.invite_context(text) to anon, authenticated;
grant execute on function audita.submit_registration(text, jsonb, text, boolean) to anon, authenticated;
grant execute on function audita.approve_registration(uuid, jsonb, boolean) to authenticated;

grant all on all tables in schema audita to service_role;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
