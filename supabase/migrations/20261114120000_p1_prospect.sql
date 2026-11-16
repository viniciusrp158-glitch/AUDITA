-- AUDITA — P1 AUDITA PROSPECT, Fase 1 (AUDDOC020 Rev.00; planejamento aprovado pelo Diretor em 14/11/2026).
-- Base pública de CNPJ (recorte de SP), municípios do IBGE, nichos, palavras-chave, pesquisas, funil de leads,
-- atividades de contato e lista "não contatar". Custo zero: nenhuma API paga. Somente acréscimos.
--
-- cnpj_publications    : cada carga mensal da base pública da Receita (referência AAAA-MM).
-- cnpj_establishments  : empresas-alvo de SP da publicação vigente — estabelecimentos ATIVOS cuja empresa NÃO é
--                        empresário individual/MEI (natureza 2135). Recarregável; fica fora do backup diário.
-- ibge_municipalities  : 645 municípios de SP (código IBGE, centro da malha e distância até Sorocaba).
-- prospect_niches      : nicho ↔ prefixos de CNAE ↔ serviços liberados do catálogo.
-- prospect_keyword_*   : grupos e palavras-chave (clientes × parceiros/concorrentes).
-- prospect_searches    : pesquisas salvas; prospect_search_runs: histórico de execução.
-- leads                : funil comercial (uma empresa por CNPJ); lead_stage_history: mudanças de etapa (imutável);
--                        lead_activities: contatos e anotações (imutáveis).
-- contact_suppressions : "não contatar" — bloqueia novos contatos pelo sistema (LGPD, opt-out).

-- ---------------------------------------------------------------------------
-- Base pública
-- ---------------------------------------------------------------------------
create table audita.cnpj_publications (
  reference    text primary key check (reference ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  source       text not null check (length(btrim(source)) between 3 and 300),
  rows_loaded  integer not null check (rows_loaded >= 0),
  is_current   boolean not null default false,
  loaded_at    timestamptz not null default now(),
  notes        text check (notes is null or length(notes) <= 2000)
);
comment on table audita.cnpj_publications is 'Cargas mensais da base pública de CNPJ (Receita Federal, dados abertos). Uma vigente.';
create unique index cnpj_publications_one_current on audita.cnpj_publications (is_current) where is_current;

create table audita.ibge_municipalities (
  ibge_code        text primary key check (ibge_code ~ '^\d{7}$'),
  name             text not null,
  uf               text not null default 'SP' check (uf ~ '^[A-Z]{2}$'),
  rfb_code         text unique check (rfb_code is null or rfb_code ~ '^\d{4}$'),
  lat              numeric(9, 6),
  lon              numeric(9, 6),
  km_from_base     numeric(6, 1),
  immediate_region text,
  search_text      text generated always as (audita.normalize_text(name)) stored
);
comment on table audita.ibge_municipalities is 'Municípios (IBGE) com o código da Receita, centro da malha municipal e distância até a sede (Sorocaba).';

create table audita.cnpj_establishments (
  cnpj             text primary key check (cnpj ~ '^[0-9A-Z]{12}\d{2}$'),
  is_headquarters  boolean not null,
  legal_name       text not null,
  trade_name       text,
  legal_nature     text not null check (legal_nature ~ '^\d{4}$' and legal_nature <> '2135'),
  size_code        text not null check (size_code in ('01', '03', '05')),
  started_on       date,
  cnae_main        text not null check (cnae_main ~ '^\d{7}$'),
  cnae_secondary   text[] not null default '{}',
  street           text,
  number           text,
  complement       text,
  district         text,
  zip              text check (zip is null or zip ~ '^\d{8}$'),
  ibge_code        text not null references audita.ibge_municipalities (ibge_code) on delete restrict,
  phone1           text check (phone1 is null or phone1 ~ '^\d{10,11}$'),
  phone2           text check (phone2 is null or phone2 ~ '^\d{10,11}$'),
  email            text check (email is null or length(email) <= 254),
  publication      text not null references audita.cnpj_publications (reference) on delete restrict,
  search_text      text generated always as (audita.normalize_text(legal_name || ' ' || coalesce(trade_name, ''))) stored
);
comment on table audita.cnpj_establishments is 'Empresas-alvo de SP da base pública de CNPJ: ativas, sem empresário individual/MEI. Recarregável, fora do backup.';
-- text_pattern_ops: a pesquisa filtra por prefixo do CNAE (cnae_main like '41%')
create index cnpj_establishments_mun_cnae on audita.cnpj_establishments (ibge_code, cnae_main text_pattern_ops);
create index cnpj_establishments_cnae on audita.cnpj_establishments (cnae_main text_pattern_ops);
create index cnpj_establishments_started on audita.cnpj_establishments (started_on);
create index cnpj_establishments_secondary on audita.cnpj_establishments using gin (cnae_secondary);
create index cnpj_establishments_search_trgm on audita.cnpj_establishments using gin (search_text extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Nichos, palavras-chave e pesquisas
-- ---------------------------------------------------------------------------
create table audita.prospect_niches (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  name           text not null check (length(btrim(name)) between 3 and 120),
  cnae_prefixes  text[] not null check (cardinality(cnae_prefixes) between 1 and 60 and array_to_string(cnae_prefixes, ',') ~ '^\d{2,7}(,\d{2,7})*$'),
  service_codes  text[] not null default '{}',
  is_entry       boolean not null default false,
  sort_order     smallint not null default 100,
  notes          text check (notes is null or length(notes) <= 1000),
  status         text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
comment on table audita.prospect_niches is 'Nichos de prospecção: prefixos de CNAE (divisão a subclasse) e serviços liberados ligados. Inativação lógica.';

create table audita.prospect_keyword_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(btrim(name)) between 2 and 80),
  purpose     text not null check (purpose in ('clientes', 'parceiros_concorrentes')),
  status      text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);
create table audita.prospect_keywords (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references audita.prospect_keyword_groups (id) on delete restrict,
  term        text not null check (length(btrim(term)) between 2 and 80),
  status      text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  unique (group_id, term)
);
comment on table audita.prospect_keywords is 'Palavras-chave: segmento encontra clientes; SSMA/SGI encontra parceiros e concorrentes.';

create table audita.prospect_searches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 3 and 120),
  filters     jsonb not null check (jsonb_typeof(filters) = 'object'),
  status      text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);
create table audita.prospect_search_runs (
  id           uuid primary key default gen_random_uuid(),
  search_id    uuid references audita.prospect_searches (id) on delete restrict,
  filters      jsonb not null check (jsonb_typeof(filters) = 'object'),
  result_count integer not null check (result_count >= 0),
  publication  text references audita.cnpj_publications (reference) on delete restrict,
  ran_at       timestamptz not null default now(),
  ran_by       uuid default auth.uid()
);
comment on table audita.prospect_search_runs is 'Histórico de pesquisas executadas (filtros, quantidade, publicação da base). Somente inclusão.';
create index prospect_search_runs_ran_at on audita.prospect_search_runs (ran_at desc);

-- ---------------------------------------------------------------------------
-- "Não contatar"
-- ---------------------------------------------------------------------------
create table audita.contact_suppressions (
  id          uuid primary key default gen_random_uuid(),
  cnpj        text check (cnpj is null or cnpj ~ '^[0-9A-Z]{12}\d{2}$'),
  phone       text check (phone is null or phone ~ '^\d{10,13}$'),
  email       text check (email is null or (length(email) <= 254 and email = lower(email))),
  reason      text not null check (length(btrim(reason)) between 3 and 500),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  is_test     boolean not null default false,
  constraint contact_suppressions_target check (num_nonnulls(cnpj, phone, email) >= 1)
);
comment on table audita.contact_suppressions is 'Lista "não contatar" (opt-out): bloqueia novos contatos pelo sistema. Somente inclusão.';
create index contact_suppressions_cnpj on audita.contact_suppressions (cnpj) where cnpj is not null;
create index contact_suppressions_phone on audita.contact_suppressions (phone) where phone is not null;
create index contact_suppressions_email on audita.contact_suppressions (email) where email is not null;

create or replace function audita.is_suppressed(p_cnpj text, p_phone text default null, p_email text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from audita.contact_suppressions s
    where (p_cnpj is not null and s.cnpj = p_cnpj)
       or (p_phone is not null and s.phone = p_phone)
       or (p_email is not null and s.email = lower(p_email))
  );
$$;

-- ---------------------------------------------------------------------------
-- Leads e funil
-- ---------------------------------------------------------------------------
create table audita.leads (
  id                  uuid primary key default gen_random_uuid(),
  cnpj                text unique check (cnpj is null or cnpj ~ '^[0-9A-Z]{12}\d{2}$'),
  legal_name          text not null check (length(btrim(legal_name)) between 2 and 200),
  trade_name          text check (trade_name is null or length(trade_name) <= 200),
  cnae_main           text check (cnae_main is null or cnae_main ~ '^\d{7}$'),
  size_code           text check (size_code is null or size_code in ('01', '03', '05')),
  ibge_code           text references audita.ibge_municipalities (ibge_code) on delete restrict,
  niche_id            uuid references audita.prospect_niches (id) on delete restrict,
  stage               text not null default 'importado' check (stage in (
                        'identificada', 'importado', 'qualificado', 'primeiro_contato', 'aguardando_retorno',
                        'negociacao', 'reuniao', 'proposta', 'cliente', 'perdido')),
  lost_reason         text check (lost_reason is null or length(btrim(lost_reason)) between 3 and 500),
  score               smallint check (score is null or score between 0 and 100),
  score_band          text check (score_band is null or score_band in ('prioritario', 'alto', 'intermediario', 'baixo')),
  score_detail        jsonb,
  score_version       text,
  suggested_services  text[] not null default '{}',
  owner_id            uuid references audita.app_users (user_id) on delete restrict,
  source              text not null default 'receita' check (source in ('receita', 'manual')),
  source_publication  text references audita.cnpj_publications (reference) on delete restrict,
  phone_confirmed     text check (phone_confirmed is null or phone_confirmed ~ '^\d{10,13}$'),
  whatsapp_confirmed  text check (whatsapp_confirmed is null or whatsapp_confirmed ~ '^\d{10,13}$'),
  email_confirmed     text check (email_confirmed is null or (length(email_confirmed) <= 254 and email_confirmed ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  contact_person      text check (contact_person is null or length(contact_person) <= 120),
  next_action_at      timestamptz,
  next_action_note    text check (next_action_note is null or length(next_action_note) <= 300),
  last_activity_at    timestamptz,
  client_id           uuid references audita.clients (id) on delete restrict,
  status              text not null default 'ativo' check (status in ('ativo', 'inativo')),
  is_test             boolean not null default false,
  search_text         text generated always as (audita.normalize_text(legal_name || ' ' || coalesce(trade_name, '') || ' ' || coalesce(cnpj, ''))) stored,
  created_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid,
  constraint leads_lost_reason check ((stage = 'perdido') = (lost_reason is not null)),
  constraint leads_client_stage check (stage <> 'cliente' or client_id is not null)
);
comment on table audita.leads is 'Funil de prospecção: uma empresa por CNPJ, etapa, nota explicada, responsável e próximo retorno. Inativação lógica.';
comment on column audita.leads.score_detail is 'Explicação da nota: critérios, pontos e texto. Serviços sugeridos são hipóteses, não necessidades confirmadas.';
create index leads_stage on audita.leads (stage) where status = 'ativo';
create index leads_owner_next on audita.leads (owner_id, next_action_at) where status = 'ativo';
create index leads_search_trgm on audita.leads using gin (search_text extensions.gin_trgm_ops);

create table audita.lead_stage_history (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references audita.leads (id) on delete restrict,
  from_stage  text,
  to_stage    text not null,
  reason      text,
  changed_at  timestamptz not null default now(),
  changed_by  uuid default auth.uid()
);
comment on table audita.lead_stage_history is 'Histórico de etapas do lead, gravado pelo banco. Imutável.';
create index lead_stage_history_lead on audita.lead_stage_history (lead_id, changed_at desc);

create table audita.lead_activities (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references audita.leads (id) on delete restrict,
  kind         text not null check (kind in ('whatsapp', 'ligacao', 'email', 'reuniao', 'anotacao')),
  outcome      text check (outcome is null or outcome in (
                 'enviado', 'interesse', 'sem_resposta', 'reuniao_marcada', 'retornar_depois', 'numero_errado',
                 'nao_contatar', 'realizada', 'nao_atendeu')),
  note         text check (note is null or length(note) <= 2000),
  template_code text check (template_code is null or length(template_code) <= 60),
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  is_test      boolean not null default false,
  constraint lead_activities_outcome_kind check (kind = 'anotacao' or outcome is not null)
);
comment on table audita.lead_activities is 'Contatos e anotações do lead (WhatsApp assistido, ligação, e-mail, reunião). Imutáveis.';
create index lead_activities_lead on audita.lead_activities (lead_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Regras
-- ---------------------------------------------------------------------------
create or replace function audita.leads_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.cnpj is not null and audita.is_suppressed(new.cnpj) then
      raise exception 'Empresa na lista "não contatar": não pode entrar no funil' using errcode = '23514';
    end if;
    new.created_at := now();
    new.created_by := (select auth.uid());
    new.updated_at := now();
    if new.owner_id is null then
      new.owner_id := (select auth.uid());
    end if;
    return new;
  end if;
  if new.id is distinct from old.id or new.cnpj is distinct from old.cnpj or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by or new.source is distinct from old.source then
    raise exception 'CNPJ, origem e registro de criação do lead são permanentes' using errcode = '42501';
  end if;
  if old.stage = 'cliente' and new.stage is distinct from old.stage then
    raise exception 'Lead convertido em cliente não muda de etapa' using errcode = '42501';
  end if;
  if new.stage <> 'perdido' then
    new.lost_reason := null;
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;
create trigger leads_before_write before insert or update on audita.leads
  for each row execute function audita.leads_before_write();

create or replace function audita.leads_stage_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into audita.lead_stage_history (lead_id, from_stage, to_stage, reason, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.stage end, new.stage, new.lost_reason, (select auth.uid()));
  end if;
  return null;
end;
$$;
create trigger leads_stage_log after insert or update of stage on audita.leads
  for each row execute function audita.leads_stage_log();
create trigger leads_audit after insert or update on audita.leads
  for each row execute function audita.log_row_change('id');

create or replace function audita.lead_activities_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l audita.leads;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Atividades do lead são imutáveis' using errcode = '42501';
  end if;
  select * into l from audita.leads where id = new.lead_id;
  if l.id is null or l.status <> 'ativo' then
    raise exception 'Lead inexistente ou inativo' using errcode = '23514';
  end if;
  if new.kind in ('whatsapp', 'ligacao', 'email')
     and audita.is_suppressed(l.cnpj, coalesce(l.whatsapp_confirmed, l.phone_confirmed), l.email_confirmed) then
    raise exception 'Empresa na lista "não contatar": contato bloqueado' using errcode = '23514';
  end if;
  if new.occurred_at > now() + interval '5 minutes' then
    raise exception 'A atividade não pode ter data futura; use o próximo retorno' using errcode = '23514';
  end if;
  new.created_at := now();
  new.created_by := (select auth.uid());
  new.is_test := l.is_test;
  return new;
end;
$$;
create trigger lead_activities_guard before insert or update or delete on audita.lead_activities
  for each row execute function audita.lead_activities_guard();

-- Depois do contato: registra a data e, se o lead ainda não tinha sido contatado, avança a etapa
create or replace function audita.lead_activities_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update audita.leads l
     set last_activity_at = greatest(coalesce(l.last_activity_at, new.occurred_at), new.occurred_at),
         stage = case
           when new.kind in ('whatsapp', 'ligacao', 'email') and l.stage in ('identificada', 'importado', 'qualificado') then 'primeiro_contato'
           when new.outcome = 'reuniao_marcada' and l.stage in ('primeiro_contato', 'aguardando_retorno', 'negociacao') then 'reuniao'
           else l.stage end
   where l.id = new.lead_id;
  if new.outcome = 'nao_contatar' then
    insert into audita.contact_suppressions (cnpj, reason, is_test)
    select l.cnpj, 'Pediu para não ser contatado (registro de contato em ' || to_char(new.occurred_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') || ')', l.is_test
      from audita.leads l where l.id = new.lead_id and l.cnpj is not null and not audita.is_suppressed(l.cnpj);
  end if;
  return null;
end;
$$;
create trigger lead_activities_after after insert on audita.lead_activities
  for each row execute function audita.lead_activities_after();

-- "Não contatar": imutável; o lead da mesma empresa sai do funil como perdido
create or replace function audita.contact_suppressions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'A lista "não contatar" não pode ser alterada nem excluída' using errcode = '42501';
  end if;
  new.created_at := now();
  new.created_by := (select auth.uid());
  return new;
end;
$$;
create trigger contact_suppressions_guard before insert or update or delete on audita.contact_suppressions
  for each row execute function audita.contact_suppressions_guard();

create or replace function audita.contact_suppressions_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cnpj is not null then
    update audita.leads
       set stage = 'perdido', lost_reason = left('Não contatar: ' || new.reason, 500), next_action_at = null, next_action_note = null
     where cnpj = new.cnpj and stage not in ('cliente', 'perdido');
  end if;
  return null;
end;
$$;
create trigger contact_suppressions_after after insert on audita.contact_suppressions
  for each row execute function audita.contact_suppressions_after();
create trigger contact_suppressions_audit after insert on audita.contact_suppressions
  for each row execute function audita.log_row_change('id');

-- Registros imutáveis do histórico e das execuções
create or replace function audita.prospect_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Registro somente de inclusão (%)', tg_table_name using errcode = '42501';
end;
$$;
create trigger lead_stage_history_append_only before update or delete on audita.lead_stage_history
  for each row execute function audita.prospect_append_only();
create trigger prospect_search_runs_append_only before update or delete on audita.prospect_search_runs
  for each row execute function audita.prospect_append_only();

create or replace function audita.prospect_touch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  elsif new.created_by is distinct from old.created_by then
    raise exception 'Autor do registro é permanente' using errcode = '42501';
  end if;
  if to_jsonb(new) ? 'updated_at' then
    new := jsonb_populate_record(new, jsonb_build_object('updated_at', now()));
  end if;
  return new;
end;
$$;
create trigger prospect_niches_touch before insert or update on audita.prospect_niches
  for each row execute function audita.prospect_touch();
create trigger prospect_niches_audit after insert or update on audita.prospect_niches
  for each row execute function audita.log_row_change('id');
create trigger prospect_searches_touch before insert or update on audita.prospect_searches
  for each row execute function audita.prospect_touch();
create trigger prospect_keyword_groups_touch before insert or update on audita.prospect_keyword_groups
  for each row execute function audita.prospect_touch();
create trigger prospect_keywords_touch before insert or update on audita.prospect_keywords
  for each row execute function audita.prospect_touch();

-- ---------------------------------------------------------------------------
-- Carga inicial (planejamento aprovado em 14/11/2026, seção 17): nichos e palavras-chave
-- ---------------------------------------------------------------------------
insert into audita.prospect_niches (code, name, cnae_prefixes, service_codes, is_entry, sort_order, notes) values
  ('construcao', 'Construção civil', '{41,42,43}', '{SST-002,SST-009,DOC-001,TRN-NR35,TRN-NR06,SST-001}', true, 10, 'Nicho de entrada.'),
  ('atacado_logistica', 'Atacado, armazenagem e transporte', '{46,52,4930}', '{TRN-NR11-E,TRN-NR35,TRN-NR23,DOC-001,SST-002}', true, 20, 'Nicho de entrada.'),
  ('industria', 'Indústria de pequeno porte', '{10,11,13,14,15,16,17,18,20,21,22,23,24,25,28,29,30,31}', '{TRN-NR11-P,TRN-NR06,TRN-NR20,TRN-NR26B,DOC-001,SST-005}', true, 30, 'Nicho de entrada.'),
  ('oficinas', 'Manutenção e reparação de veículos', '{4520}', '{TRN-NR06,TRN-NR26B,DOC-001}', false, 40, null),
  ('combustiveis', 'Postos de combustíveis', '{4731}', '{TRN-NR20,TRN-NR23,DOC-001}', false, 50, null),
  ('residuos', 'Coleta e tratamento de resíduos', '{38,39}', '{AMB-001,AMB-002,DOC-001,TRN-NR06}', false, 60, null);

insert into audita.prospect_keyword_groups (name, purpose) values
  ('Segmentos', 'clientes'), ('SSMA', 'parceiros_concorrentes'), ('SGI', 'parceiros_concorrentes');
insert into audita.prospect_keywords (group_id, term)
select g.id, t.term
from audita.prospect_keyword_groups g
join (values
  ('Segmentos', 'indústria'), ('Segmentos', 'metalurgia'), ('Segmentos', 'construção civil'), ('Segmentos', 'transporte'),
  ('Segmentos', 'logística'), ('Segmentos', 'alimentos'), ('Segmentos', 'química'), ('Segmentos', 'engenharia'),
  ('SSMA', 'segurança do trabalho'), ('SSMA', 'saúde ocupacional'), ('SSMA', 'engenharia de segurança'), ('SSMA', 'gestão de riscos'),
  ('SSMA', 'consultoria em SST'), ('SSMA', 'treinamentos NR'), ('SSMA', 'PGR'), ('SSMA', 'GRO'), ('SSMA', 'PCMSO'),
  ('SGI', 'ISO 9001'), ('SGI', 'ISO 14001'), ('SGI', 'ISO 45001'), ('SGI', 'sistema de gestão integrada'), ('SGI', 'gestão da qualidade'),
  ('SGI', 'gestão ambiental'), ('SGI', 'auditoria interna'), ('SGI', 'consultoria ISO')
) as t(grp, term) on t.grp = g.name;

-- ---------------------------------------------------------------------------
-- RLS e permissões: administrador e operador (quem prospecta)
-- ---------------------------------------------------------------------------
alter table audita.cnpj_publications enable row level security;
alter table audita.ibge_municipalities enable row level security;
alter table audita.cnpj_establishments enable row level security;
alter table audita.prospect_niches enable row level security;
alter table audita.prospect_keyword_groups enable row level security;
alter table audita.prospect_keywords enable row level security;
alter table audita.prospect_searches enable row level security;
alter table audita.prospect_search_runs enable row level security;
alter table audita.contact_suppressions enable row level security;
alter table audita.leads enable row level security;
alter table audita.lead_stage_history enable row level security;
alter table audita.lead_activities enable row level security;

create policy cnpj_publications_select on audita.cnpj_publications for select to authenticated using ((select audita.can_operate()));
create policy ibge_municipalities_select on audita.ibge_municipalities for select to authenticated using ((select audita.can_operate()));
create policy cnpj_establishments_select on audita.cnpj_establishments for select to authenticated using ((select audita.can_operate()));

create policy prospect_niches_select on audita.prospect_niches for select to authenticated using ((select audita.can_operate()));
create policy prospect_niches_insert on audita.prospect_niches for insert to authenticated with check ((select audita.can_operate()));
create policy prospect_niches_update on audita.prospect_niches for update to authenticated using ((select audita.can_operate())) with check ((select audita.can_operate()));
create policy prospect_keyword_groups_select on audita.prospect_keyword_groups for select to authenticated using ((select audita.can_operate()));
create policy prospect_keyword_groups_insert on audita.prospect_keyword_groups for insert to authenticated with check ((select audita.can_operate()));
create policy prospect_keyword_groups_update on audita.prospect_keyword_groups for update to authenticated using ((select audita.can_operate())) with check ((select audita.can_operate()));
create policy prospect_keywords_select on audita.prospect_keywords for select to authenticated using ((select audita.can_operate()));
create policy prospect_keywords_insert on audita.prospect_keywords for insert to authenticated with check ((select audita.can_operate()));
create policy prospect_keywords_update on audita.prospect_keywords for update to authenticated using ((select audita.can_operate())) with check ((select audita.can_operate()));
create policy prospect_searches_select on audita.prospect_searches for select to authenticated using ((select audita.can_operate()));
create policy prospect_searches_insert on audita.prospect_searches for insert to authenticated with check ((select audita.can_operate()));
create policy prospect_searches_update on audita.prospect_searches for update to authenticated using ((select audita.can_operate())) with check ((select audita.can_operate()));
create policy prospect_search_runs_select on audita.prospect_search_runs for select to authenticated using ((select audita.can_operate()));
create policy prospect_search_runs_insert on audita.prospect_search_runs for insert to authenticated with check ((select audita.can_operate()));

create policy contact_suppressions_select on audita.contact_suppressions for select to authenticated using ((select audita.can_operate()));
create policy contact_suppressions_insert on audita.contact_suppressions for insert to authenticated with check ((select audita.can_operate()));

create policy leads_select on audita.leads for select to authenticated using ((select audita.can_operate()));
create policy leads_insert on audita.leads for insert to authenticated with check ((select audita.can_operate()));
create policy leads_update on audita.leads for update to authenticated using ((select audita.can_operate())) with check ((select audita.can_operate()));
create policy lead_stage_history_select on audita.lead_stage_history for select to authenticated using ((select audita.can_operate()));
create policy lead_activities_select on audita.lead_activities for select to authenticated using ((select audita.can_operate()));
create policy lead_activities_insert on audita.lead_activities for insert to authenticated with check ((select audita.can_operate()));

revoke all on audita.cnpj_publications, audita.ibge_municipalities, audita.cnpj_establishments, audita.prospect_niches,
  audita.prospect_keyword_groups, audita.prospect_keywords, audita.prospect_searches, audita.prospect_search_runs,
  audita.contact_suppressions, audita.leads, audita.lead_stage_history, audita.lead_activities from public, anon, authenticated;
grant select on audita.cnpj_publications, audita.ibge_municipalities, audita.cnpj_establishments, audita.lead_stage_history to authenticated;
grant select, insert, update on audita.prospect_niches, audita.prospect_keyword_groups, audita.prospect_keywords, audita.prospect_searches to authenticated;
grant select, insert on audita.prospect_search_runs, audita.contact_suppressions, audita.lead_activities to authenticated;
grant select, insert, update on audita.leads to authenticated;
grant all on audita.cnpj_publications, audita.ibge_municipalities, audita.cnpj_establishments, audita.prospect_niches,
  audita.prospect_keyword_groups, audita.prospect_keywords, audita.prospect_searches, audita.prospect_search_runs,
  audita.contact_suppressions, audita.leads, audita.lead_stage_history, audita.lead_activities to service_role;

revoke all on function audita.is_suppressed(text, text, text), audita.leads_before_write(), audita.leads_stage_log(),
  audita.lead_activities_guard(), audita.lead_activities_after(), audita.contact_suppressions_guard(),
  audita.contact_suppressions_after(), audita.prospect_append_only(), audita.prospect_touch() from public, anon, authenticated;
grant execute on function audita.is_suppressed(text, text, text) to authenticated;

notify pgrst, 'reload schema';
