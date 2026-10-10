-- I9.2 — Dados institucionais da AUDITA (proponente das propostas).
-- Referências: AUDDOC013 §3–§4 (cadastro e identificação); AUDDOC010-ANX01 (campo "Empresa proponente"); AUDDOC010 §7
-- (constituição, razão social, CNPJ, CNAEs, inscrições e regime pendentes); AUDDOC015 §2 (e-mail oficial da fase inicial);
-- caderno de pendências C1 e D6. Nada é preenchido aqui: os campos ficam vazios (PENDENTE) até a resposta do Diretor e da
-- contabilidade — a migração não carrega dados.
-- Versões: rascunho → vigente (publicação com confirmação); a vigente anterior vira "substituída" e continua guardada.
-- Cada revisão de proposta congela os dados do proponente vigente (snapshot), como faz com os parâmetros (CA-08).
-- Somente aditiva.

create table audita.institutional_profiles (
  id                          uuid primary key default gen_random_uuid(),
  version                     integer not null unique,
  status                      text not null default 'rascunho' check (status in ('rascunho', 'vigente', 'substituido')),
  legal_name                  text check (legal_name is null or length(btrim(legal_name)) between 3 and 200),
  trade_name                  text check (trade_name is null or length(btrim(trade_name)) between 2 and 120),
  cnpj                        text check (cnpj is null or (cnpj ~ '^\d{14}$' and audita.is_valid_cnpj(cnpj))),
  legal_nature                text check (legal_nature is null or length(legal_nature) <= 120),
  cnae_main                   text check (cnae_main is null or length(cnae_main) <= 200),
  cnae_secondary              text check (cnae_secondary is null or length(cnae_secondary) <= 2000),
  municipal_registration      text check (municipal_registration is null or length(municipal_registration) <= 40),
  state_registration          text check (state_registration is null or length(state_registration) <= 40),
  tax_regime                  text check (tax_regime is null or length(tax_regime) <= 120),
  address_street              text check (address_street is null or length(address_street) <= 200),
  address_number              text check (address_number is null or length(address_number) <= 20),
  address_complement          text check (address_complement is null or length(address_complement) <= 120),
  address_district            text check (address_district is null or length(address_district) <= 120),
  address_zip                 text check (address_zip is null or address_zip ~ '^\d{8}$'),
  address_city                text check (address_city is null or length(address_city) <= 120),
  address_state               text check (address_state is null or address_state ~ '^[A-Z]{2}$'),
  email                       text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone                       text check (phone is null or phone ~ '^\d{10,11}$'),
  website                     text check (website is null or length(website) <= 200),
  technical_lead_name         text check (technical_lead_name is null or length(technical_lead_name) <= 160),
  technical_lead_registration text check (technical_lead_registration is null or length(technical_lead_registration) <= 80),
  show_technical_lead         boolean not null default false,
  signatory_name              text check (signatory_name is null or length(signatory_name) <= 160),
  signatory_role              text check (signatory_role is null or length(signatory_role) <= 120),
  full_address_on_proposal    boolean not null default true,
  notes                       text check (notes is null or length(notes) <= 2000),
  is_test                     boolean not null default false,
  published_at                timestamptz,
  published_by                uuid,
  created_at                  timestamptz not null default now(),
  created_by                  uuid default auth.uid(),
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid,
  constraint institutional_published_consistent check ((status = 'rascunho') = (published_at is null))
);
comment on table audita.institutional_profiles is 'Dados institucionais da AUDITA (proponente). Campos vazios = PENDENTE (AUDDOC010 §7; caderno C1/D6). Versões imutáveis após publicadas.';
create unique index institutional_one_vigente on audita.institutional_profiles (status) where status = 'vigente';

create or replace function audita.institutional_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'rascunho';
    new.published_at := null;
    new.published_by := null;
    new.version := coalesce((select max(version) from audita.institutional_profiles), 0) + 1;
    return new;
  end if;
  if old.status <> 'rascunho' then
    if not (coalesce(current_setting('audita.institutional_publish', true), '') = 'on'
            and (to_jsonb(new) - 'status' - 'published_at' - 'published_by' - 'updated_at' - 'updated_by')
              = (to_jsonb(old) - 'status' - 'published_at' - 'published_by' - 'updated_at' - 'updated_by')) then
      raise exception 'Dados publicados não podem ser alterados; crie uma nova versão.' using errcode = '42501';
    end if;
  elsif new.status <> 'rascunho' and coalesce(current_setting('audita.institutional_publish', true), '') <> 'on' then
    raise exception 'Use a publicação para tornar a versão vigente.' using errcode = '42501';
  end if;
  if new.version is distinct from old.version then
    raise exception 'A versão não pode ser alterada.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger institutional_before_write
  before insert or update on audita.institutional_profiles
  for each row execute function audita.institutional_before_write();
create trigger institutional_set_updated_meta
  before update on audita.institutional_profiles
  for each row execute function audita.set_updated_meta();
create trigger institutional_audit
  after insert or update on audita.institutional_profiles
  for each row execute function audita.log_row_change('id');

create or replace function audita.publish_institutional_profile(p_id uuid)
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
  select status into st from audita.institutional_profiles where id = p_id for update;
  if not found then
    raise exception 'Versão não encontrada' using errcode = 'P0002';
  elsif st <> 'rascunho' then
    raise exception 'Somente rascunhos podem ser publicados' using errcode = '22023';
  end if;
  perform set_config('audita.institutional_publish', 'on', true);
  update audita.institutional_profiles set status = 'substituido' where status = 'vigente';
  update audita.institutional_profiles set status = 'vigente', published_at = now(), published_by = (select auth.uid()) where id = p_id;
  perform set_config('audita.institutional_publish', 'off', true);
end;
$$;

-- Proponente vigente congelado em cada nova revisão de proposta
create or replace function audita.quote_revisions_add_proponent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p audita.institutional_profiles;
begin
  select * into p from audita.institutional_profiles where status = 'vigente';
  new.snapshot := coalesce(new.snapshot, '{}'::jsonb) || jsonb_build_object(
    'proponent',
    case when p.id is null then null else
      (to_jsonb(p) - 'created_by' - 'updated_by' - 'published_by' - 'created_at' - 'updated_at' - 'notes' - 'status')
    end);
  return new;
end;
$$;

create trigger quote_revisions_add_proponent
  before insert on audita.quote_revisions
  for each row execute function audita.quote_revisions_add_proponent();

-- Acesso: somente o administrador (o operador e o marketing não veem — modo restritivo)
alter table audita.institutional_profiles enable row level security;
create policy institutional_select on audita.institutional_profiles for select to authenticated using ((select audita.is_admin()));
create policy institutional_insert on audita.institutional_profiles for insert to authenticated with check ((select audita.is_admin()));
create policy institutional_update on audita.institutional_profiles for update to authenticated
  using ((select audita.is_admin()) and status = 'rascunho') with check ((select audita.is_admin()));
grant select, insert, update on audita.institutional_profiles to authenticated;

revoke all on function audita.institutional_before_write(), audita.quote_revisions_add_proponent(),
  audita.publish_institutional_profile(uuid) from public, anon, authenticated;
grant execute on function audita.publish_institutional_profile(uuid) to authenticated;
grant all on audita.institutional_profiles to service_role;
