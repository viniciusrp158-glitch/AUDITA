-- AUDITA — T1 Treinamentos EAD: cadastro de treinamentos, versões, módulos e materiais (etapa 1 da plataforma de
-- treinamentos; plano em docs/TREINAMENTOS.md). Somente acréscimos.
--
-- Treinamento (código permanente, ex.: L01) × versões (1.2, 1.3…). Só uma versão em rascunho e uma publicada por
-- treinamento; a publicada fica congelada (módulos e arquivos imutáveis) e uma nova versão copia a anterior.
-- Cada módulo segue o padrão Apostila → Videoaula → Avaliação; o Módulo 01 é sempre a Ambientação.
-- Materiais: arquivos privados (SHA-256) separados em material do aluno (apostila, ficha técnica) e da equipe
-- (roteiro, gabarito, slides, plano pedagógico). Nada é excluído: arquivos trocados ficam como "removido".

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table audita.training_courses (
  id            uuid primary key default gen_random_uuid(),
  course_code   text not null unique check (course_code ~ '^[A-Z]{1,4}[0-9]{2,3}$'),
  title         text not null check (length(btrim(title)) between 5 and 200),
  price         numeric(12, 2) check (price is null or price >= 0),
  access_days   integer check (access_days is null or access_days between 1 and 3650),
  status        text not null default 'ativo' check (status in ('ativo', 'inativo')),
  notes         text check (notes is null or length(notes) <= 2000),
  search_text   text generated always as (audita.normalize_text(course_code || ' ' || title)) stored,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
comment on table audita.training_courses is 'Treinamentos EAD. Código permanente; preço e prazo de acesso valem para todas as versões (preço nulo = PENDENTE).';
create index training_courses_search_trgm on audita.training_courses using gin (search_text extensions.gin_trgm_ops);

create table audita.training_versions (
  id                 uuid primary key default gen_random_uuid(),
  course_id          uuid not null references audita.training_courses (id) on delete restrict,
  version_label      text not null check (version_label ~ '^[0-9]{1,2}\.[0-9]{1,2}$'),
  status             text not null default 'rascunho' check (status in ('rascunho', 'publicada', 'substituida', 'cancelada')),
  title              text not null check (length(btrim(title)) between 5 and 200),
  summary            text check (summary is null or length(summary) <= 1000),
  modality           text check (modality is null or length(modality) <= 300),
  workload_minutes   integer check (workload_minutes is null or workload_minutes between 1 and 60000),
  audience           text check (audience is null or length(audience) <= 2000),
  prerequisites      text check (prerequisites is null or length(prerequisites) <= 2000),
  general_objective  text check (general_objective is null or length(general_objective) <= 2000),
  methodology        text check (methodology is null or length(methodology) <= 4000),
  assessment_rules   text check (assessment_rules is null or length(assessment_rules) <= 4000),
  resources          text check (resources is null or length(resources) <= 2000),
  references_text    text check (references_text is null or length(references_text) <= 4000),
  important_notice   text check (important_notice is null or length(important_notice) <= 2000),
  instructor_name    text check (instructor_name is null or length(btrim(instructor_name)) between 3 and 200),
  status_note        text check (status_note is null or length(status_note) <= 1000),
  published_at       timestamptz,
  published_by       uuid,
  created_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  unique (course_id, version_label),
  constraint training_versions_published_consistent check ((status in ('publicada', 'substituida')) = (published_at is not null))
);
comment on table audita.training_versions is 'Versões de um treinamento com a ficha técnica. Editável só em rascunho; publicada fica congelada.';
create unique index training_versions_one_draft on audita.training_versions (course_id) where status = 'rascunho';
create unique index training_versions_one_published on audita.training_versions (course_id) where status = 'publicada';

create table audita.training_modules (
  id                uuid primary key default gen_random_uuid(),
  version_id        uuid not null references audita.training_versions (id) on delete restrict,
  position          integer not null check (position between 1 and 99),
  title             text not null check (length(btrim(title)) between 3 and 200),
  objective         text check (objective is null or length(objective) <= 2000),
  content_summary   text check (content_summary is null or length(content_summary) <= 4000),
  video_minutes     integer check (video_minutes is null or video_minutes between 0 and 600),
  reading_minutes   integer check (reading_minutes is null or reading_minutes between 0 and 600),
  activity_minutes  integer check (activity_minutes is null or activity_minutes between 0 and 600),
  video_url         text check (video_url is null or video_url ~ '^https://(www\.)?(youtube\.com/(watch\?v=|embed/|live/)|youtu\.be/)[A-Za-z0-9_-]{11}([?&#][A-Za-z0-9_=&.-]*)?$'),
  is_orientation    boolean not null default false,
  status            text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at        timestamptz not null default now(),
  created_by        uuid default auth.uid(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid,
  constraint training_modules_orientation_first check (not is_orientation or position = 1)
);
comment on table audita.training_modules is 'Módulos de uma versão (Apostila → Videoaula → Avaliação). O Módulo 01 é a Ambientação.';
create index training_modules_version_idx on audita.training_modules (version_id, position);
create unique index training_modules_one_orientation on audita.training_modules (version_id) where is_orientation;

create table audita.training_files (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references audita.training_versions (id) on delete restrict,
  module_id     uuid references audita.training_modules (id) on delete restrict,
  kind          text not null check (kind in ('ficha_tecnica', 'plano_pedagogico', 'orientacoes', 'gabarito_consolidado',
                                              'apostila', 'avaliacao_pdf', 'roteiro', 'gabarito', 'slides_pdf', 'slide_imagem')),
  audience      text generated always as (case when kind in ('ficha_tecnica', 'apostila') then 'aluno' else 'equipe' end) stored,
  position      integer not null default 1 check (position between 1 and 999),
  storage_path  text not null check (storage_path ~ '^training/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'),
  original_name text not null check (length(original_name) between 3 and 255),
  mime_type     text not null,
  size_bytes    integer not null check (size_bytes between 1 and 52428800),
  sha256        text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status        text not null default 'ativo' check (status in ('ativo', 'removido')),
  removed_at    timestamptz,
  removed_by    uuid,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  constraint training_files_scope check (
    (kind in ('ficha_tecnica', 'plano_pedagogico', 'orientacoes', 'gabarito_consolidado')) = (module_id is null)),
  constraint training_files_removed_consistent check ((status = 'removido') = (removed_at is not null))
);
comment on table audita.training_files is 'Arquivos privados de uma versão (SHA-256). Público: aluno (apostila, ficha técnica) ou equipe. Nunca substituídos: trocar = novo arquivo + anterior removido.';
create index training_files_version_idx on audita.training_files (version_id, module_id, kind, position);
create unique index training_files_one_active on audita.training_files
  (version_id, coalesce(module_id, '00000000-0000-0000-0000-000000000000'::uuid), kind)
  where status = 'ativo' and kind <> 'slide_imagem';

-- ---------------------------------------------------------------------------
-- Regras
-- ---------------------------------------------------------------------------
create or replace function audita.training_flow_on()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('audita.training_flow', true), '') = 'on';
$$;

create or replace function audita.training_version_is_draft(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from audita.training_versions v where v.id = p_version_id and v.status = 'rascunho');
$$;

create or replace function audita.training_courses_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := (select auth.uid());
    return new;
  end if;
  if new.id is distinct from old.id or new.course_code is distinct from old.course_code
     or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'O código do treinamento é permanente' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger training_courses_before_write
  before insert or update on audita.training_courses
  for each row execute function audita.training_courses_before_write();
create trigger training_courses_set_updated_meta
  before update on audita.training_courses
  for each row execute function audita.set_updated_meta();
create trigger training_courses_audit
  after insert or update on audita.training_courses
  for each row execute function audita.log_row_change('id');

create or replace function audita.training_versions_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'rascunho';
    new.published_at := null;
    new.published_by := null;
    new.status_note := null;
    new.created_at := now();
    new.created_by := (select auth.uid());
    return new;
  end if;
  if new.id is distinct from old.id or new.course_id is distinct from old.course_id or new.version_label is distinct from old.version_label
     or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'Treinamento e número da versão são permanentes' using errcode = '42501';
  end if;
  if new.status is distinct from old.status or new.published_at is distinct from old.published_at
     or new.published_by is distinct from old.published_by or new.status_note is distinct from old.status_note then
    if not audita.training_flow_on() then
      raise exception 'A situação da versão muda somente pela publicação ou cancelamento' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.status <> 'rascunho' then
    raise exception 'Versão publicada não pode ser alterada; crie uma nova versão' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger training_versions_before_write
  before insert or update on audita.training_versions
  for each row execute function audita.training_versions_before_write();
create trigger training_versions_set_updated_meta
  before update on audita.training_versions
  for each row execute function audita.set_updated_meta();
create trigger training_versions_audit
  after insert or update on audita.training_versions
  for each row execute function audita.log_row_change('id', 'course_id');

create or replace function audita.training_modules_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not audita.training_version_is_draft(new.version_id) then
    raise exception 'Módulos só podem ser alterados em versão em rascunho' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := (select auth.uid());
    if not new.is_orientation and new.position = 1 then
      raise exception 'A posição 1 é reservada à Ambientação' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.id is distinct from old.id or new.version_id is distinct from old.version_id or new.is_orientation is distinct from old.is_orientation
     or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'Versão e tipo do módulo são permanentes' using errcode = '42501';
  end if;
  if new.position is distinct from old.position and not audita.training_flow_on() then
    raise exception 'A ordem dos módulos muda somente pela função de mover' using errcode = '42501';
  end if;
  if old.is_orientation and new.status <> 'ativo' then
    raise exception 'A Ambientação é obrigatória e não pode ser inativada' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger training_modules_before_write
  before insert or update on audita.training_modules
  for each row execute function audita.training_modules_before_write();
create trigger training_modules_set_updated_meta
  before update on audita.training_modules
  for each row execute function audita.set_updated_meta();
create trigger training_modules_audit
  after insert or update on audita.training_modules
  for each row execute function audita.log_row_change('id', 'version_id');

create or replace function audita.training_files_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course uuid;
begin
  if not audita.training_version_is_draft(new.version_id) then
    raise exception 'Arquivos só podem ser alterados em versão em rascunho' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.status := 'ativo';
    new.removed_at := null;
    new.removed_by := null;
    new.created_at := now();
    new.created_by := (select auth.uid());
    select v.course_id into v_course from audita.training_versions v where v.id = new.version_id;
    if new.storage_path not like ('training/' || v_course::text || '/%') then
      raise exception 'Caminho do arquivo fora do treinamento' using errcode = '22023';
    end if;
    if new.module_id is not null
       and not exists (select 1 from audita.training_modules m where m.id = new.module_id and m.version_id = new.version_id) then
      raise exception 'Módulo de outra versão' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'audita-treinamentos' and o.name = new.storage_path) then
      raise exception 'Arquivo não encontrado no armazenamento' using errcode = '22023';
    end if;
    return new;
  end if;
  -- O arquivo é permanente; só pode ser marcado como removido (a troca é um arquivo novo)
  if new.id is distinct from old.id or new.version_id is distinct from old.version_id or new.module_id is distinct from old.module_id
     or new.kind is distinct from old.kind or new.position is distinct from old.position or new.storage_path is distinct from old.storage_path
     or new.original_name is distinct from old.original_name or new.mime_type is distinct from old.mime_type
     or new.size_bytes is distinct from old.size_bytes or new.sha256 is distinct from old.sha256
     or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'O arquivo é permanente; envie um novo arquivo para substituir' using errcode = '42501';
  end if;
  if old.status = 'removido' and new.status <> 'removido' then
    raise exception 'Arquivo removido não volta a ficar ativo; envie novamente' using errcode = '42501';
  end if;
  if new.status = 'removido' and old.status = 'ativo' then
    new.removed_at := now();
    new.removed_by := (select auth.uid());
  else
    new.removed_at := old.removed_at;
    new.removed_by := old.removed_by;
  end if;
  return new;
end;
$$;
create trigger training_files_before_write
  before insert or update on audita.training_files
  for each row execute function audita.training_files_before_write();
create trigger training_files_audit
  after insert or update on audita.training_files
  for each row execute function audita.log_row_change('id', 'version_id');

-- ---------------------------------------------------------------------------
-- Fluxos (somente administradores)
-- ---------------------------------------------------------------------------

-- Novo treinamento: cria o cadastro, a primeira versão em rascunho e o Módulo 01 (Ambientação)
create or replace function audita.training_create_course(p_code text, p_title text, p_version text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course uuid;
  v_version uuid;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  insert into audita.training_courses (course_code, title) values (upper(btrim(p_code)), btrim(p_title)) returning id into v_course;
  insert into audita.training_versions (course_id, version_label, title) values (v_course, btrim(p_version), btrim(p_title)) returning id into v_version;
  insert into audita.training_modules (version_id, position, title, is_orientation) values (v_version, 1, 'Ambientação', true);
  return v_course;
end;
$$;

-- Novo módulo no fim da lista
create or replace function audita.training_add_module(p_version_id uuid, p_title text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pos integer;
  v_id uuid;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  perform 1 from audita.training_versions v where v.id = p_version_id for update;
  select coalesce(max(position), 1) + 1 into v_pos from audita.training_modules where version_id = p_version_id;
  if v_pos > 99 then
    raise exception 'Limite de módulos atingido' using errcode = '23514';
  end if;
  insert into audita.training_modules (version_id, position, title) values (p_version_id, v_pos, btrim(p_title)) returning id into v_id;
  return v_id;
end;
$$;

-- Move um módulo uma posição para cima (-1) ou para baixo (+1); a Ambientação fica sempre em primeiro
create or replace function audita.training_move_module(p_module_id uuid, p_direction integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m audita.training_modules;
  other audita.training_modules;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  if p_direction not in (-1, 1) then
    raise exception 'Direção inválida' using errcode = '22023';
  end if;
  select * into m from audita.training_modules where id = p_module_id for update;
  if not found then
    raise exception 'Módulo não encontrado' using errcode = 'P0002';
  end if;
  if m.is_orientation then
    raise exception 'A Ambientação é sempre o Módulo 01' using errcode = '23514';
  end if;
  select * into other from audita.training_modules
   where version_id = m.version_id and position = m.position + p_direction for update;
  if not found or other.is_orientation then
    return;
  end if;
  perform set_config('audita.training_flow', 'on', true);
  update audita.training_modules set position = other.position where id = m.id;
  update audita.training_modules set position = m.position where id = other.id;
  perform set_config('audita.training_flow', 'off', true);
end;
$$;

-- Publica o rascunho: a publicada anterior passa a substituída (continua consultável)
create or replace function audita.training_publish_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v audita.training_versions;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into v from audita.training_versions where id = p_version_id for update;
  if not found then
    raise exception 'Versão não encontrada' using errcode = 'P0002';
  end if;
  if v.status <> 'rascunho' then
    raise exception 'Somente versões em rascunho podem ser publicadas' using errcode = '22023';
  end if;
  perform 1 from audita.training_courses c where c.id = v.course_id and c.status = 'ativo';
  if not found then
    raise exception 'Treinamento inativo não recebe versão publicada' using errcode = '23514';
  end if;
  if v.workload_minutes is null then
    raise exception 'Informe a carga horária antes de publicar' using errcode = '23514';
  end if;
  if not exists (select 1 from audita.training_modules m where m.version_id = v.id and m.status = 'ativo' and not m.is_orientation) then
    raise exception 'A versão precisa de pelo menos um módulo além da Ambientação' using errcode = '23514';
  end if;
  if exists (
    select 1 from audita.training_modules m
     where m.version_id = v.id and m.status = 'ativo'
       and not exists (select 1 from audita.training_files f where f.module_id = m.id and f.kind = 'apostila' and f.status = 'ativo')
  ) then
    raise exception 'Todo módulo ativo precisa da apostila antes de publicar' using errcode = '23514';
  end if;
  perform set_config('audita.training_flow', 'on', true);
  update audita.training_versions
     set status = 'substituida',
         status_note = format('Substituída pela versão %s em %s.', v.version_label, to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'))
   where course_id = v.course_id and status = 'publicada';
  update audita.training_versions set status = 'publicada', published_at = now(), published_by = (select auth.uid()) where id = v.id;
  perform set_config('audita.training_flow', 'off', true);
end;
$$;

-- Cancela um rascunho (registro e arquivos permanecem para rastreabilidade)
create or replace function audita.training_cancel_version(p_version_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v audita.training_versions;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into v from audita.training_versions where id = p_version_id for update;
  if not found then
    raise exception 'Versão não encontrada' using errcode = 'P0002';
  end if;
  if v.status <> 'rascunho' then
    raise exception 'Somente rascunhos podem ser cancelados' using errcode = '22023';
  end if;
  if v_reason is null or length(v_reason) < 5 then
    raise exception 'Informe o motivo do cancelamento' using errcode = '23514';
  end if;
  perform set_config('audita.training_flow', 'on', true);
  update audita.training_versions set status = 'cancelada', status_note = v_reason where id = v.id;
  perform set_config('audita.training_flow', 'off', true);
end;
$$;

-- Nova versão a partir da publicada: copia ficha técnica, módulos e arquivos ativos (mesmos objetos do armazenamento)
create or replace function audita.training_new_version(p_course_id uuid, p_label text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  src audita.training_versions;
  v_new uuid;
  m audita.training_modules;
  v_mod uuid;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  if exists (select 1 from audita.training_versions where course_id = p_course_id and status = 'rascunho') then
    raise exception 'Já existe uma versão em rascunho; publique ou cancele antes' using errcode = '23514';
  end if;
  select * into src from audita.training_versions where course_id = p_course_id and status = 'publicada';
  if not found then
    raise exception 'Não há versão publicada para copiar' using errcode = '23514';
  end if;
  insert into audita.training_versions (course_id, version_label, title, summary, modality, workload_minutes, audience, prerequisites,
                                        general_objective, methodology, assessment_rules, resources, references_text,
                                        important_notice, instructor_name)
  values (p_course_id, btrim(p_label), src.title, src.summary, src.modality, src.workload_minutes, src.audience, src.prerequisites,
          src.general_objective, src.methodology, src.assessment_rules, src.resources, src.references_text,
          src.important_notice, src.instructor_name)
  returning id into v_new;
  insert into audita.training_files (version_id, module_id, kind, position, storage_path, original_name, mime_type, size_bytes, sha256)
  select v_new, null, f.kind, f.position, f.storage_path, f.original_name, f.mime_type, f.size_bytes, f.sha256
    from audita.training_files f where f.version_id = src.id and f.module_id is null and f.status = 'ativo';
  for m in select * from audita.training_modules where version_id = src.id order by position loop
    insert into audita.training_modules (version_id, position, title, objective, content_summary, video_minutes, reading_minutes,
                                         activity_minutes, video_url, is_orientation, status)
    values (v_new, m.position, m.title, m.objective, m.content_summary, m.video_minutes, m.reading_minutes,
            m.activity_minutes, m.video_url, m.is_orientation, m.status)
    returning id into v_mod;
    insert into audita.training_files (version_id, module_id, kind, position, storage_path, original_name, mime_type, size_bytes, sha256)
    select v_new, v_mod, f.kind, f.position, f.storage_path, f.original_name, f.mime_type, f.size_bytes, f.sha256
      from audita.training_files f where f.module_id = m.id and f.status = 'ativo';
  end loop;
  return v_new;
end;
$$;

create or replace function audita.log_training_download(p_file_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f audita.training_files;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into f from audita.training_files where id = p_file_id;
  if not found then
    raise exception 'Arquivo não encontrado' using errcode = 'P0002';
  end if;
  insert into audita.audit_log (actor_user_id, action, entity, entity_id, parent_entity_id, summary, origin)
  values ((select auth.uid()), 'download', 'training_files', f.id::text, f.version_id::text,
          jsonb_build_object('file_name', f.original_name, 'kind', f.kind), 'app');
end;
$$;

-- ---------------------------------------------------------------------------
-- Armazenamento privado: somente administradores; sem atualização nem exclusão
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audita-treinamentos', 'audita-treinamentos', false, 52428800,
        array['application/pdf', 'image/png', 'image/jpeg',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy audita_treinamentos_select on storage.objects for select to authenticated
  using (bucket_id = 'audita-treinamentos' and (select audita.is_admin()));
create policy audita_treinamentos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'audita-treinamentos' and (select audita.is_admin()) and name like 'training/%');

-- ---------------------------------------------------------------------------
-- RLS e privilégios
-- ---------------------------------------------------------------------------
alter table audita.training_courses enable row level security;
alter table audita.training_versions enable row level security;
alter table audita.training_modules enable row level security;
alter table audita.training_files enable row level security;

create policy training_courses_select on audita.training_courses for select to authenticated using ((select audita.is_admin()));
create policy training_courses_insert on audita.training_courses for insert to authenticated with check ((select audita.is_admin()));
create policy training_courses_update on audita.training_courses for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));
create policy training_versions_select on audita.training_versions for select to authenticated using ((select audita.is_admin()));
create policy training_versions_update on audita.training_versions for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));
create policy training_modules_select on audita.training_modules for select to authenticated using ((select audita.is_admin()));
create policy training_modules_update on audita.training_modules for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));
create policy training_files_select on audita.training_files for select to authenticated using ((select audita.is_admin()));
create policy training_files_insert on audita.training_files for insert to authenticated with check ((select audita.is_admin()));
create policy training_files_update on audita.training_files for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));

revoke all on audita.training_courses, audita.training_versions, audita.training_modules, audita.training_files
  from public, anon, authenticated;
grant select, update on audita.training_courses, audita.training_versions, audita.training_modules to authenticated;
grant insert on audita.training_files to authenticated;
grant select, update on audita.training_files to authenticated;

revoke all on function audita.training_flow_on(), audita.training_version_is_draft(uuid),
  audita.training_courses_before_write(), audita.training_versions_before_write(), audita.training_modules_before_write(),
  audita.training_files_before_write(), audita.training_create_course(text, text, text), audita.training_add_module(uuid, text),
  audita.training_move_module(uuid, integer), audita.training_publish_version(uuid), audita.training_cancel_version(uuid, text),
  audita.training_new_version(uuid, text), audita.log_training_download(uuid)
  from public, anon, authenticated;
grant execute on function audita.training_flow_on(), audita.training_version_is_draft(uuid) to authenticated;
grant execute on function audita.training_create_course(text, text, text), audita.training_add_module(uuid, text),
  audita.training_move_module(uuid, integer), audita.training_publish_version(uuid), audita.training_cancel_version(uuid, text),
  audita.training_new_version(uuid, text), audita.log_training_download(uuid) to authenticated;

grant all on all tables in schema audita to service_role;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
