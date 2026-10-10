-- I10 — Comunicação, SEM inteligência artificial (AUDDOC017 RF-25, RF-27, RF-28 e FL-04; RF-26 apenas o briefing manual).
-- Referências: AUDDOC017 §4 (menu Comunicação), §9, §10 (perfil Marketing), §13 FL-04, §18 (IA só após aprovação — D-08);
-- AUDDOC003 §02 (logotipos originais), §03 (paleta), §11 (comunicação, tom de voz), §12 (ativos e governança).
-- Fluxo FL-04 sem IA: modelo → briefing → rascunho manual → envio para revisão → revisão de marca e texto pelo administrador
-- → autorização → exportação registrada (fonte, versão e autorização). Nada é publicado ou agendado automaticamente.
-- Acesso: administrador e marketing (o marketing edita rascunhos; só o administrador aprova). Operador sem acesso
-- (modo mais restritivo). Logos: só o administrador envia e aprova; o marketing vê apenas versões aprovadas.
-- Sem exclusão física; nenhuma carga de dados. Somente aditiva.

-- ---------------------------------------------------------------------------
-- Biblioteca oficial de marca (RF-27; AUDDOC003 §12)
-- ---------------------------------------------------------------------------
create table audita.brand_assets (
  id          uuid primary key default gen_random_uuid(),
  brand       text not null check (brand in ('audita', 'pro', 'hub')),
  variant     text not null check (variant in ('original_png', 'png_transparente', 'vetor', 'pdf_vetorial', 'aplicacao', 'outro')),
  title       text not null check (length(btrim(title)) between 3 and 160),
  notes       text check (notes is null or length(notes) <= 2000),
  status      text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  unique (brand, variant, title)
);
comment on table audita.brand_assets is 'Ativos oficiais de marca (AUDDOC003 §12): AUDITA, Audita PRO e Audita HUB. Arquivos originais nunca alterados.';

create table audita.brand_asset_versions (
  id             uuid primary key default gen_random_uuid(),
  asset_id       uuid not null references audita.brand_assets (id) on delete restrict,
  version        integer not null,
  status         text not null default 'rascunho' check (status in ('rascunho', 'aprovado', 'substituido', 'cancelado')),
  storage_path   text not null unique check (storage_path like 'marca/%'),
  original_name  text not null check (length(original_name) between 1 and 255),
  mime_type      text not null check (mime_type in ('image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf')),
  size_bytes     bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  sha256         text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  width          integer check (width is null or width > 0),
  height         integer check (height is null or height > 0),
  source_note    text not null check (length(btrim(source_note)) between 5 and 500),
  status_note    text check (status_note is null or length(status_note) <= 500),
  approved_at    timestamptz,
  approved_by    uuid,
  is_test        boolean not null default false,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  unique (asset_id, version)
);
create unique index brand_asset_one_approved on audita.brand_asset_versions (asset_id) where status = 'aprovado';
comment on table audita.brand_asset_versions is 'Versões dos arquivos de marca com SHA-256; uma aprovada por ativo; histórico preservado.';

create or replace function audita.brand_asset_versions_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'rascunho';
    new.approved_at := null;
    new.approved_by := null;
    new.status_note := null;
    new.version := coalesce((select max(v.version) from audita.brand_asset_versions v where v.asset_id = new.asset_id), 0) + 1;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if coalesce(current_setting('audita.brand_flow', true), '') <> 'on'
     or (to_jsonb(new) - 'status' - 'status_note' - 'approved_at' - 'approved_by')
        <> (to_jsonb(old) - 'status' - 'status_note' - 'approved_at' - 'approved_by') then
    raise exception 'Versões de arquivos de marca são imutáveis; envie uma nova versão.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger brand_asset_versions_before_write
  before insert or update on audita.brand_asset_versions
  for each row execute function audita.brand_asset_versions_before_write();

create trigger brand_assets_set_updated_meta before update on audita.brand_assets
  for each row execute function audita.set_updated_meta();
create trigger brand_assets_audit after insert or update on audita.brand_assets
  for each row execute function audita.log_row_change('id', 'id');
create trigger brand_asset_versions_audit after insert or update on audita.brand_asset_versions
  for each row execute function audita.log_row_change('id', 'asset_id');

create or replace function audita.approve_brand_asset_version(p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v audita.brand_asset_versions;
  a audita.brand_assets;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into v from audita.brand_asset_versions where id = p_id for update;
  if not found then
    raise exception 'Versão não encontrada' using errcode = 'P0002';
  end if;
  select * into a from audita.brand_assets where id = v.asset_id;
  if v.status <> 'rascunho' then
    raise exception 'Somente rascunhos podem ser aprovados' using errcode = '22023';
  elsif a.status <> 'ativo' then
    raise exception 'Ativo inativo não recebe versão aprovada' using errcode = '22023';
  end if;
  perform set_config('audita.brand_flow', 'on', true);
  update audita.brand_asset_versions set status = 'substituido', status_note = 'Substituída pela versão ' || v.version
   where asset_id = v.asset_id and status = 'aprovado';
  update audita.brand_asset_versions
     set status = 'aprovado', approved_at = now(), approved_by = (select auth.uid()), status_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_id;
  perform set_config('audita.brand_flow', 'off', true);
end;
$$;

create or replace function audita.cancel_brand_asset_version(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe o motivo' using errcode = '23514';
  end if;
  perform set_config('audita.brand_flow', 'on', true);
  update audita.brand_asset_versions set status = 'cancelado', status_note = btrim(p_reason) where id = p_id and status = 'rascunho';
  if not found then
    raise exception 'Somente rascunhos podem ser cancelados' using errcode = '22023';
  end if;
  perform set_config('audita.brand_flow', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Campanhas (RF-25)
-- ---------------------------------------------------------------------------
create table audita.comm_campaigns (
  id             uuid primary key default gen_random_uuid(),
  campaign_code  text not null unique,
  name           text not null check (length(btrim(name)) between 3 and 160),
  objective      text check (objective is null or length(objective) <= 1000),
  audience       text check (audience is null or length(audience) <= 300),
  starts_on      date,
  ends_on        date,
  status         text not null default 'planejada' check (status in ('planejada', 'ativa', 'encerrada', 'cancelada')),
  notes          text check (notes is null or length(notes) <= 2000),
  is_test        boolean not null default false,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  constraint comm_campaigns_period check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
comment on table audita.comm_campaigns is 'Campanhas de comunicação (AUDDOC017 RF-25). Código CAM-AAAA-NNN permanente. Sem exclusão física.';

create or replace function audita.comm_campaigns_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.campaign_code := 'CAM-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-'
      || lpad(audita.allocate_code('campaign', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY'))::text, 3, '0');
    new.created_by := (select auth.uid());
  elsif new.campaign_code is distinct from old.campaign_code or new.is_test is distinct from old.is_test
        or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'Campo não pode ser alterado' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger comm_campaigns_before_write before insert or update on audita.comm_campaigns
  for each row execute function audita.comm_campaigns_before_write();
create trigger comm_campaigns_set_updated_meta before update on audita.comm_campaigns
  for each row execute function audita.set_updated_meta();
create trigger comm_campaigns_audit after insert or update on audita.comm_campaigns
  for each row execute function audita.log_row_change('id', 'id');

-- ---------------------------------------------------------------------------
-- Peças: briefing + conteúdo manual (RF-25, RF-26 sem IA)
-- ---------------------------------------------------------------------------
create table audita.comm_pieces (
  id               uuid primary key default gen_random_uuid(),
  piece_code       text not null unique,
  campaign_id      uuid references audita.comm_campaigns (id) on delete restrict,
  template         text not null check (template in ('post_quadrado', 'post_retrato', 'story', 'capa_apresentacao', 'comunicado_a4')),
  brand            text not null default 'audita' check (brand in ('audita', 'pro', 'hub')),
  -- briefing
  theme            text not null check (length(btrim(theme)) between 3 and 160),
  objective        text check (objective is null or length(objective) <= 500),
  audience         text check (audience is null or length(audience) <= 300),
  channel          text not null check (channel in ('instagram', 'linkedin', 'whatsapp', 'email', 'site', 'apresentacao', 'impresso', 'outro')),
  service_id       uuid references audita.services (id) on delete restrict,
  -- conteúdo (escrito por pessoas; sem IA)
  title            text check (title is null or length(title) <= 90),
  subtitle         text check (subtitle is null or length(subtitle) <= 160),
  body             text check (body is null or length(body) <= 700),
  cta              text check (cta is null or length(cta) <= 60),
  show_slogan      boolean not null default true,
  show_contacts    boolean not null default false,
  caption          text check (caption is null or length(caption) <= 2200),
  status           text not null default 'rascunho' check (status in ('rascunho', 'em_revisao', 'aprovada', 'cancelada')),
  current_version  integer not null default 0,
  status_note      text check (status_note is null or length(status_note) <= 500),
  is_test          boolean not null default false,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
comment on table audita.comm_pieces is 'Peças de comunicação (FL-04) escritas manualmente; exportação só após revisão e autorização (RF-28). Código COM-AAAA-NNNN.';
create index comm_pieces_campaign_idx on audita.comm_pieces (campaign_id);
create index comm_pieces_status_idx on audita.comm_pieces (status);

create or replace function audita.comm_pieces_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  flow boolean := coalesce(current_setting('audita.comm_flow', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    new.piece_code := 'COM-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-'
      || lpad(audita.allocate_code('comm_piece', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY'))::text, 4, '0');
    new.status := 'rascunho';
    new.current_version := 0;
    new.status_note := null;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if new.piece_code is distinct from old.piece_code or new.is_test is distinct from old.is_test
     or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'Campo não pode ser alterado' using errcode = '42501';
  end if;
  if not flow then
    if old.status <> 'rascunho' then
      raise exception 'Somente rascunhos podem ser editados; reabra a peça para uma nova versão.' using errcode = '42501';
    end if;
    if new.status is distinct from old.status or new.current_version is distinct from old.current_version
       or new.status_note is distinct from old.status_note then
      raise exception 'A situação da peça muda somente pelo fluxo de revisão.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger comm_pieces_before_write before insert or update on audita.comm_pieces
  for each row execute function audita.comm_pieces_before_write();
create trigger comm_pieces_set_updated_meta before update on audita.comm_pieces
  for each row execute function audita.set_updated_meta();
create trigger comm_pieces_audit after insert or update on audita.comm_pieces
  for each row execute function audita.log_row_change('id', 'id');

-- Versões enviadas para revisão: conteúdo congelado (snapshot) + decisão do administrador
create table audita.comm_piece_versions (
  id            uuid primary key default gen_random_uuid(),
  piece_id      uuid not null references audita.comm_pieces (id) on delete restrict,
  version       integer not null check (version >= 1),
  status        text not null default 'em_revisao' check (status in ('em_revisao', 'aprovada', 'devolvida', 'substituida')),
  snapshot      jsonb not null,
  submitted_at  timestamptz not null default now(),
  submitted_by  uuid,
  checklist     jsonb,
  review_note   text check (review_note is null or length(review_note) <= 1000),
  reviewed_at   timestamptz,
  reviewed_by   uuid,
  is_test       boolean not null default false,
  unique (piece_id, version)
);
comment on table audita.comm_piece_versions is 'Versões imutáveis das peças (FL-04 "arquivar versão"); autorização com checklist de marca e texto (RF-28).';

create or replace function audita.comm_piece_versions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('audita.comm_flow', true), '') <> 'on'
     or new.snapshot is distinct from old.snapshot or new.piece_id is distinct from old.piece_id
     or new.version is distinct from old.version or new.submitted_at is distinct from old.submitted_at
     or new.submitted_by is distinct from old.submitted_by or new.is_test is distinct from old.is_test
     or (old.reviewed_at is not null and (new.reviewed_at is distinct from old.reviewed_at or new.reviewed_by is distinct from old.reviewed_by
         or new.checklist is distinct from old.checklist or new.review_note is distinct from old.review_note)) then
    raise exception 'Versões de peças são imutáveis' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger comm_piece_versions_guard before update or delete on audita.comm_piece_versions
  for each row execute function audita.comm_piece_versions_guard();
create trigger comm_piece_versions_audit after insert or update on audita.comm_piece_versions
  for each row execute function audita.log_row_change('id', 'piece_id');

-- Exportações (RF-28: fonte, versão e autorização registradas)
create table audita.comm_exports (
  id           uuid primary key default gen_random_uuid(),
  version_id   uuid not null references audita.comm_piece_versions (id) on delete restrict,
  piece_id     uuid not null references audita.comm_pieces (id) on delete restrict,
  format       text not null check (format in ('png', 'pdf')),
  sha256       text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes   bigint not null check (size_bytes > 0),
  exported_at  timestamptz not null default now(),
  exported_by  uuid,
  is_test      boolean not null default false
);
comment on table audita.comm_exports is 'Registro de cada arquivo exportado de uma versão aprovada (somente inclusão).';
create index comm_exports_piece_idx on audita.comm_exports (piece_id);

create or replace function audita.comm_exports_block_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Registro de exportação não pode ser alterado' using errcode = '42501';
end;
$$;
create trigger comm_exports_block_changes before update or delete on audita.comm_exports
  for each row execute function audita.comm_exports_block_changes();
create trigger comm_exports_audit after insert on audita.comm_exports
  for each row execute function audita.log_row_change('id', 'piece_id');

-- ---------------------------------------------------------------------------
-- Funções do fluxo
-- ---------------------------------------------------------------------------
create or replace function audita.can_communicate()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select audita.has_role('admin', 'marketing');
$$;

-- Logo aprovado preferido de cada marca: PNG transparente aprovado; senão, PNG original aprovado
create or replace function audita.approved_brand_logo(p_brand text)
returns audita.brand_asset_versions
language sql
stable
security definer
set search_path = ''
as $$
  select v.*
    from audita.brand_asset_versions v
    join audita.brand_assets a on a.id = v.asset_id
   where a.brand = p_brand and a.status = 'ativo' and v.status = 'aprovado'
     and a.variant in ('png_transparente', 'original_png') and v.mime_type = 'image/png'
   order by case a.variant when 'png_transparente' then 0 else 1 end, v.approved_at desc
   limit 1;
$$;

-- Contatos oficiais vigentes (I9.2) para peças: somente os canais públicos; nada além disso
create or replace function audita.comm_official_contacts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p audita.institutional_profiles;
begin
  if not audita.can_communicate() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into p from audita.institutional_profiles where status = 'vigente';
  if p.id is null then
    return null;
  end if;
  return jsonb_build_object('profile_version', p.version, 'email', p.email, 'phone', p.phone, 'website', p.website, 'is_test', p.is_test);
end;
$$;

-- Serviços do catálogo para o briefing (código, nome e situação; sem preços nem dados internos)
create or replace function audita.comm_service_options()
returns table (id uuid, service_code text, name text, commercial_status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not audita.can_communicate() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  return query
    select s.id, s.service_code, s.name, s.commercial_status
      from audita.services s
     where s.catalog_status = 'ativo'
     order by s.service_code;
end;
$$;

create or replace function audita.submit_comm_piece(p_piece_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p     audita.comm_pieces;
  logo  audita.brand_asset_versions;
  svc   jsonb;
  camp  jsonb;
  n     integer;
  vid   uuid;
begin
  if not audita.can_communicate() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into p from audita.comm_pieces where id = p_piece_id for update;
  if not found then
    raise exception 'Peça não encontrada' using errcode = 'P0002';
  elsif p.status <> 'rascunho' then
    raise exception 'Somente rascunhos podem ser enviados para revisão' using errcode = '22023';
  elsif length(btrim(coalesce(p.title, ''))) < 3 then
    raise exception 'Informe o título da peça antes de enviar' using errcode = '23514';
  end if;
  logo := audita.approved_brand_logo(p.brand);
  if p.service_id is not null then
    select jsonb_build_object('id', s.id, 'service_code', s.service_code, 'name', s.name, 'commercial_status', s.commercial_status)
      into svc from audita.services s where s.id = p.service_id;
  end if;
  if p.campaign_id is not null then
    select jsonb_build_object('id', c.id, 'campaign_code', c.campaign_code, 'name', c.name) into camp
      from audita.comm_campaigns c where c.id = p.campaign_id;
  end if;
  n := p.current_version + 1;
  insert into audita.comm_piece_versions (piece_id, version, snapshot, submitted_by, is_test)
  values (p.id, n,
    jsonb_build_object(
      'schema', 1,
      'frozen_at', now(),
      'piece', to_jsonb(p) - 'created_by' - 'updated_by' - 'status' - 'status_note' - 'current_version' - 'created_at' - 'updated_at',
      'campaign', camp,
      'service', svc,
      'logo', case when logo.id is null then null else jsonb_build_object(
                'version_id', logo.id, 'asset_id', logo.asset_id, 'version', logo.version, 'storage_path', logo.storage_path,
                'sha256', logo.sha256, 'width', logo.width, 'height', logo.height, 'is_test', logo.is_test) end,
      'contacts', case when p.show_contacts then audita.comm_official_contacts() else null end
    ),
    (select auth.uid()), p.is_test)
  returning id into vid;
  perform set_config('audita.comm_flow', 'on', true);
  update audita.comm_pieces set status = 'em_revisao', current_version = n, status_note = null where id = p.id;
  perform set_config('audita.comm_flow', 'off', true);
  return vid;
end;
$$;

-- Revisão de marca e texto pelo administrador. Aprovar exige: checklist completo, logo oficial aprovado congelado,
-- serviço citado "Apto comercialmente" (AUDDOC004/005) e contatos oficiais quando a peça os exibe.
create or replace function audita.review_comm_piece(p_version_id uuid, p_decision text, p_note text, p_checklist jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v    audita.comm_piece_versions;
  p    audita.comm_pieces;
  k    text;
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not audita.is_admin() then
    raise exception 'Somente o administrador revisa e autoriza peças' using errcode = '42501';
  end if;
  select * into v from audita.comm_piece_versions where id = p_version_id for update;
  if not found then
    raise exception 'Versão não encontrada' using errcode = 'P0002';
  end if;
  select * into p from audita.comm_pieces where id = v.piece_id for update;
  if v.status <> 'em_revisao' or p.status <> 'em_revisao' or p.current_version <> v.version then
    raise exception 'Esta versão não está aguardando revisão' using errcode = '22023';
  end if;
  perform set_config('audita.comm_flow', 'on', true);
  if p_decision = 'aprovar' then
    foreach k in array array['marca', 'identidade', 'texto', 'tom', 'dados'] loop
      if coalesce((p_checklist ->> k)::boolean, false) is not true then
        raise exception 'Confirme todos os itens da revisão' using errcode = '23514';
      end if;
    end loop;
    if v.snapshot -> 'logo' is null or jsonb_typeof(v.snapshot -> 'logo') = 'null' then
      raise exception 'Logo oficial sem versão aprovada na biblioteca de marca' using errcode = '23514';
    end if;
    if jsonb_typeof(v.snapshot -> 'service') = 'object' and v.snapshot #>> '{service,commercial_status}' <> 'apto_comercialmente' then
      raise exception 'Serviço citado não está liberado comercialmente (AUDDOC004)' using errcode = '23514';
    end if;
    if (v.snapshot #>> '{piece,show_contacts}')::boolean
       and (jsonb_typeof(v.snapshot -> 'contacts') <> 'object'
            or coalesce(v.snapshot #>> '{contacts,email}', v.snapshot #>> '{contacts,phone}', v.snapshot #>> '{contacts,website}') is null) then
      raise exception 'Contatos oficiais pendentes nos dados institucionais' using errcode = '23514';
    end if;
    update audita.comm_piece_versions set status = 'substituida' where piece_id = p.id and status = 'aprovada';
    update audita.comm_piece_versions
       set status = 'aprovada', checklist = p_checklist, review_note = note, reviewed_at = now(), reviewed_by = (select auth.uid())
     where id = v.id;
    update audita.comm_pieces set status = 'aprovada', status_note = note where id = p.id;
  elsif p_decision = 'devolver' then
    if note is null or length(note) < 5 then
      raise exception 'Informe o que precisa ser corrigido' using errcode = '23514';
    end if;
    update audita.comm_piece_versions
       set status = 'devolvida', checklist = p_checklist, review_note = note, reviewed_at = now(), reviewed_by = (select auth.uid())
     where id = v.id;
    update audita.comm_pieces set status = 'rascunho', status_note = note where id = p.id;
  else
    raise exception 'Decisão inválida' using errcode = '22023';
  end if;
  perform set_config('audita.comm_flow', 'off', true);
end;
$$;

-- Reabrir uma peça aprovada para nova versão (a aprovada continua exportável até outra ser aprovada)
create or replace function audita.reopen_comm_piece(p_piece_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not audita.can_communicate() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe o motivo' using errcode = '23514';
  end if;
  perform set_config('audita.comm_flow', 'on', true);
  update audita.comm_pieces set status = 'rascunho', status_note = btrim(p_reason) where id = p_piece_id and status = 'aprovada';
  if not found then
    raise exception 'Somente peças aprovadas podem ser reabertas' using errcode = '22023';
  end if;
  perform set_config('audita.comm_flow', 'off', true);
end;
$$;

create or replace function audita.cancel_comm_piece(p_piece_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not audita.is_admin() then
    raise exception 'Somente o administrador cancela peças' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe o motivo' using errcode = '23514';
  end if;
  perform set_config('audita.comm_flow', 'on', true);
  update audita.comm_pieces set status = 'cancelada', status_note = btrim(p_reason) where id = p_piece_id and status <> 'cancelada';
  if not found then
    raise exception 'Peça não encontrada ou já cancelada' using errcode = '22023';
  end if;
  update audita.comm_piece_versions set status = 'substituida' where piece_id = p_piece_id and status in ('aprovada', 'em_revisao');
  perform set_config('audita.comm_flow', 'off', true);
end;
$$;

-- Exportação: somente de versão aprovada (vigente); grava formato, SHA-256 e autor
create or replace function audita.register_comm_export(p_version_id uuid, p_format text, p_sha256 text, p_size bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v   audita.comm_piece_versions;
  eid uuid;
begin
  if not audita.can_communicate() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into v from audita.comm_piece_versions where id = p_version_id;
  if not found then
    raise exception 'Versão não encontrada' using errcode = 'P0002';
  elsif v.status <> 'aprovada' then
    raise exception 'Somente versões aprovadas podem ser exportadas' using errcode = '22023';
  end if;
  insert into audita.comm_exports (version_id, piece_id, format, sha256, size_bytes, exported_by, is_test)
  values (v.id, v.piece_id, p_format, p_sha256, p_size, (select auth.uid()), v.is_test)
  returning id into eid;
  return eid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Armazenamento privado dos arquivos de marca
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audita-marca', 'audita-marca', false, 20971520, array['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf'])
on conflict (id) do nothing;

create policy audita_marca_select on storage.objects for select to authenticated
  using (bucket_id = 'audita-marca' and (
    (select audita.is_admin())
    or ((select audita.has_role('marketing')) and exists (
          select 1 from audita.brand_asset_versions v where v.storage_path = name and v.status = 'aprovado'))));
create policy audita_marca_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'audita-marca' and (select audita.is_admin()) and name like 'marca/%');
-- O operador não acessa este bucket (modo mais restritivo)
create policy audita_marca_restrito_operador on storage.objects as restrictive
  for all to authenticated
  using (bucket_id <> 'audita-marca' or not (select audita.has_role('operador')))
  with check (bucket_id <> 'audita-marca' or not (select audita.has_role('operador')));

-- ---------------------------------------------------------------------------
-- RLS e privilégios
-- ---------------------------------------------------------------------------
alter table audita.brand_assets enable row level security;
alter table audita.brand_asset_versions enable row level security;
alter table audita.comm_campaigns enable row level security;
alter table audita.comm_pieces enable row level security;
alter table audita.comm_piece_versions enable row level security;
alter table audita.comm_exports enable row level security;

create policy brand_assets_select on audita.brand_assets for select to authenticated using ((select audita.can_communicate()));
create policy brand_assets_insert on audita.brand_assets for insert to authenticated with check ((select audita.is_admin()));
create policy brand_assets_update on audita.brand_assets for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));

create policy brand_asset_versions_select on audita.brand_asset_versions for select to authenticated
  using ((select audita.is_admin()) or ((select audita.has_role('marketing')) and status = 'aprovado'));
create policy brand_asset_versions_insert on audita.brand_asset_versions for insert to authenticated
  with check ((select audita.is_admin()));

create policy comm_campaigns_select on audita.comm_campaigns for select to authenticated using ((select audita.can_communicate()));
create policy comm_campaigns_insert on audita.comm_campaigns for insert to authenticated with check ((select audita.can_communicate()));
create policy comm_campaigns_update on audita.comm_campaigns for update to authenticated
  using ((select audita.can_communicate())) with check ((select audita.can_communicate()));

create policy comm_pieces_select on audita.comm_pieces for select to authenticated using ((select audita.can_communicate()));
create policy comm_pieces_insert on audita.comm_pieces for insert to authenticated with check ((select audita.can_communicate()));
create policy comm_pieces_update on audita.comm_pieces for update to authenticated
  using ((select audita.can_communicate()) and status = 'rascunho') with check ((select audita.can_communicate()));

create policy comm_piece_versions_select on audita.comm_piece_versions for select to authenticated
  using ((select audita.can_communicate()));
create policy comm_exports_select on audita.comm_exports for select to authenticated
  using ((select audita.can_communicate()));

revoke all on audita.brand_assets, audita.brand_asset_versions, audita.comm_campaigns, audita.comm_pieces,
  audita.comm_piece_versions, audita.comm_exports from public, anon, authenticated;
grant select, insert, update on audita.brand_assets, audita.comm_campaigns, audita.comm_pieces to authenticated;
grant select, insert on audita.brand_asset_versions to authenticated;
grant select on audita.comm_piece_versions, audita.comm_exports to authenticated;
grant all on audita.brand_assets, audita.brand_asset_versions, audita.comm_campaigns, audita.comm_pieces,
  audita.comm_piece_versions, audita.comm_exports to service_role;

revoke all on function
  audita.brand_asset_versions_before_write(), audita.comm_campaigns_before_write(), audita.comm_pieces_before_write(),
  audita.comm_piece_versions_guard(), audita.comm_exports_block_changes(),
  audita.can_communicate(), audita.approved_brand_logo(text), audita.comm_official_contacts(), audita.comm_service_options(),
  audita.approve_brand_asset_version(uuid, text), audita.cancel_brand_asset_version(uuid, text),
  audita.submit_comm_piece(uuid), audita.review_comm_piece(uuid, text, text, jsonb), audita.reopen_comm_piece(uuid, text),
  audita.cancel_comm_piece(uuid, text), audita.register_comm_export(uuid, text, text, bigint)
  from public, anon, authenticated;
grant execute on function
  audita.can_communicate(), audita.comm_official_contacts(), audita.comm_service_options(),
  audita.approve_brand_asset_version(uuid, text), audita.cancel_brand_asset_version(uuid, text),
  audita.submit_comm_piece(uuid), audita.review_comm_piece(uuid, text, text, jsonb), audita.reopen_comm_piece(uuid, text),
  audita.cancel_comm_piece(uuid, text), audita.register_comm_export(uuid, text, text, bigint)
  to authenticated;
grant all on function audita.approved_brand_logo(text) to service_role;

notify pgrst, 'reload schema';
