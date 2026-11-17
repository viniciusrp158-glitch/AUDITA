-- =============================================================================================================
-- Audita Academy, etapas 5 a 7 (autorizadas pelo Diretor em 16/11/2026; especificação em docs/ACADEMY.md):
--   * Meu Perfil: dados do certificado, contato e endereço, alterados só pela função do próprio aluno;
--   * Histórico: módulos concluídos, notas e tentativas de qualquer matrícula do aluno (mesmo com prazo encerrado);
--   * Financeiro: pedidos do próprio aluno (por aluno ou pelo e-mail da conta), sem token nem dados internos;
--   * Notificações: avisos automáticos (curso liberado, pagamento, módulo, avaliação, certificado), aviso de prazo
--     calculado na leitura e comunicados escritos pela gestão.
-- Aditiva: nenhuma coluna ou regra existente muda. Nada para anon; o aluno só lê e grava pelas funções.
-- =============================================================================================================

-- ---------------------------------------------------------------------------
-- 1. Meu Perfil
-- ---------------------------------------------------------------------------
alter table audita.training_students
  add column birth_date          date check (birth_date is null or birth_date between date '1900-01-01' and date '2100-01-01'),
  add column job_title           text check (job_title is null or length(btrim(job_title)) between 2 and 120),
  add column address_cep         text check (address_cep is null or address_cep ~ '^\d{8}$'),
  add column address_street      text check (address_street is null or length(btrim(address_street)) between 2 and 200),
  add column address_number      text check (address_number is null or length(btrim(address_number)) between 1 and 20),
  add column address_complement  text check (address_complement is null or length(btrim(address_complement)) between 1 and 120),
  add column address_district    text check (address_district is null or length(btrim(address_district)) between 2 and 120),
  add column address_city        text check (address_city is null or length(btrim(address_city)) between 2 and 120),
  add column address_state       text check (address_state is null or address_state in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  add column email_notices       boolean not null default true;
comment on column audita.training_students.email_notices is 'Aluno aceita receber avisos por e-mail (Meu Perfil). Envio por e-mail ainda não existe: depende de decisão do Diretor.';

-- Texto vazio vira nulo; só dígitos onde a coluna exige dígitos
create or replace function audita.training_clean(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(p), '');
$$;

create or replace function audita.training_digits(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '');
$$;

-- O próprio aluno altera nome, CPF, contato, endereço e preferências. E-mail, situação e origem continuam
-- permanentes (gatilho training_students_before_write). O certificado já emitido não muda (dados congelados).
create or replace function audita.training_update_my_profile(
  p_full_name text, p_cpf text, p_birth_date date, p_phone text, p_company text, p_job_title text,
  p_cep text, p_street text, p_number text, p_complement text, p_district text, p_city text, p_state text,
  p_email_notices boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := audita.current_student_id();
  v_cpf text := audita.training_digits(p_cpf);
begin
  if v_id is null then
    raise exception 'Somente o próprio aluno altera o perfil' using errcode = '42501';
  end if;
  if length(coalesce(btrim(p_full_name), '')) < 3 then
    raise exception 'Informe o nome completo' using errcode = '22023';
  end if;
  if v_cpf is not null and not audita.is_valid_cpf(v_cpf) then
    raise exception 'CPF inválido' using errcode = '22023';
  end if;
  if p_birth_date is not null and p_birth_date > (now() at time zone 'America/Sao_Paulo')::date - interval '10 years' then
    raise exception 'Data de nascimento inválida' using errcode = '22023';
  end if;
  update audita.training_students
     set full_name = btrim(regexp_replace(p_full_name, '\s+', ' ', 'g')),
         cpf = v_cpf,
         birth_date = p_birth_date,
         phone = audita.training_digits(p_phone),
         company = audita.training_clean(p_company),
         job_title = audita.training_clean(p_job_title),
         address_cep = audita.training_digits(p_cep),
         address_street = audita.training_clean(p_street),
         address_number = audita.training_clean(p_number),
         address_complement = audita.training_clean(p_complement),
         address_district = audita.training_clean(p_district),
         address_city = audita.training_clean(p_city),
         address_state = upper(audita.training_clean(p_state)),
         email_notices = coalesce(p_email_notices, true)
   where id = v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Histórico de cursos: vale também para matrícula com prazo encerrado (só leitura, sem conteúdo do curso)
-- ---------------------------------------------------------------------------
create or replace function audita.training_my_history(p_enrollment_id uuid)
returns table (
  module_id uuid, "position" integer, title text, completed boolean, completed_at timestamptz,
  has_assessment boolean, pass_score integer, attempts integer, best_score integer, max_score integer, passed boolean
)
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
  return query
    select m.id, m.position, m.title,
           audita.training_module_completed(e.id, m.id),
           case when audita.training_module_completed(e.id, m.id)
                then (select max(p.completed_at) from audita.training_progress p where p.enrollment_id = e.id and p.module_id = m.id) end,
           exists (select 1 from audita.training_questions q join audita.training_assessments a on a.id = q.assessment_id
                    where a.module_id = m.id and q.status = 'ativo'),
           a.pass_score,
           (select count(*)::integer from audita.training_attempts t where t.enrollment_id = e.id and t.assessment_id = a.id and t.status = 'enviada'),
           (select max(t.score) from audita.training_attempts t where t.enrollment_id = e.id and t.assessment_id = a.id and t.status = 'enviada'),
           (select max(t.max_score) from audita.training_attempts t where t.enrollment_id = e.id and t.assessment_id = a.id and t.status = 'enviada'),
           (select bool_or(t.passed) from audita.training_attempts t where t.enrollment_id = e.id and t.assessment_id = a.id and t.status = 'enviada')
      from audita.training_modules m
      left join audita.training_assessments a on a.module_id = m.id
     where m.version_id = e.version_id and m.status = 'ativo'
     order by m.position;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Financeiro: pedidos do aluno da sessão. O link de pagamento só volta no pedido pendente e dentro do prazo.
-- ---------------------------------------------------------------------------
create or replace function audita.training_my_orders()
returns table (
  id uuid, created_at timestamptz, paid_at timestamptz, course_code text, course_title text, amount numeric,
  status text, payment_method text, pay_url text, expired boolean, refund_pending boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select s.id, s.email from audita.training_students s where s.user_id = (select auth.uid()) and s.status = 'ativo'
  )
  select o.id, o.created_at, o.paid_at, o.course_code, o.course_title, o.amount, o.status, o.mp_payment_method,
         case when o.status = 'pendente' and coalesce(o.expires_at, o.created_at + audita.training_order_validity()) > now()
              then o.mp_init_point end,
         o.status = 'pendente' and coalesce(o.expires_at, o.created_at + audita.training_order_validity()) <= now(),
         o.status = 'aprovado' and o.manual_refund_reason is not null
    from audita.training_orders o
    join me on o.student_id = me.id or o.buyer_email = me.email
   order by o.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- 4. Notificações
-- ---------------------------------------------------------------------------
create table audita.training_notifications (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references audita.training_students (id) on delete restrict,
  course_id   uuid references audita.training_courses (id) on delete restrict,
  kind        text not null check (kind in ('liberado', 'pagamento', 'modulo', 'avaliacao', 'certificado', 'comunicado')),
  ref         text check (ref is null or length(ref) <= 120),
  title       text not null check (length(btrim(title)) between 3 and 140),
  body        text check (body is null or length(btrim(body)) between 1 and 2000),
  link        text check (link is null or (link ~ '^/[A-Za-z0-9]' and length(link) <= 300)),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  constraint training_notifications_target check ((kind = 'comunicado') = (student_id is null))
);
comment on table audita.training_notifications is 'Avisos da Audita Academy: automáticos (um aluno) ou comunicados da gestão (todos os alunos ou os de um curso). Links relativos a /treinamentos.';
-- Um aviso automático por acontecimento (ref = matrícula, módulo, tentativa, certificado ou pedido)
create unique index training_notifications_ref_unique on audita.training_notifications (student_id, kind, ref) where ref is not null;
create index training_notifications_student_idx on audita.training_notifications (student_id, created_at desc);
create index training_notifications_broadcast_idx on audita.training_notifications (created_at desc) where student_id is null;

create table audita.training_notification_reads (
  notification_id  uuid not null references audita.training_notifications (id) on delete restrict,
  student_id       uuid not null references audita.training_students (id) on delete restrict,
  read_at          timestamptz not null default now(),
  primary key (notification_id, student_id)
);

create trigger training_notifications_audit
  after insert on audita.training_notifications
  for each row when (new.kind = 'comunicado') execute function audita.log_row_change('id', 'course_id');

-- Avisos visíveis para um aluno: os dele e os comunicados (de todos ou de um curso em que tem matrícula), criados a
-- partir de 30 dias antes do cadastro
create or replace function audita.training_notifications_for(p_student_id uuid)
returns setof audita.training_notifications
language sql
stable
security definer
set search_path = ''
as $$
  select n.* from audita.training_notifications n
   where n.student_id = p_student_id
  union all
  select n.* from audita.training_notifications n
   where n.student_id is null
     and n.created_at >= (select s.created_at - interval '30 days' from audita.training_students s where s.id = p_student_id)
     and (n.course_id is null or exists (
           select 1 from audita.training_enrollments e
            where e.student_id = p_student_id and e.course_id = n.course_id and e.status in ('ativa', 'concluida')));
$$;

-- Lista do aluno da sessão. O aviso de prazo (acesso termina em até 30 dias) é calculado na hora e vem sem id e
-- com is_read nulo: não conta como "não lido" e some quando o prazo passa ou é renovado.
create or replace function audita.training_my_notifications(p_limit integer default 50)
returns table (id uuid, kind text, title text, body text, link text, created_at timestamptz, is_read boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select audita.current_student_id() as sid)
  select * from (
    select null::uuid, 'prazo'::text,
           case when e.access_until = (now() at time zone 'America/Sao_Paulo')::date
                then 'Seu acesso ao curso termina hoje'
                else 'Seu acesso ao curso termina em ' || (e.access_until - (now() at time zone 'America/Sao_Paulo')::date) || ' dias' end,
           coalesce(v.title, c.title),
           '/curso/' || e.id,
           now(),
           null::boolean
      from audita.training_enrollments e
      join me on e.student_id = me.sid
      join audita.training_courses c on c.id = e.course_id
      left join audita.training_versions v on v.id = e.version_id
     where e.status = 'ativa' and e.access_revoked_at is null and e.access_until is not null
       and e.access_until between (now() at time zone 'America/Sao_Paulo')::date and (now() at time zone 'America/Sao_Paulo')::date + 30
  ) prazo
  union all
  select * from (
    select n.id, n.kind, n.title, n.body, n.link, n.created_at,
           exists (select 1 from audita.training_notification_reads r where r.notification_id = n.id and r.student_id = me.sid)
      from me, audita.training_notifications_for(me.sid) n
     where me.sid is not null
     order by n.created_at desc
     limit greatest(1, least(coalesce(p_limit, 50), 200))
  ) avisos;
$$;

create or replace function audita.training_unread_notifications()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from audita.training_notifications_for(audita.current_student_id()) n
   where not exists (select 1 from audita.training_notification_reads r where r.notification_id = n.id and r.student_id = audita.current_student_id());
$$;

-- Marca como lidos (nulo = todos os visíveis). Só avisos que o próprio aluno enxerga.
create or replace function audita.training_mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid uuid := audita.current_student_id();
  v_n integer;
begin
  if v_sid is null then
    raise exception 'Somente o aluno marca os próprios avisos' using errcode = '42501';
  end if;
  insert into audita.training_notification_reads (notification_id, student_id)
  select n.id, v_sid from audita.training_notifications_for(v_sid) n
   where p_ids is null or n.id = any (p_ids)
  on conflict (notification_id, student_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Comunicado da gestão (administrador): para todos os alunos ou para os alunos de um curso
create or replace function audita.training_send_notice(p_title text, p_body text, p_link text, p_course_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not audita.is_admin() then
    raise exception 'Somente administradores enviam comunicados' using errcode = '42501';
  end if;
  insert into audita.training_notifications (kind, course_id, title, body, link)
  values ('comunicado', p_course_id, btrim(p_title), audita.training_clean(p_body), audita.training_clean(p_link))
  returning id into v_id;
  return v_id;
end;
$$;

-- Aviso automático (uso interno dos gatilhos): repetido para o mesmo acontecimento é ignorado
create or replace function audita.training_notify(p_student_id uuid, p_kind text, p_ref text, p_title text, p_body text, p_link text, p_course_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into audita.training_notifications (student_id, kind, ref, title, body, link, course_id, created_by)
  values (p_student_id, p_kind, p_ref, left(p_title, 140), left(p_body, 2000), p_link, p_course_id, null)
  on conflict (student_id, kind, ref) where ref is not null do nothing;
$$;

-- Curso liberado (matrícula nova)
create or replace function audita.training_notify_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := (select coalesce(v.title, c.title) from audita.training_courses c left join audita.training_versions v on v.id = new.version_id where c.id = new.course_id);
begin
  perform audita.training_notify(new.student_id, 'liberado', new.id::text, 'Curso liberado: ' || v_title,
    'Seu acesso ao curso está liberado. Bom estudo!', '/curso/' || new.id, new.course_id);
  return null;
end;
$$;
create trigger training_enrollments_notify
  after insert on audita.training_enrollments
  for each row execute function audita.training_notify_enrollment();

-- Pagamento aprovado ou estornado (pedido já ligado a um aluno)
create or replace function audita.training_notify_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.student_id is null then
    return null;
  end if;
  if new.status = 'aprovado' and (old.status is distinct from 'aprovado' or old.student_id is null) then
    perform audita.training_notify(new.student_id, 'pagamento', new.id::text || ':aprovado', 'Pagamento aprovado',
      new.course_title, '/financeiro', new.course_id);
  elsif new.status = 'estornado' and old.status is distinct from 'estornado' then
    perform audita.training_notify(new.student_id, 'pagamento', new.id::text || ':estornado', 'Pagamento estornado',
      new.course_title, '/financeiro', new.course_id);
  end if;
  return null;
end;
$$;
create trigger training_orders_notify
  after update on audita.training_orders
  for each row execute function audita.training_notify_order();

-- Módulo concluído (a última etapa do módulo acabou de ser registrada)
create or replace function audita.training_notify_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e audita.training_enrollments;
  m audita.training_modules;
begin
  if not audita.training_module_completed(new.enrollment_id, new.module_id) then
    return null;
  end if;
  select * into e from audita.training_enrollments where id = new.enrollment_id;
  select * into m from audita.training_modules where id = new.module_id;
  perform audita.training_notify(e.student_id, 'modulo', e.id::text || ':' || m.id::text,
    'Módulo ' || lpad(m.position::text, 2, '0') || ' concluído', m.title, '/curso/' || e.id, e.course_id);
  return null;
end;
$$;
create trigger training_progress_notify
  after insert on audita.training_progress
  for each row execute function audita.training_notify_progress();

-- Avaliação enviada e corrigida
create or replace function audita.training_notify_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e audita.training_enrollments;
  m audita.training_modules;
begin
  if not (old.status = 'em_andamento' and new.status = 'enviada') then
    return null;
  end if;
  select * into e from audita.training_enrollments where id = new.enrollment_id;
  select mo.* into m from audita.training_assessments a join audita.training_modules mo on mo.id = a.module_id where a.id = new.assessment_id;
  perform audita.training_notify(e.student_id, 'avaliacao', new.id::text,
    'Avaliação do módulo ' || lpad(m.position::text, 2, '0') ||
      case when new.max_score > 0 then ': ' || new.score || ' de ' || new.max_score else ' enviada' end,
    m.title, '/curso/' || e.id || '/modulo/' || m.id || '/avaliacao/resultado/' || new.id, e.course_id);
  return null;
end;
$$;
create trigger training_attempts_notify
  after update on audita.training_attempts
  for each row execute function audita.training_notify_attempt();

-- Certificado emitido
create or replace function audita.training_notify_certificate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e audita.training_enrollments;
begin
  select * into e from audita.training_enrollments where id = new.enrollment_id;
  perform audita.training_notify(e.student_id, 'certificado', new.id::text, 'Certificado disponível',
    new.course_title, '/curso/' || e.id || '/certificado', e.course_id);
  return null;
end;
$$;
create trigger training_certificates_notify
  after insert on audita.training_certificates
  for each row execute function audita.training_notify_certificate();

-- ---------------------------------------------------------------------------
-- RLS e permissões: o aluno nunca lê nem grava as tabelas de avisos direto; a gestão lê os comunicados
-- ---------------------------------------------------------------------------
alter table audita.training_notifications enable row level security;
alter table audita.training_notification_reads enable row level security;
create policy training_notifications_admin_select on audita.training_notifications for select to authenticated using ((select audita.is_admin()));
create policy training_notification_reads_admin_select on audita.training_notification_reads for select to authenticated using ((select audita.is_admin()));

revoke all on audita.training_notifications, audita.training_notification_reads from public, anon, authenticated;
grant select on audita.training_notifications, audita.training_notification_reads to authenticated;

revoke all on function
  audita.training_clean(text), audita.training_digits(text),
  audita.training_update_my_profile(text, text, date, text, text, text, text, text, text, text, text, text, text, boolean),
  audita.training_my_history(uuid), audita.training_my_orders(),
  audita.training_notifications_for(uuid), audita.training_my_notifications(integer), audita.training_unread_notifications(),
  audita.training_mark_notifications_read(uuid[]), audita.training_send_notice(text, text, text, uuid),
  audita.training_notify(uuid, text, text, text, text, text, uuid),
  audita.training_notify_enrollment(), audita.training_notify_order(), audita.training_notify_progress(),
  audita.training_notify_attempt(), audita.training_notify_certificate()
from public, anon, authenticated;

grant execute on function
  audita.training_update_my_profile(text, text, date, text, text, text, text, text, text, text, text, text, text, boolean),
  audita.training_my_history(uuid), audita.training_my_orders(),
  audita.training_my_notifications(integer), audita.training_unread_notifications(),
  audita.training_mark_notifications_read(uuid[]), audita.training_send_notice(text, text, text, uuid)
to authenticated;

grant all on all tables in schema audita to service_role;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
