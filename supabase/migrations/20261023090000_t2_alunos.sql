-- AUDITA — T2 Treinamentos: alunos, matrículas e acesso do aluno ao conteúdo (área do aluno em audita.seg.br/treinamentos).
-- Somente acréscimos. Plano em docs/TREINAMENTOS.md.
--
-- Aluno ≠ usuário do sistema: a conta (auth.users) é criada pela função "alunos" (convite por e-mail) e o aluno nunca
-- entra em audita.app_users, logo não acessa nenhuma tela da equipe. Cada matrícula fica presa à versão publicada no
-- momento em que foi feita (o aluno termina o curso na mesma versão, mesmo que outra seja publicada depois).
-- O aluno só enxerga: o próprio cadastro, as próprias matrículas e o conteúdo das versões em que está matriculado
-- (somente os arquivos do aluno — apostila e ficha técnica; nunca roteiros, gabaritos ou slides).

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table audita.training_students (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique,
  full_name    text not null check (length(btrim(full_name)) between 3 and 160),
  email        text not null unique check (email = lower(email) and length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  cpf          text check (cpf is null or audita.is_valid_cpf(cpf)),
  company      text check (company is null or length(btrim(company)) between 2 and 200),
  phone        text check (phone is null or phone ~ '^\d{10,13}$'),
  status       text not null default 'ativo' check (status in ('ativo', 'inativo')),
  source       text not null check (source in ('gestao', 'lote', 'cadastro', 'compra')),
  is_test      boolean not null default false,
  search_text  text generated always as (audita.normalize_text(full_name || ' ' || email || ' ' || coalesce(company, ''))) stored,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);
comment on table audita.training_students is 'Alunos dos treinamentos EAD (contas próprias, separadas dos usuários do sistema).';
create index training_students_search_trgm on audita.training_students using gin (search_text extensions.gin_trgm_ops);

create table audita.training_enrollments (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references audita.training_students (id) on delete restrict,
  course_id     uuid not null references audita.training_courses (id) on delete restrict,
  version_id    uuid not null references audita.training_versions (id) on delete restrict,
  status        text not null default 'ativa' check (status in ('ativa', 'suspensa', 'cancelada', 'concluida')),
  starts_on     date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  access_until  date,
  source        text not null check (source in ('gestao', 'lote', 'compra', 'cortesia')),
  notes         text check (notes is null or length(notes) <= 1000),
  status_note   text check (status_note is null or length(status_note) <= 1000),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  constraint training_enrollments_dates check (access_until is null or access_until >= starts_on)
);
comment on table audita.training_enrollments is 'Matrículas: aluno × treinamento, presa à versão publicada na matrícula; prazo de acesso opcional.';
create unique index training_enrollments_one_open on audita.training_enrollments (student_id, course_id) where status in ('ativa', 'suspensa');
create index training_enrollments_course_idx on audita.training_enrollments (course_id, status);

create table audita.training_progress (
  id             uuid primary key default gen_random_uuid(),
  enrollment_id  uuid not null references audita.training_enrollments (id) on delete restrict,
  module_id      uuid not null references audita.training_modules (id) on delete restrict,
  step           text not null check (step in ('apostila', 'video', 'avaliacao')),
  completed_at   timestamptz not null default now(),
  unique (enrollment_id, module_id, step)
);
comment on table audita.training_progress is 'Etapas concluídas pelo aluno (Apostila, Videoaula, Avaliação) em cada módulo da matrícula.';

-- ---------------------------------------------------------------------------
-- Funções de apoio (aluno da sessão; acesso ao conteúdo)
-- ---------------------------------------------------------------------------
create or replace function audita.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from audita.training_students s where s.user_id = (select auth.uid()) and s.status = 'ativo';
$$;

-- Matrícula em vigor do aluno da sessão para a versão (ativa e dentro do prazo)
create or replace function audita.training_student_has_version(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from audita.training_enrollments e
     where e.version_id = p_version_id
       and e.student_id = audita.current_student_id()
       and e.status in ('ativa', 'concluida')
       and (e.access_until is null or e.access_until >= (now() at time zone 'America/Sao_Paulo')::date)
  );
$$;

create or replace function audita.training_student_can_read_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from audita.training_files f
     where f.storage_path = p_name and f.audience = 'aluno' and f.status = 'ativo'
       and audita.training_student_has_version(f.version_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Regras
-- ---------------------------------------------------------------------------
create or replace function audita.training_students_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.email := lower(btrim(new.email));
    new.created_at := now();
    new.created_by := (select auth.uid());
    return new;
  end if;
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.email is distinct from old.email
     or new.source is distinct from old.source or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'Conta, e-mail e origem do aluno são permanentes' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger training_students_before_write
  before insert or update on audita.training_students
  for each row execute function audita.training_students_before_write();
create trigger training_students_set_updated_meta
  before update on audita.training_students
  for each row execute function audita.set_updated_meta();
create trigger training_students_audit
  after insert or update on audita.training_students
  for each row execute function audita.log_row_change('id');

create or replace function audita.training_enrollments_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Inserção só pela função training_enroll (que liga a marca audita.training_enroll)
  if tg_op = 'INSERT' then
    if coalesce(current_setting('audita.training_enroll', true), '') <> 'on' then
      raise exception 'Matrículas são criadas pela função de matrícula' using errcode = '42501';
    end if;
    new.status := 'ativa';
    new.completed_at := null;
    new.created_at := now();
    new.created_by := (select auth.uid());
    return new;
  end if;
  if new.id is distinct from old.id or new.student_id is distinct from old.student_id or new.course_id is distinct from old.course_id
     or new.version_id is distinct from old.version_id or new.source is distinct from old.source or new.starts_on is distinct from old.starts_on
     or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'Aluno, treinamento, versão e origem da matrícula são permanentes' using errcode = '42501';
  end if;
  if old.status in ('cancelada', 'concluida') and new.status is distinct from old.status then
    raise exception 'Matrícula cancelada ou concluída não muda de situação; faça nova matrícula' using errcode = '23514';
  end if;
  if ((new.status = 'concluida' and old.status <> 'concluida') or new.completed_at is distinct from old.completed_at)
     and not audita.training_flow_on() then
    raise exception 'A conclusão é registrada pelo sistema' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger training_enrollments_before_write
  before insert or update on audita.training_enrollments
  for each row execute function audita.training_enrollments_before_write();
create trigger training_enrollments_set_updated_meta
  before update on audita.training_enrollments
  for each row execute function audita.set_updated_meta();
create trigger training_enrollments_audit
  after insert or update on audita.training_enrollments
  for each row execute function audita.log_row_change('id', 'course_id');

create or replace function audita.training_progress_block_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'O progresso do aluno é registrado só pelo sistema' using errcode = '42501';
end;
$$;
create trigger training_progress_block_changes
  before update or delete on audita.training_progress
  for each row execute function audita.training_progress_block_changes();

-- ---------------------------------------------------------------------------
-- Fluxos
-- ---------------------------------------------------------------------------

-- Matrícula (administrador): na versão publicada; prazo padrão = prazo de acesso do treinamento
create or replace function audita.training_enroll(p_student_id uuid, p_course_id uuid, p_access_until date, p_source text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version uuid;
  v_days integer;
  v_id uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  if p_source not in ('gestao', 'lote', 'compra', 'cortesia') then
    raise exception 'Origem da matrícula inválida' using errcode = '22023';
  end if;
  perform 1 from audita.training_students s where s.id = p_student_id and s.status = 'ativo';
  if not found then
    raise exception 'Aluno não encontrado ou inativo' using errcode = '23514';
  end if;
  select c.access_days into v_days from audita.training_courses c where c.id = p_course_id and c.status = 'ativo';
  if not found then
    raise exception 'Treinamento não encontrado ou inativo' using errcode = '23514';
  end if;
  select v.id into v_version from audita.training_versions v where v.course_id = p_course_id and v.status = 'publicada';
  if v_version is null then
    raise exception 'O treinamento ainda não tem versão publicada' using errcode = '23514';
  end if;
  if exists (select 1 from audita.training_enrollments e where e.student_id = p_student_id and e.course_id = p_course_id and e.status in ('ativa', 'suspensa')) then
    raise exception 'O aluno já está matriculado neste treinamento' using errcode = '23505';
  end if;
  if p_access_until is not null and p_access_until < v_today then
    raise exception 'O prazo de acesso não pode estar no passado' using errcode = '23514';
  end if;
  perform set_config('audita.training_enroll', 'on', true);
  insert into audita.training_enrollments (student_id, course_id, version_id, access_until, source)
  values (p_student_id, p_course_id, v_version,
          coalesce(p_access_until, case when v_days is not null then v_today + v_days end), p_source)
  returning id into v_id;
  perform set_config('audita.training_enroll', 'off', true);
  return v_id;
end;
$$;

-- Primeiro acesso do aluno: confirma que a conta da sessão é um aluno ativo e devolve o cadastro
create or replace function audita.training_me()
returns table (id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.full_name, s.email from audita.training_students s where s.user_id = (select auth.uid()) and s.status = 'ativo';
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table audita.training_students enable row level security;
alter table audita.training_enrollments enable row level security;
alter table audita.training_progress enable row level security;

create policy training_students_admin_select on audita.training_students for select to authenticated using ((select audita.is_admin()));
create policy training_students_admin_insert on audita.training_students for insert to authenticated with check ((select audita.is_admin()));
create policy training_students_admin_update on audita.training_students for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));
create policy training_students_self_select on audita.training_students for select to authenticated using (user_id = (select auth.uid()));

create policy training_enrollments_admin_select on audita.training_enrollments for select to authenticated using ((select audita.is_admin()));
create policy training_enrollments_admin_update on audita.training_enrollments for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));
create policy training_enrollments_self_select on audita.training_enrollments for select to authenticated
  using (student_id = (select audita.current_student_id()));

create policy training_progress_admin_select on audita.training_progress for select to authenticated using ((select audita.is_admin()));
create policy training_progress_self_select on audita.training_progress for select to authenticated
  using (exists (select 1 from audita.training_enrollments e where e.id = enrollment_id and e.student_id = (select audita.current_student_id())));

-- Conteúdo para o aluno matriculado (somente leitura; arquivos só do público "aluno")
create policy training_courses_student_select on audita.training_courses for select to authenticated
  using (exists (select 1 from audita.training_versions v where v.course_id = training_courses.id and audita.training_student_has_version(v.id)));
create policy training_versions_student_select on audita.training_versions for select to authenticated
  using ((select audita.training_student_has_version(id)));
create policy training_modules_student_select on audita.training_modules for select to authenticated
  using (status = 'ativo' and audita.training_student_has_version(version_id));
create policy training_files_student_select on audita.training_files for select to authenticated
  using (audience = 'aluno' and status = 'ativo' and audita.training_student_has_version(version_id));

create policy audita_treinamentos_student_select on storage.objects for select to authenticated
  using (bucket_id = 'audita-treinamentos' and audita.training_student_can_read_object(name));

revoke all on audita.training_students, audita.training_enrollments, audita.training_progress from public, anon, authenticated;
grant select, insert, update on audita.training_students to authenticated;
grant select, update on audita.training_enrollments to authenticated;
grant select on audita.training_progress to authenticated;

revoke all on function audita.current_student_id(), audita.training_student_has_version(uuid), audita.training_student_can_read_object(text),
  audita.training_students_before_write(), audita.training_enrollments_before_write(), audita.training_progress_block_changes(),
  audita.training_enroll(uuid, uuid, date, text), audita.training_me()
  from public, anon, authenticated;
grant execute on function audita.current_student_id(), audita.training_student_has_version(uuid), audita.training_student_can_read_object(text),
  audita.training_enroll(uuid, uuid, date, text), audita.training_me() to authenticated;

grant all on all tables in schema audita to service_role;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
