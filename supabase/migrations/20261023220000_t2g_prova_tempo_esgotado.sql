-- AUDITA — T2g Treinamentos: correção da avaliação com tempo esgotado. Somente acréscimos (função substituída).
--
-- Relato do Diretor (23/10/2026): deixou o tempo de prova acabar, saiu e voltou; ao clicar em "Continuar avaliação"
-- aparecia "Esta avaliação já foi concluída" e o módulo ficava travado. Causa: training_attempt_start enviava e corrigia
-- a tentativa vencida (o que concluía a avaliação sem nota) e em seguida levantava o aviso de "já concluída", que
-- desfazia o próprio envio; a tentativa voltava a ficar em andamento e o ciclo se repetia. Agora a tentativa vencida
-- fica enviada e a função devolve o id dela (a tela de prova leva ao resultado).

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
    -- O tempo tinha acabado: a tentativa acabou de ser enviada e corrigida. Se isso concluiu a avaliação, devolve a
    -- própria tentativa (o aluno vai ao resultado); antes, o aviso de "já concluída" desfazia o envio e travava o módulo.
    if exists (select 1 from audita.training_progress p where p.enrollment_id = e.id and p.module_id = p_module_id and p.step = 'avaliacao') then
      return t.id;
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

notify pgrst, 'reload schema';
