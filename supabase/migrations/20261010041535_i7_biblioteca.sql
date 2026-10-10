-- AUDITA — I7 Biblioteca documental (AUDDOC001–AUDDOC017, anexos e fontes oficiais)
-- Referências: AUDDOC017 RF-19, RF-20, RF-21, RF-22, RF-24, FL-03, CA-09, CA-10, §18 (acervo: minutas nunca vigentes);
-- AUDDOC001 (controle documental); AUDDOC013 (preservação de versões). Somente acréscimos.
--
-- Documento lógico (código AUDDOC…) × revisões (Rev.NN) com arquivo próprio. Upload nunca substitui: cada revisão
-- tem seu arquivo, SHA-256 e situação; só uma vigente por documento; publicadas são imutáveis; nada é excluído.

create table audita.library_documents (
  id             uuid primary key default gen_random_uuid(),
  doc_code       text not null unique check (doc_code ~ '^AUDDOC\d{3}(-ANX\d{2})?$'),
  title          text not null check (length(btrim(title)) between 3 and 300),
  kind           text not null default 'documento' check (kind in ('documento', 'anexo')),
  parent_id      uuid references audita.library_documents (id) on delete restrict,
  family         text not null check (length(btrim(family)) between 2 and 80),
  phase          text not null check (phase in ('fase1', 'fase2', 'fase3')),
  visibility     text not null default 'interno' check (visibility in ('interno', 'externo')),
  status         text not null default 'ativo' check (status in ('ativo', 'inativo')),
  notes          text check (notes is null or length(notes) <= 2000),
  search_text    text generated always as (audita.normalize_text(doc_code || ' ' || title || ' ' || family)) stored,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  constraint library_documents_annex_has_parent check ((kind = 'anexo') = (parent_id is not null)),
  constraint library_documents_annex_code check ((kind = 'anexo') = (doc_code ~ '-ANX\d{2}$'))
);
comment on table audita.library_documents is 'Documentos oficiais da AUDITA (AUDDOC e anexos). Código permanente; inativação lógica; arquivos nas revisões.';
create index library_documents_search_trgm on audita.library_documents using gin (search_text extensions.gin_trgm_ops);

create table audita.library_revisions (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references audita.library_documents (id) on delete restrict,
  revision        text not null check (revision ~ '^Rev\.\d{2}$'),
  status          text not null default 'rascunho' check (status in ('rascunho', 'vigente', 'substituido', 'cancelado')),
  approved_by     text check (approved_by is null or length(approved_by) <= 200),
  approved_on     date,
  issued_on       date,
  storage_path    text not null unique check (storage_path ~ '^library/[0-9a-f-]{36}/rev\d{2}/[A-Za-z0-9._-]+$'),
  original_name   text not null check (length(original_name) between 3 and 255),
  mime_type       text not null,
  size_bytes      integer not null check (size_bytes between 1 and 52428800),
  sha256          text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  notes           text check (notes is null or length(notes) <= 2000),
  status_note     text check (status_note is null or length(status_note) <= 1000),
  published_at    timestamptz,
  published_by    uuid,
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid,
  unique (document_id, revision),
  constraint library_revisions_published_consistent check ((status in ('vigente', 'substituido')) = (published_at is not null)),
  constraint library_revisions_vigente_approved check (status not in ('vigente', 'substituido') or (approved_by is not null and approved_on is not null))
);
comment on table audita.library_revisions is 'Revisões dos documentos oficiais com arquivo privado (SHA-256). Upload nunca substitui revisão anterior (CA-09).';
create unique index library_revisions_one_vigente on audita.library_revisions (document_id) where status = 'vigente';
create index library_revisions_sha_idx on audita.library_revisions (sha256);

-- ---------------------------------------------------------------------------
-- Regras
-- ---------------------------------------------------------------------------
create or replace function audita.library_documents_before_write()
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
  if new.id is distinct from old.id or new.doc_code is distinct from old.doc_code or new.kind is distinct from old.kind
     or new.parent_id is distinct from old.parent_id or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by then
    raise exception 'Código, tipo e vínculo do documento são permanentes' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger library_documents_before_write
  before insert or update on audita.library_documents
  for each row execute function audita.library_documents_before_write();
create trigger library_documents_set_updated_meta
  before update on audita.library_documents
  for each row execute function audita.set_updated_meta();
create trigger library_documents_audit
  after insert or update on audita.library_documents
  for each row execute function audita.log_row_change('id', 'id');

create or replace function audita.library_revisions_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  flow boolean := coalesce(current_setting('audita.library_flow', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    new.status := 'rascunho';
    new.published_at := null;
    new.published_by := null;
    new.status_note := null;
    new.created_at := now();
    new.created_by := (select auth.uid());
    -- O arquivo precisa existir no bucket privado, no caminho do próprio documento e revisão
    if new.storage_path not like ('library/' || new.document_id::text || '/rev' || substr(new.revision, 5, 2) || '/%') then
      raise exception 'Caminho do arquivo fora do documento/revisão' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'audita-biblioteca' and o.name = new.storage_path) then
      raise exception 'Arquivo não encontrado no armazenamento' using errcode = '22023';
    end if;
    return new;
  end if;
  -- Arquivo, revisão e criação são permanentes
  if new.id is distinct from old.id or new.document_id is distinct from old.document_id or new.revision is distinct from old.revision
     or new.storage_path is distinct from old.storage_path or new.original_name is distinct from old.original_name
     or new.mime_type is distinct from old.mime_type or new.size_bytes is distinct from old.size_bytes
     or new.sha256 is distinct from old.sha256 or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'O arquivo de uma revisão é permanente; envie uma nova revisão' using errcode = '42501';
  end if;
  if new.status is distinct from old.status or new.published_at is distinct from old.published_at
     or new.published_by is distinct from old.published_by or new.status_note is distinct from old.status_note then
    if not flow then
      raise exception 'A situação da revisão muda somente pela publicação ou cancelamento' using errcode = '42501';
    end if;
    return new;
  end if;
  -- Metadados (aprovação, datas, observações) só no rascunho
  if old.status <> 'rascunho' then
    raise exception 'Revisões publicadas não podem ser alteradas' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger library_revisions_before_write
  before insert or update on audita.library_revisions
  for each row execute function audita.library_revisions_before_write();
create trigger library_revisions_set_updated_meta
  before update on audita.library_revisions
  for each row execute function audita.set_updated_meta();
create trigger library_revisions_audit
  after insert or update on audita.library_revisions
  for each row execute function audita.log_row_change('id', 'document_id');

-- Publicar: rascunho → vigente; a vigente anterior passa a substituída (continua acessível — CA-09)
create or replace function audita.publish_library_revision(p_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r audita.library_revisions;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into r from audita.library_revisions where id = p_revision_id for update;
  if not found then
    raise exception 'Revisão não encontrada' using errcode = 'P0002';
  end if;
  if r.status <> 'rascunho' then
    raise exception 'Somente rascunhos podem ser publicados' using errcode = '22023';
  end if;
  if r.approved_by is null or length(btrim(r.approved_by)) < 3 or r.approved_on is null then
    raise exception 'Informe quem aprovou e a data de aprovação antes de publicar' using errcode = '23514';
  end if;
  perform 1 from audita.library_documents d where d.id = r.document_id and d.status = 'ativo';
  if not found then
    raise exception 'Documento inativo não recebe revisão vigente' using errcode = '23514';
  end if;
  perform set_config('audita.library_flow', 'on', true);
  update audita.library_revisions
     set status = 'substituido', status_note = format('Substituída pela %s em %s.', r.revision, to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'))
   where document_id = r.document_id and status = 'vigente';
  update audita.library_revisions
     set status = 'vigente', published_at = now(), published_by = (select auth.uid())
   where id = r.id;
  perform set_config('audita.library_flow', 'off', true);
end;
$$;

-- Cancelar rascunho (ex.: arquivo errado); o registro e o arquivo permanecem para rastreabilidade
create or replace function audita.cancel_library_revision(p_revision_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r audita.library_revisions;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into r from audita.library_revisions where id = p_revision_id for update;
  if not found then
    raise exception 'Revisão não encontrada' using errcode = 'P0002';
  end if;
  if r.status <> 'rascunho' then
    raise exception 'Somente rascunhos podem ser cancelados' using errcode = '22023';
  end if;
  if v_reason is null or length(v_reason) < 5 then
    raise exception 'Informe o motivo do cancelamento' using errcode = '23514';
  end if;
  perform set_config('audita.library_flow', 'on', true);
  update audita.library_revisions set status = 'cancelado', status_note = v_reason where id = r.id;
  perform set_config('audita.library_flow', 'off', true);
end;
$$;

create or replace function audita.log_library_download(p_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r audita.library_revisions;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into r from audita.library_revisions where id = p_revision_id;
  if not found then
    raise exception 'Revisão não encontrada' using errcode = 'P0002';
  end if;
  insert into audita.audit_log (actor_user_id, action, entity, entity_id, parent_entity_id, summary, origin)
  values ((select auth.uid()), 'download', 'library_revisions', r.id::text, r.document_id::text,
          jsonb_build_object('file_name', r.original_name, 'revision', r.revision, 'status', r.status), 'app');
end;
$$;

-- ---------------------------------------------------------------------------
-- Armazenamento privado (RF-22): somente autorizados; sem atualização nem exclusão
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audita-biblioteca', 'audita-biblioteca', false, 52428800,
        array['application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'application/pdf', 'image/png', 'image/jpeg', 'image/svg+xml'])
on conflict (id) do nothing;

create policy audita_biblioteca_select on storage.objects for select to authenticated
  using (bucket_id = 'audita-biblioteca' and (select audita.is_admin()));
create policy audita_biblioteca_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'audita-biblioteca' and (select audita.is_admin()) and name like 'library/%');

-- ---------------------------------------------------------------------------
-- RLS e privilégios
-- ---------------------------------------------------------------------------
alter table audita.library_documents enable row level security;
alter table audita.library_revisions enable row level security;

create policy library_documents_select on audita.library_documents for select to authenticated using ((select audita.is_admin()));
create policy library_documents_insert on audita.library_documents for insert to authenticated with check ((select audita.is_admin()));
create policy library_documents_update on audita.library_documents for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));
create policy library_revisions_select on audita.library_revisions for select to authenticated using ((select audita.is_admin()));
create policy library_revisions_insert on audita.library_revisions for insert to authenticated with check ((select audita.is_admin()));
create policy library_revisions_update on audita.library_revisions for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));

revoke all on audita.library_documents, audita.library_revisions from public, anon, authenticated;
grant select, insert, update on audita.library_documents, audita.library_revisions to authenticated;

revoke all on function audita.library_documents_before_write(), audita.library_revisions_before_write(),
  audita.publish_library_revision(uuid), audita.cancel_library_revision(uuid, text), audita.log_library_download(uuid)
  from public, anon, authenticated;
grant execute on function audita.publish_library_revision(uuid), audita.cancel_library_revision(uuid, text),
  audita.log_library_download(uuid) to authenticated;

grant all on all tables in schema audita to service_role;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
