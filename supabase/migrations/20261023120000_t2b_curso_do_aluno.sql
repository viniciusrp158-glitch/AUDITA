-- AUDITA — T2b/c/d Treinamentos: curso do aluno (progresso e módulos em sequência), banco de questões e provas com
-- cronômetro, certificado com código de verificação. Somente acréscimos. Plano em docs/TREINAMENTOS.md.
--
-- Regras do material (L01, LEIA_PRIMEIRO e ficha técnica):
--   * cada módulo segue Apostila → Videoaula → Avaliação; o próximo módulo abre quando o anterior é concluído;
--   * avaliações dos módulos são obrigatórias e sem nota; a final (nota mínima) aprova com N acertos;
--   * o retorno de cada questão aparece depois do envio; o da avaliação com nota segue a política de tentativas
--     (só depois da aprovação ou quando acabam as tentativas);
--   * certificado de curso livre ao concluir todos os módulos.
-- O aluno nunca lê as questões direto da tabela (a resposta certa fica lá): tudo passa pelas funções abaixo, que conferem
-- a matrícula, o prazo, a ordem dos módulos e o tempo de prova no servidor.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table audita.training_assessments (
  id                  uuid primary key default gen_random_uuid(),
  module_id           uuid not null unique references audita.training_modules (id) on delete restrict,
  version_id          uuid not null references audita.training_versions (id) on delete restrict,
  time_limit_minutes  integer check (time_limit_minutes is null or time_limit_minutes between 1 and 600),
  max_attempts        integer check (max_attempts is null or max_attempts between 1 and 50),
  retry_wait_hours    integer not null default 0 check (retry_wait_hours between 0 and 720),
  pass_score          integer check (pass_score is null or pass_score between 1 and 200),
  shuffle_questions   boolean not null default false,
  created_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid
);
comment on table audita.training_assessments is 'Avaliação de um módulo: tempo de prova, tentativas, intervalo e nota mínima (nula = sem nota).';

create table audita.training_questions (
  id             uuid primary key default gen_random_uuid(),
  assessment_id  uuid not null references audita.training_assessments (id) on delete restrict,
  position       integer not null check (position between 1 and 200),
  code           text not null check (code ~ '^M[0-9]{2}-[QACR][0-9]{2}$'),
  kind           text not null check (kind in ('objetiva', 'aberta')),
  statement      text not null check (length(btrim(statement)) between 5 and 4000),
  options        jsonb,
  correct_key    text check (correct_key is null or correct_key in ('A', 'B', 'C', 'D', 'E')),
  feedback       text check (feedback is null or length(feedback) <= 4000),
  status         text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  unique (assessment_id, code),
  constraint training_questions_kind check (
    (kind = 'objetiva' and correct_key is not null and jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 5)
    or (kind = 'aberta' and correct_key is null and options is null))
);
comment on table audita.training_questions is 'Banco de questões. Objetiva: alternativas, resposta certa e retorno ao aluno. Aberta: resposta de referência.';
comment on column audita.training_questions.feedback is 'Objetiva: "Retorno ao aluno" do gabarito. Aberta: "Resposta esperada", mostrada depois do envio.';

create table audita.training_attempts (
  id                    uuid primary key default gen_random_uuid(),
  enrollment_id         uuid not null references audita.training_enrollments (id) on delete restrict,
  assessment_id         uuid not null references audita.training_assessments (id) on delete restrict,
  attempt_number        integer not null check (attempt_number between 1 and 999),
  status                text not null default 'em_andamento' check (status in ('em_andamento', 'enviada')),
  question_ids          uuid[] not null,
  started_at            timestamptz not null default now(),
  deadline_at           timestamptz,
  submitted_at          timestamptz,
  submitted_by_timeout  boolean not null default false,
  score                 integer,
  max_score             integer,
  passed                boolean,
  unique (enrollment_id, assessment_id, attempt_number),
  constraint training_attempts_submitted check ((status = 'enviada') = (submitted_at is not null))
);
comment on table audita.training_attempts is 'Tentativas de avaliação do aluno; a correção é feita no servidor.';
create unique index training_attempts_one_open on audita.training_attempts (enrollment_id, assessment_id) where status = 'em_andamento';

create table audita.training_attempt_answers (
  attempt_id   uuid not null references audita.training_attempts (id) on delete restrict,
  question_id  uuid not null references audita.training_questions (id) on delete restrict,
  choice       text check (choice is null or choice in ('A', 'B', 'C', 'D', 'E')),
  answer_text  text check (answer_text is null or length(answer_text) <= 4000),
  is_correct   boolean,
  saved_at     timestamptz not null default now(),
  primary key (attempt_id, question_id)
);
comment on table audita.training_attempt_answers is 'Respostas de cada tentativa (salvas automaticamente durante a prova).';

create table audita.training_certificates (
  id                uuid primary key default gen_random_uuid(),
  enrollment_id     uuid not null unique references audita.training_enrollments (id) on delete restrict,
  code              text not null unique check (code ~ '^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$'),
  student_name      text not null,
  course_code       text not null,
  course_title      text not null,
  version_label     text not null,
  workload_minutes  integer,
  instructor_name   text,
  started_on        date not null,
  completed_on      date not null,
  final_score       integer,
  final_max_score   integer,
  status            text not null default 'valido' check (status in ('valido', 'cancelado')),
  status_note       text check (status_note is null or length(status_note) <= 1000),
  issued_at         timestamptz not null default now()
);
comment on table audita.training_certificates is 'Certificados de curso livre (dados congelados na emissão; cancelamento com motivo, nunca exclusão).';

-- ---------------------------------------------------------------------------
-- Regras de escrita
-- ---------------------------------------------------------------------------
create or replace function audita.training_assessments_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_version uuid;
begin
  if tg_op = 'INSERT' then
    select m.version_id into v_version from audita.training_modules m where m.id = new.module_id;
    new.version_id := v_version;
    new.created_at := now();
    new.created_by := (select auth.uid());
  elsif new.id is distinct from old.id or new.module_id is distinct from old.module_id or new.version_id is distinct from old.version_id
        or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'Módulo da avaliação é permanente' using errcode = '42501';
  end if;
  if not audita.training_version_is_draft(new.version_id) then
    raise exception 'Avaliações só podem ser alteradas em versão em rascunho' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger training_assessments_before_write
  before insert or update on audita.training_assessments
  for each row execute function audita.training_assessments_before_write();
create trigger training_assessments_set_updated_meta
  before update on audita.training_assessments
  for each row execute function audita.set_updated_meta();
create trigger training_assessments_audit
  after insert or update on audita.training_assessments
  for each row execute function audita.log_row_change('id', 'version_id');

create or replace function audita.training_questions_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_version uuid;
begin
  if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.assessment_id is distinct from old.assessment_id or new.code is distinct from old.code
     or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by) then
    raise exception 'Código e avaliação da questão são permanentes' using errcode = '42501';
  end if;
  select a.version_id into v_version from audita.training_assessments a where a.id = new.assessment_id;
  if not audita.training_version_is_draft(v_version) then
    raise exception 'Questões só podem ser alteradas em versão em rascunho' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := (select auth.uid());
  end if;
  if new.kind = 'objetiva' and not exists (select 1 from jsonb_array_elements(new.options) o where o->>'key' = new.correct_key) then
    raise exception 'A resposta certa precisa ser uma das alternativas' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger training_questions_before_write
  before insert or update on audita.training_questions
  for each row execute function audita.training_questions_before_write();
create trigger training_questions_set_updated_meta
  before update on audita.training_questions
  for each row execute function audita.set_updated_meta();
create trigger training_questions_audit
  after insert or update on audita.training_questions
  for each row execute function audita.log_row_change('id', 'assessment_id');

create or replace function audita.training_block_direct_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not audita.training_flow_on() then
    raise exception 'Registro mantido só pelo sistema' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Registro não pode ser excluído' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger training_attempts_block
  before insert or update or delete on audita.training_attempts
  for each row execute function audita.training_block_direct_changes();
create trigger training_attempt_answers_block
  before insert or update or delete on audita.training_attempt_answers
  for each row execute function audita.training_block_direct_changes();

create or replace function audita.training_certificates_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Certificados não são excluídos; cancele com motivo' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if not audita.training_flow_on() then
      raise exception 'Certificados são emitidos pelo sistema' using errcode = '42501';
    end if;
    return new;
  end if;
  if (to_jsonb(new) - 'status' - 'status_note') is distinct from (to_jsonb(old) - 'status' - 'status_note') then
    raise exception 'Os dados do certificado são permanentes' using errcode = '42501';
  end if;
  if old.status = 'cancelado' then
    raise exception 'Certificado cancelado não muda de situação' using errcode = '23514';
  end if;
  if new.status = 'cancelado' and length(btrim(coalesce(new.status_note, ''))) < 5 then
    raise exception 'Informe o motivo do cancelamento' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger training_certificates_before_write
  before insert or update or delete on audita.training_certificates
  for each row execute function audita.training_certificates_before_write();
create trigger training_certificates_audit
  after insert or update on audita.training_certificates
  for each row execute function audita.log_row_change('id', 'enrollment_id');

-- Publicação: toda avaliação precisa de questões, e a nota mínima cabe no número de objetivas
create or replace function audita.training_versions_check_assessments()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  r record;
begin
  if new.status = 'publicada' and old.status = 'rascunho' then
    for r in
      select m.position, a.pass_score,
             count(q.id) filter (where q.status = 'ativo') as n_all,
             count(q.id) filter (where q.status = 'ativo' and q.kind = 'objetiva') as n_obj
        from audita.training_assessments a
        join audita.training_modules m on m.id = a.module_id and m.status = 'ativo'
        left join audita.training_questions q on q.assessment_id = a.id
       where a.version_id = new.id
       group by m.position, a.pass_score
    loop
      if r.n_all = 0 then
        raise exception 'A avaliação do Módulo % não tem questões ativas', lpad(r.position::text, 2, '0') using errcode = '23514';
      end if;
      if r.pass_score is not null and r.pass_score > r.n_obj then
        raise exception 'A nota mínima do Módulo % (%) é maior que o número de questões objetivas (%)',
          lpad(r.position::text, 2, '0'), r.pass_score, r.n_obj using errcode = '23514';
      end if;
    end loop;
  end if;
  return new;
end;
$$;
create trigger training_versions_check_assessments
  before update on audita.training_versions
  for each row execute function audita.training_versions_check_assessments();

-- ---------------------------------------------------------------------------
-- Gestão (administrador): importação das questões lidas do gabarito
-- ---------------------------------------------------------------------------
-- p_items: [{code, kind, statement, options:[{key,text}], correct_key, feedback}] na ordem do gabarito.
-- Questões existentes com o mesmo código são atualizadas; as que não vieram ficam inativas (nada é excluído).
create or replace function audita.training_import_questions(p_module_id uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  m audita.training_modules;
  v_assessment uuid;
  it jsonb;
  i integer := 0;
  v_codes text[] := '{}';
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into m from audita.training_modules where id = p_module_id;
  if not found then
    raise exception 'Módulo não encontrado' using errcode = 'P0002';
  end if;
  if not audita.training_version_is_draft(m.version_id) then
    raise exception 'Questões só podem ser importadas em versão em rascunho' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 200 then
    raise exception 'Nenhuma questão para importar' using errcode = '22023';
  end if;
  select a.id into v_assessment from audita.training_assessments a where a.module_id = m.id;
  if v_assessment is null then
    insert into audita.training_assessments (module_id, time_limit_minutes)
    values (m.id, nullif(m.activity_minutes, 0))
    returning id into v_assessment;
  end if;
  for it in select value from jsonb_array_elements(p_items) loop
    i := i + 1;
    if (it->>'code') = any (v_codes) then
      raise exception 'Código repetido: %', it->>'code' using errcode = '23505';
    end if;
    v_codes := v_codes || (it->>'code');
    insert into audita.training_questions (assessment_id, position, code, kind, statement, options, correct_key, feedback, status)
    values (v_assessment, i, it->>'code', it->>'kind', btrim(it->>'statement'),
            case when it->>'kind' = 'objetiva' then it->'options' end,
            case when it->>'kind' = 'objetiva' then it->>'correct_key' end,
            nullif(btrim(coalesce(it->>'feedback', '')), ''), 'ativo')
    on conflict (assessment_id, code) do update
      set position = excluded.position, kind = excluded.kind, statement = excluded.statement, options = excluded.options,
          correct_key = excluded.correct_key, feedback = excluded.feedback, status = 'ativo';
  end loop;
  update audita.training_questions q set status = 'inativo'
   where q.assessment_id = v_assessment and q.status = 'ativo' and not (q.code = any (v_codes));
  return i;
end;
$$;

-- Nova versão: além da ficha, módulos e arquivos, copia as avaliações e as questões ativas
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
  a audita.training_assessments;
  v_ass uuid;
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
    select * into a from audita.training_assessments where module_id = m.id;
    if found then
      insert into audita.training_assessments (module_id, time_limit_minutes, max_attempts, retry_wait_hours, pass_score, shuffle_questions)
      values (v_mod, a.time_limit_minutes, a.max_attempts, a.retry_wait_hours, a.pass_score, a.shuffle_questions)
      returning id into v_ass;
      insert into audita.training_questions (assessment_id, position, code, kind, statement, options, correct_key, feedback)
      select v_ass, q.position, q.code, q.kind, q.statement, q.options, q.correct_key, q.feedback
        from audita.training_questions q where q.assessment_id = a.id and q.status = 'ativo';
    end if;
  end loop;
  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aluno: estrutura do curso, progresso e módulos em sequência
-- ---------------------------------------------------------------------------

-- Matrícula do aluno da sessão (ou de qualquer aluno, para o administrador)
create or replace function audita.training_enrollment_of_caller(p_enrollment_id uuid)
returns audita.training_enrollments
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e audita.training_enrollments;
begin
  select * into e from audita.training_enrollments where id = p_enrollment_id;
  if not found or (e.student_id is distinct from audita.current_student_id() and not audita.is_admin()) then
    raise exception 'Matrícula não encontrada' using errcode = 'P0002';
  end if;
  return e;
end;
$$;

-- Aluno pode estudar: matrícula ativa, dentro do prazo, aluno ativo
create or replace function audita.training_require_active(e audita.training_enrollments)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if e.student_id is distinct from audita.current_student_id() then
    raise exception 'Somente o próprio aluno faz o curso' using errcode = '42501';
  end if;
  if e.status <> 'ativa' then
    raise exception 'Matrícula %', case e.status when 'concluida' then 'concluída' when 'suspensa' then 'suspensa' else 'cancelada' end using errcode = '42501';
  end if;
  if e.access_until is not null and e.access_until < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'O prazo de acesso terminou' using errcode = '42501';
  end if;
end;
$$;

-- Etapas obrigatórias do módulo: apostila sempre; vídeo se houver link; avaliação se houver questões ativas
create or replace function audita.training_module_required_steps(p_module_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array['apostila']
         || case when m.video_url is not null then array['video'] else '{}'::text[] end
         || case when exists (select 1 from audita.training_assessments a join audita.training_questions q on q.assessment_id = a.id
                               where a.module_id = m.id and q.status = 'ativo') then array['avaliacao'] else '{}'::text[] end
    from audita.training_modules m where m.id = p_module_id;
$$;

create or replace function audita.training_module_completed(p_enrollment_id uuid, p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from unnest(audita.training_module_required_steps(p_module_id)) s(step)
     where not exists (select 1 from audita.training_progress p where p.enrollment_id = p_enrollment_id and p.module_id = p_module_id and p.step = s.step)
  );
$$;

-- Liberado = todos os módulos ativos anteriores concluídos
create or replace function audita.training_module_unlocked(p_enrollment_id uuid, p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from audita.training_modules prev
      join audita.training_modules cur on cur.id = p_module_id and prev.version_id = cur.version_id
     where prev.status = 'ativo' and prev.position < cur.position
       and not audita.training_module_completed(p_enrollment_id, prev.id)
  );
$$;

-- Estrutura do curso para o player (lateral, cabeçalho e etapas)
create or replace function audita.training_outline(p_enrollment_id uuid)
returns table (
  module_id uuid, "position" integer, title text, objective text, content_summary text,
  video_minutes integer, reading_minutes integer, activity_minutes integer, video_url text, is_orientation boolean,
  apostila_file_id uuid, assessment_id uuid, question_count integer, objective_count integer,
  time_limit_minutes integer, pass_score integer, max_attempts integer,
  required_steps text[], done_steps text[], completed boolean, unlocked boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e audita.training_enrollments := audita.training_enrollment_of_caller(p_enrollment_id);
  open_next boolean := true;
  r record;
begin
  for r in
    select m.*,
           (select f.id from audita.training_files f where f.module_id = m.id and f.kind = 'apostila' and f.status = 'ativo' limit 1) as apostila_id,
           a.id as a_id, a.time_limit_minutes as a_time, a.pass_score as a_pass, a.max_attempts as a_max,
           (select count(*) from audita.training_questions q where q.assessment_id = a.id and q.status = 'ativo')::integer as n_all,
           (select count(*) from audita.training_questions q where q.assessment_id = a.id and q.status = 'ativo' and q.kind = 'objetiva')::integer as n_obj,
           audita.training_module_required_steps(m.id) as req,
           coalesce((select array_agg(p.step order by p.completed_at) from audita.training_progress p
                      where p.enrollment_id = e.id and p.module_id = m.id), '{}') as done
      from audita.training_modules m
      left join audita.training_assessments a on a.module_id = m.id
     where m.version_id = e.version_id and m.status = 'ativo'
     order by m.position
  loop
    module_id := r.id; "position" := r.position; title := r.title; objective := r.objective; content_summary := r.content_summary;
    video_minutes := r.video_minutes; reading_minutes := r.reading_minutes; activity_minutes := r.activity_minutes;
    video_url := r.video_url; is_orientation := r.is_orientation; apostila_file_id := r.apostila_id;
    assessment_id := case when r.n_all > 0 then r.a_id end; question_count := r.n_all; objective_count := r.n_obj;
    time_limit_minutes := r.a_time; pass_score := r.a_pass; max_attempts := r.a_max;
    required_steps := r.req; done_steps := r.done;
    completed := r.req <@ r.done;
    unlocked := open_next;
    open_next := open_next and completed;
    return next;
  end loop;
end;
$$;

-- Conclusão do curso: todos os módulos concluídos ⇒ matrícula concluída e certificado emitido
create or replace function audita.training_try_complete(p_enrollment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  e audita.training_enrollments;
  v audita.training_versions;
  c audita.training_courses;
  s audita.training_students;
  fin record;
  v_code text;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into e from audita.training_enrollments where id = p_enrollment_id for update;
  if e.status <> 'ativa' then
    return e.status = 'concluida';
  end if;
  if exists (select 1 from audita.training_modules m where m.version_id = e.version_id and m.status = 'ativo'
              and not audita.training_module_completed(e.id, m.id)) then
    return false;
  end if;
  select * into v from audita.training_versions where id = e.version_id;
  select * into c from audita.training_courses where id = e.course_id;
  select * into s from audita.training_students where id = e.student_id;
  -- Nota da avaliação com nota mínima (a final), melhor tentativa aprovada
  select t.score, t.max_score into fin
    from audita.training_attempts t join audita.training_assessments a on a.id = t.assessment_id
   where t.enrollment_id = e.id and a.pass_score is not null and t.passed
   order by t.score desc, t.submitted_at limit 1;
  perform set_config('audita.training_flow', 'on', true);
  update audita.training_enrollments set status = 'concluida', completed_at = now() where id = e.id;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4) || '-' || substr(v_code, 9, 4);
    exit when not exists (select 1 from audita.training_certificates where code = v_code);
  end loop;
  insert into audita.training_certificates (enrollment_id, code, student_name, course_code, course_title, version_label, workload_minutes,
                                            instructor_name, started_on, completed_on, final_score, final_max_score)
  values (e.id, v_code, s.full_name, c.course_code, v.title, v.version_label, v.workload_minutes, v.instructor_name,
          e.starts_on, greatest(v_today, e.starts_on), fin.score, fin.max_score);
  perform set_config('audita.training_flow', 'off', true);
  return true;
end;
$$;

-- Aluno conclui a apostila ou a videoaula de um módulo liberado (a avaliação é registrada pelo envio da prova)
create or replace function audita.training_complete_step(p_enrollment_id uuid, p_module_id uuid, p_step text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  e audita.training_enrollments := audita.training_enrollment_of_caller(p_enrollment_id);
  v_req text[];
begin
  perform audita.training_require_active(e);
  if p_step not in ('apostila', 'video') then
    raise exception 'Etapa inválida' using errcode = '22023';
  end if;
  perform 1 from audita.training_modules m where m.id = p_module_id and m.version_id = e.version_id and m.status = 'ativo';
  if not found then
    raise exception 'Módulo não encontrado' using errcode = 'P0002';
  end if;
  if not audita.training_module_unlocked(e.id, p_module_id) then
    raise exception 'Conclua o módulo anterior para liberar este' using errcode = '42501';
  end if;
  v_req := audita.training_module_required_steps(p_module_id);
  if not (p_step = any (v_req)) then
    raise exception 'Este módulo não tem esta etapa' using errcode = '22023';
  end if;
  if p_step = 'video' and not exists (select 1 from audita.training_progress p where p.enrollment_id = e.id and p.module_id = p_module_id and p.step = 'apostila') then
    raise exception 'Leia a apostila antes da videoaula' using errcode = '42501';
  end if;
  insert into audita.training_progress (enrollment_id, module_id, step) values (e.id, p_module_id, p_step)
  on conflict (enrollment_id, module_id, step) do nothing;
  return audita.training_try_complete(e.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Aluno: provas (início, salvamento automático, envio e resultado)
-- ---------------------------------------------------------------------------
create or replace function audita.training_grade_attempt(p_attempt_id uuid, p_timeout boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t audita.training_attempts;
  a audita.training_assessments;
  v_score integer;
  v_max integer;
  v_passed boolean;
begin
  select * into t from audita.training_attempts where id = p_attempt_id for update;
  if t.status <> 'em_andamento' then
    return;
  end if;
  select * into a from audita.training_assessments where id = t.assessment_id;
  perform set_config('audita.training_flow', 'on', true);
  update audita.training_attempt_answers ans set is_correct = (ans.choice = q.correct_key)
    from audita.training_questions q where q.id = ans.question_id and ans.attempt_id = t.id and q.kind = 'objetiva';
  select count(*) filter (where q.kind = 'objetiva'),
         count(*) filter (where q.kind = 'objetiva' and ans.is_correct)
    into v_max, v_score
    from unnest(t.question_ids) qid join audita.training_questions q on q.id = qid
    left join audita.training_attempt_answers ans on ans.attempt_id = t.id and ans.question_id = q.id;
  v_passed := a.pass_score is null or v_score >= a.pass_score;
  update audita.training_attempts
     set status = 'enviada', submitted_at = now(), submitted_by_timeout = p_timeout, score = v_score, max_score = v_max, passed = v_passed
   where id = t.id;
  if v_passed then
    insert into audita.training_progress (enrollment_id, module_id, step) values (t.enrollment_id, a.module_id, 'avaliacao')
    on conflict (enrollment_id, module_id, step) do nothing;
  end if;
  perform set_config('audita.training_flow', 'off', true);
  if v_passed then
    perform audita.training_try_complete(t.enrollment_id);
  end if;
end;
$$;

-- Tentativa aberta com o tempo esgotado (mais 30 s de tolerância) é enviada com o que estiver salvo
create or replace function audita.training_close_if_expired(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  t audita.training_attempts;
begin
  select * into t from audita.training_attempts where id = p_attempt_id;
  if t.status = 'em_andamento' and t.deadline_at is not null and now() > t.deadline_at + interval '30 seconds' then
    perform audita.training_grade_attempt(t.id, true);
    return true;
  end if;
  return false;
end;
$$;

create or replace function audita.training_attempt_start(p_enrollment_id uuid, p_module_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e audita.training_enrollments := audita.training_enrollment_of_caller(p_enrollment_id);
  a audita.training_assessments;
  t audita.training_attempts;
  v_used integer;
  v_last timestamptz;
  v_ids uuid[];
  v_id uuid;
begin
  perform audita.training_require_active(e);
  select * into a from audita.training_assessments where module_id = p_module_id;
  if not found or not exists (select 1 from audita.training_modules m where m.id = p_module_id and m.version_id = e.version_id and m.status = 'ativo') then
    raise exception 'Avaliação não encontrada' using errcode = 'P0002';
  end if;
  if not audita.training_module_unlocked(e.id, p_module_id) then
    raise exception 'Conclua o módulo anterior para liberar este' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(audita.training_module_required_steps(p_module_id)) s(step)
              where s.step <> 'avaliacao'
                and not exists (select 1 from audita.training_progress p where p.enrollment_id = e.id and p.module_id = p_module_id and p.step = s.step)) then
    raise exception 'Conclua a apostila e a videoaula antes da avaliação' using errcode = '42501';
  end if;
  if exists (select 1 from audita.training_progress p where p.enrollment_id = e.id and p.module_id = p_module_id and p.step = 'avaliacao') then
    raise exception 'Esta avaliação já foi concluída' using errcode = '23514';
  end if;
  select * into t from audita.training_attempts where enrollment_id = e.id and assessment_id = a.id and status = 'em_andamento';
  if found then
    if not audita.training_close_if_expired(t.id) then
      return t.id;
    end if;
    if exists (select 1 from audita.training_progress p where p.enrollment_id = e.id and p.module_id = p_module_id and p.step = 'avaliacao') then
      raise exception 'Esta avaliação já foi concluída' using errcode = '23514';
    end if;
  end if;
  select count(*), max(submitted_at) into v_used, v_last from audita.training_attempts where enrollment_id = e.id and assessment_id = a.id and status = 'enviada';
  if a.max_attempts is not null and v_used >= a.max_attempts then
    raise exception 'Você já usou as % tentativas desta avaliação', a.max_attempts using errcode = '23514';
  end if;
  if v_last is not null and a.retry_wait_hours > 0 and now() < v_last + make_interval(hours => a.retry_wait_hours) then
    raise exception 'Nova tentativa liberada em %',
      to_char((v_last + make_interval(hours => a.retry_wait_hours)) at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI') using errcode = '23514';
  end if;
  if a.shuffle_questions then
    select array_agg(q.id order by random()) into v_ids from audita.training_questions q where q.assessment_id = a.id and q.status = 'ativo';
  else
    select array_agg(q.id order by q.position) into v_ids from audita.training_questions q where q.assessment_id = a.id and q.status = 'ativo';
  end if;
  if v_ids is null then
    raise exception 'Avaliação sem questões' using errcode = '23514';
  end if;
  perform set_config('audita.training_flow', 'on', true);
  insert into audita.training_attempts (enrollment_id, assessment_id, attempt_number, question_ids, deadline_at)
  values (e.id, a.id, v_used + 1, v_ids, case when a.time_limit_minutes is not null then now() + make_interval(mins => a.time_limit_minutes) end)
  returning id into v_id;
  perform set_config('audita.training_flow', 'off', true);
  return v_id;
end;
$$;

-- Tentativa do aluno da sessão (o administrador também consulta)
create or replace function audita.training_attempt_of_caller(p_attempt_id uuid)
returns audita.training_attempts
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t audita.training_attempts;
begin
  select * into t from audita.training_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Tentativa não encontrada' using errcode = 'P0002';
  end if;
  perform audita.training_enrollment_of_caller(t.enrollment_id);
  return t;
end;
$$;

-- Prova em andamento: questões sem a resposta certa, respostas salvas e prazo (relógio do servidor)
create or replace function audita.training_attempt_view(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t audita.training_attempts := audita.training_attempt_of_caller(p_attempt_id);
begin
  perform audita.training_close_if_expired(t.id);
  select * into t from audita.training_attempts where id = t.id;
  return jsonb_build_object(
    'id', t.id, 'status', t.status, 'attempt_number', t.attempt_number, 'enrollment_id', t.enrollment_id,
    'module_id', (select a.module_id from audita.training_assessments a where a.id = t.assessment_id),
    'deadline_at', t.deadline_at, 'now', now(),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', q.id, 'code', q.code, 'kind', q.kind, 'statement', q.statement, 'options', q.options,
               'choice', ans.choice, 'answer_text', ans.answer_text) order by o.ord), '[]'::jsonb)
        from unnest(t.question_ids) with ordinality o(qid, ord)
        join audita.training_questions q on q.id = o.qid
        left join audita.training_attempt_answers ans on ans.attempt_id = t.id and ans.question_id = q.id));
end;
$$;

create or replace function audita.training_attempt_save(p_attempt_id uuid, p_question_id uuid, p_choice text, p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t audita.training_attempts := audita.training_attempt_of_caller(p_attempt_id);
  q audita.training_questions;
begin
  if t.status <> 'em_andamento' then
    raise exception 'A avaliação já foi enviada' using errcode = '23514';
  end if;
  perform audita.training_require_active(audita.training_enrollment_of_caller(t.enrollment_id));
  if t.deadline_at is not null and now() > t.deadline_at + interval '30 seconds' then
    raise exception 'O tempo de prova terminou' using errcode = '23514';
  end if;
  if not (p_question_id = any (t.question_ids)) then
    raise exception 'Questão fora desta avaliação' using errcode = '22023';
  end if;
  select * into q from audita.training_questions where id = p_question_id;
  if q.kind = 'objetiva' and (p_choice is null or not exists (select 1 from jsonb_array_elements(q.options) o where o->>'key' = p_choice)) then
    raise exception 'Alternativa inválida' using errcode = '22023';
  end if;
  if q.kind = 'aberta' and p_text is not null and length(p_text) > 4000 then
    raise exception 'Resposta muito longa (até 4.000 caracteres)' using errcode = '22023';
  end if;
  perform set_config('audita.training_flow', 'on', true);
  insert into audita.training_attempt_answers (attempt_id, question_id, choice, answer_text)
  values (t.id, q.id, case when q.kind = 'objetiva' then p_choice end, case when q.kind = 'aberta' then nullif(btrim(p_text), '') end)
  on conflict (attempt_id, question_id) do update set choice = excluded.choice, answer_text = excluded.answer_text, saved_at = now();
  perform set_config('audita.training_flow', 'off', true);
end;
$$;

-- Envio: todas respondidas (as abertas com pelo menos 10 caracteres), salvo quando o tempo acabou
create or replace function audita.training_attempt_submit(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t audita.training_attempts := audita.training_attempt_of_caller(p_attempt_id);
  v_timeout boolean;
begin
  if t.status <> 'em_andamento' then
    return;
  end if;
  perform audita.training_require_active(audita.training_enrollment_of_caller(t.enrollment_id));
  v_timeout := t.deadline_at is not null and now() >= t.deadline_at - interval '5 seconds';
  if not v_timeout and exists (
    select 1 from unnest(t.question_ids) qid join audita.training_questions q on q.id = qid
      left join audita.training_attempt_answers ans on ans.attempt_id = t.id and ans.question_id = q.id
     where (q.kind = 'objetiva' and ans.choice is null) or (q.kind = 'aberta' and length(btrim(coalesce(ans.answer_text, ''))) < 10)
  ) then
    raise exception 'Responda todas as questões antes de enviar (nas atividades abertas, escreva pelo menos 10 caracteres)' using errcode = '23514';
  end if;
  perform audita.training_grade_attempt(t.id, v_timeout);
end;
$$;

-- Resultado: o retorno por questão aparece sempre nas avaliações sem nota; na avaliação com nota, só depois da aprovação
-- ou quando acabam as tentativas (política do material)
create or replace function audita.training_attempt_result(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t audita.training_attempts := audita.training_attempt_of_caller(p_attempt_id);
  a audita.training_assessments;
  v_used integer;
  v_last timestamptz;
  v_show boolean;
  v_next timestamptz;
begin
  perform audita.training_close_if_expired(t.id);
  select * into t from audita.training_attempts where id = t.id;
  if t.status <> 'enviada' then
    raise exception 'A avaliação ainda não foi enviada' using errcode = '23514';
  end if;
  select * into a from audita.training_assessments where id = t.assessment_id;
  select count(*), max(submitted_at) into v_used, v_last from audita.training_attempts where enrollment_id = t.enrollment_id and assessment_id = a.id and status = 'enviada';
  v_show := a.pass_score is null or t.passed or (a.max_attempts is not null and v_used >= a.max_attempts);
  if not t.passed and a.retry_wait_hours > 0 then
    v_next := v_last + make_interval(hours => a.retry_wait_hours);
  end if;
  return jsonb_build_object(
    'id', t.id, 'module_id', a.module_id, 'enrollment_id', t.enrollment_id, 'attempt_number', t.attempt_number,
    'score', t.score, 'max_score', t.max_score, 'passed', t.passed, 'pass_score', a.pass_score,
    'submitted_at', t.submitted_at, 'by_timeout', t.submitted_by_timeout,
    'attempts_used', v_used, 'max_attempts', a.max_attempts,
    'can_retry', not t.passed and (a.max_attempts is null or v_used < a.max_attempts), 'next_attempt_at', v_next,
    'show_feedback', v_show,
    -- Reprovação sem retorno liberado: os módulos a revisar (referência "(Módulo NN)" do retorno das questões erradas),
    -- sem dizer quais questões foram erradas
    'review_modules', case when not t.passed and not v_show then (
      select coalesce(jsonb_agg(distinct (regexp_match(q.feedback, '\(Módulo ([0-9]{2})\)'))[1]), '[]'::jsonb)
        from unnest(t.question_ids) qid join audita.training_questions q on q.id = qid
        left join audita.training_attempt_answers ans on ans.attempt_id = t.id and ans.question_id = q.id
       where q.kind = 'objetiva' and ans.is_correct is not true and q.feedback ~ '\(Módulo [0-9]{2}\)') else '[]'::jsonb end,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'code', q.code, 'kind', q.kind, 'statement', q.statement, 'options', q.options,
               'choice', ans.choice, 'answer_text', ans.answer_text,
               'is_correct', case when v_show then ans.is_correct end,
               'correct_key', case when v_show then q.correct_key end,
               'feedback', case when v_show then q.feedback end) order by o.ord), '[]'::jsonb)
        from unnest(t.question_ids) with ordinality o(qid, ord)
        join audita.training_questions q on q.id = o.qid
        left join audita.training_attempt_answers ans on ans.attempt_id = t.id and ans.question_id = q.id));
end;
$$;

-- Última tentativa do aluno em cada avaliação (para o player abrir a prova em andamento ou o resultado)
create or replace function audita.training_attempt_latest(p_enrollment_id uuid, p_module_id uuid)
returns table (id uuid, status text, attempt_number integer, passed boolean, submitted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.status, t.attempt_number, t.passed, t.submitted_at
    from audita.training_attempts t join audita.training_assessments a on a.id = t.assessment_id
   where t.enrollment_id = (audita.training_enrollment_of_caller(p_enrollment_id)).id and a.module_id = p_module_id
   order by t.attempt_number desc limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Certificado: verificação pelo código (a função "certificado" chama com a chave de serviço; nada para anon)
-- ---------------------------------------------------------------------------
create or replace function audita.training_verify_certificate(p_code text)
returns table (code text, status text, student_name text, course_code text, course_title text, workload_minutes integer,
               started_on date, completed_on date, issued_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.code, c.status, c.student_name, c.course_code, c.course_title, c.workload_minutes, c.started_on, c.completed_on, c.issued_at
    from audita.training_certificates c where c.code = upper(btrim(p_code));
$$;

-- Gestão: andamento das matrículas de um treinamento
create or replace function audita.training_enrollment_progress(p_course_id uuid)
returns table (enrollment_id uuid, modules_done integer, modules_total integer, final_score integer, final_max_score integer,
               certificate_code text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  return query
  select e.id,
         (select count(*) from audita.training_modules m where m.version_id = e.version_id and m.status = 'ativo'
             and audita.training_module_completed(e.id, m.id))::integer,
         (select count(*) from audita.training_modules m where m.version_id = e.version_id and m.status = 'ativo')::integer,
         c.final_score, c.final_max_score, c.code
    from audita.training_enrollments e
    left join audita.training_certificates c on c.enrollment_id = e.id and c.status = 'valido'
   where e.course_id = p_course_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS e privilégios
-- ---------------------------------------------------------------------------
alter table audita.training_assessments enable row level security;
alter table audita.training_questions enable row level security;
alter table audita.training_attempts enable row level security;
alter table audita.training_attempt_answers enable row level security;
alter table audita.training_certificates enable row level security;

create policy training_assessments_admin_select on audita.training_assessments for select to authenticated using ((select audita.is_admin()));
create policy training_assessments_admin_insert on audita.training_assessments for insert to authenticated with check ((select audita.is_admin()));
create policy training_assessments_admin_update on audita.training_assessments for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));
create policy training_questions_admin_select on audita.training_questions for select to authenticated using ((select audita.is_admin()));
create policy training_questions_admin_update on audita.training_questions for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));

create policy training_attempts_admin_select on audita.training_attempts for select to authenticated using ((select audita.is_admin()));
create policy training_attempts_self_select on audita.training_attempts for select to authenticated
  using (exists (select 1 from audita.training_enrollments e where e.id = enrollment_id and e.student_id = (select audita.current_student_id())));
create policy training_attempt_answers_admin_select on audita.training_attempt_answers for select to authenticated using ((select audita.is_admin()));

create policy training_certificates_admin_select on audita.training_certificates for select to authenticated using ((select audita.is_admin()));
create policy training_certificates_admin_update on audita.training_certificates for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));
create policy training_certificates_self_select on audita.training_certificates for select to authenticated
  using (exists (select 1 from audita.training_enrollments e where e.id = enrollment_id and e.student_id = (select audita.current_student_id())));

revoke all on audita.training_assessments, audita.training_questions, audita.training_attempts, audita.training_attempt_answers,
  audita.training_certificates from public, anon, authenticated;
grant select, insert, update on audita.training_assessments to authenticated;
grant select, update on audita.training_questions to authenticated;
grant select on audita.training_attempts, audita.training_attempt_answers to authenticated;
grant select, update on audita.training_certificates to authenticated;

revoke all on function audita.training_assessments_before_write(), audita.training_questions_before_write(),
  audita.training_block_direct_changes(), audita.training_certificates_before_write(), audita.training_versions_check_assessments(),
  audita.training_import_questions(uuid, jsonb), audita.training_enrollment_of_caller(uuid),
  audita.training_require_active(audita.training_enrollments), audita.training_module_required_steps(uuid),
  audita.training_module_completed(uuid, uuid), audita.training_module_unlocked(uuid, uuid), audita.training_outline(uuid),
  audita.training_try_complete(uuid), audita.training_complete_step(uuid, uuid, text), audita.training_grade_attempt(uuid, boolean),
  audita.training_close_if_expired(uuid), audita.training_attempt_start(uuid, uuid), audita.training_attempt_of_caller(uuid),
  audita.training_attempt_view(uuid), audita.training_attempt_save(uuid, uuid, text, text), audita.training_attempt_submit(uuid),
  audita.training_attempt_result(uuid), audita.training_attempt_latest(uuid, uuid), audita.training_verify_certificate(text),
  audita.training_enrollment_progress(uuid)
  from public, anon, authenticated;
grant execute on function audita.training_import_questions(uuid, jsonb), audita.training_outline(uuid),
  audita.training_complete_step(uuid, uuid, text), audita.training_attempt_start(uuid, uuid), audita.training_attempt_view(uuid),
  audita.training_attempt_save(uuid, uuid, text, text), audita.training_attempt_submit(uuid), audita.training_attempt_result(uuid),
  audita.training_attempt_latest(uuid, uuid), audita.training_enrollment_progress(uuid) to authenticated;

grant all on all tables in schema audita to service_role;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
