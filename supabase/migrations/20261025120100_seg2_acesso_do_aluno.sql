-- AUDITA — Correções da auditoria de segurança (25/10/2026), achados 2, 3 e 4 (acesso do aluno ao conteúdo). Somente
-- acréscimos e substituição de funções (mesma assinatura).
--
--   2) training_outline (e as consultas de prova training_attempt_view/result/latest) só conferiam se a matrícula era do
--      aluno, não a situação nem o prazo: matrícula suspensa, cancelada ou vencida continuava recebendo o link do vídeo e
--      o resumo dos módulos. Agora training_enrollment_of_caller aplica ao aluno a mesma condição da RLS
--      (training_student_has_version): matrícula ativa ou concluída, dentro do prazo e sem acesso revogado.
--   3) Estorno ou reembolso de uma matrícula CONCLUÍDA não tirava o acesso ao conteúdo (a suspensão só valia para
--      'ativa', e 'concluida' é definitiva). Nova marca training_enrollments.access_revoked_at, gravada só pelo fluxo
--      (audita.training_flow) e honrada pela RLS do conteúdo, pelo armazenamento e pelas funções do aluno. O pedido que
--      reembolsa grava a marca (migração seg3); o certificado continua sendo cancelado.
--   4) A política do armazenamento (training_student_can_read_object) liberava a apostila de qualquer módulo, inclusive
--      bloqueado ou inativo. Agora, para arquivo de módulo, exige módulo ativo e liberado (training_module_unlocked) para
--      uma matrícula do aluno; a ficha técnica (sem módulo) segue igual.
--
-- Também nasce training_enrollments.order_id (pedido da vitrine que CRIOU a matrícula), usado pela migração seg3 para que
-- o estorno de um pedido só alcance a matrícula criada por ele (achado 5).

-- ---------------------------------------------------------------------------
-- Novas colunas da matrícula
-- ---------------------------------------------------------------------------
alter table audita.training_enrollments
  add column access_revoked_at timestamptz,
  add column order_id uuid references audita.training_orders (id) on delete restrict;
comment on column audita.training_enrollments.access_revoked_at is
  'Acesso ao conteúdo encerrado pelo sistema (ex.: compra concluída e depois reembolsada/estornada). Definitivo.';
comment on column audita.training_enrollments.order_id is
  'Pedido da vitrine que criou esta matrícula (só o estorno deste pedido mexe nela).';
create unique index training_enrollments_order_unique on audita.training_enrollments (order_id) where order_id is not null;

-- As duas colunas são gravadas só pelos fluxos do sistema (matrícula pela compra e estorno), nunca pela tela ou pela API
create or replace function audita.training_enrollments_guard_system_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.access_revoked_at := null;
    if new.order_id is not null and coalesce(current_setting('audita.training_enroll', true), '') <> 'on' then
      raise exception 'O pedido da matrícula é registrado pelo sistema' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.order_id is distinct from old.order_id and (old.order_id is not null or not audita.training_flow_on()) then
    raise exception 'O pedido da matrícula é registrado pelo sistema e é permanente' using errcode = '42501';
  end if;
  if new.access_revoked_at is distinct from old.access_revoked_at and (old.access_revoked_at is not null or not audita.training_flow_on()) then
    raise exception 'O encerramento do acesso é registrado pelo sistema e é definitivo' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger training_enrollments_guard_system_fields
  before insert or update on audita.training_enrollments
  for each row execute function audita.training_enrollments_guard_system_fields();

-- ---------------------------------------------------------------------------
-- Condição de acesso do aluno (RLS do conteúdo): + acesso não revogado
-- ---------------------------------------------------------------------------
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
       and e.access_revoked_at is null
       and (e.access_until is null or e.access_until >= (now() at time zone 'America/Sao_Paulo')::date)
  );
$$;

-- Arquivo do aluno no armazenamento: ficha técnica com matrícula em vigor; apostila só de módulo ativo e liberado para
-- uma matrícula em vigor do aluno (mesma regra do leitor /treinamentos/arquivo e das etapas do curso)
create or replace function audita.training_student_can_read_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from audita.training_files f
      left join audita.training_modules m on m.id = f.module_id
      join audita.training_enrollments e on e.version_id = f.version_id
     where f.storage_path = p_name and f.audience = 'aluno' and f.status = 'ativo'
       and e.student_id = audita.current_student_id()
       and e.status in ('ativa', 'concluida')
       and e.access_revoked_at is null
       and (e.access_until is null or e.access_until >= (now() at time zone 'America/Sao_Paulo')::date)
       and (f.module_id is null
            or (m.status = 'ativo' and m.version_id = f.version_id and audita.training_module_unlocked(e.id, f.module_id)))
  );
$$;

-- ---------------------------------------------------------------------------
-- Matrícula consultada pelo aluno (ou pelo administrador): o aluno precisa estar em vigor, como na RLS
-- ---------------------------------------------------------------------------
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
  if not found then
    raise exception 'Matrícula não encontrada' using errcode = 'P0002';
  end if;
  if e.student_id is not distinct from audita.current_student_id() then
    -- O próprio aluno: mesma condição de training_student_has_version (a concluída continua consultável)
    if e.status not in ('ativa', 'concluida') then
      raise exception 'Matrícula %', case e.status when 'suspensa' then 'suspensa' else 'cancelada' end using errcode = '42501';
    end if;
    if e.access_revoked_at is not null then
      raise exception 'O acesso a este curso foi encerrado (compra reembolsada ou estornada)' using errcode = '42501';
    end if;
    if e.access_until is not null and e.access_until < (now() at time zone 'America/Sao_Paulo')::date then
      raise exception 'O prazo de acesso terminou' using errcode = '42501';
    end if;
  elsif not audita.is_admin() then
    raise exception 'Matrícula não encontrada' using errcode = 'P0002';
  end if;
  return e;
end;
$$;

revoke all on function audita.training_enrollments_guard_system_fields() from public, anon, authenticated;
revoke all on function audita.training_enrollment_of_caller(uuid) from public, anon, authenticated;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
