-- AUDITA — T2e Treinamentos: importador do pacote .zip (padrão do L01). Somente acréscimos.
--
-- O navegador lê o .zip, classifica os arquivos e a gestão confere; esta função cria de uma vez o treinamento (ou a nova
-- versão de um treinamento que já existe), a ficha técnica e os módulos. Depois o navegador envia os arquivos pelo mesmo
-- caminho do envio manual (link assinado, SHA-256 no servidor) e o servidor lê as questões dos gabaritos enviados.

create or replace function audita.training_import_package(
  p_code text, p_title text, p_version text, p_ficha jsonb, p_modules jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_course uuid;
  v_version uuid;
  v_created boolean := false;
  it jsonb;
  v_pos integer;
  v_last integer := 1;
  v_mod uuid;
  v_out jsonb := '{}'::jsonb;
  f jsonb := coalesce(p_ficha, '{}'::jsonb);
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  if v_code !~ '^[A-Z]{1,4}[0-9]{2,3}$' then
    raise exception 'Código do treinamento não identificado no pacote (ex.: L01)' using errcode = '22023';
  end if;
  if coalesce(btrim(p_version), '') !~ '^[0-9]{1,2}\.[0-9]{1,2}$' then
    raise exception 'Versão do material não identificada (ex.: 1.2)' using errcode = '22023';
  end if;
  if jsonb_typeof(p_modules) <> 'array' or jsonb_array_length(p_modules) < 2 or jsonb_array_length(p_modules) > 99 then
    raise exception 'O pacote precisa da Ambientação (M01) e de pelo menos mais um módulo' using errcode = '23514';
  end if;
  if (p_modules->0->>'position')::integer is distinct from 1 then
    raise exception 'O pacote precisa começar pelo Módulo 01 (Ambientação)' using errcode = '23514';
  end if;

  select c.id into v_course from audita.training_courses c where c.course_code = v_code;
  if v_course is null then
    v_course := audita.training_create_course(v_code, coalesce(nullif(btrim(p_title), ''), v_code), btrim(p_version));
    select v.id into v_version from audita.training_versions v where v.course_id = v_course;
    v_created := true;
  else
    if exists (select 1 from audita.training_versions v where v.course_id = v_course and v.status = 'rascunho') then
      raise exception 'O treinamento % já tem uma versão em rascunho; publique ou cancele antes de importar', v_code using errcode = '23514';
    end if;
    if exists (select 1 from audita.training_versions v where v.course_id = v_course and v.version_label = btrim(p_version)) then
      raise exception 'A versão % do % já existe; atualize o número da versão no material', btrim(p_version), v_code using errcode = '23505';
    end if;
    insert into audita.training_versions (course_id, version_label, title)
    values (v_course, btrim(p_version), coalesce(nullif(btrim(p_title), ''), v_code))
    returning id into v_version;
    insert into audita.training_modules (version_id, position, title, is_orientation) values (v_version, 1, 'Ambientação', true);
  end if;

  update audita.training_versions set
    summary = nullif(btrim(f->>'summary'), ''),
    modality = nullif(btrim(f->>'modality'), ''),
    workload_minutes = nullif(f->>'workload_minutes', '')::integer,
    audience = nullif(btrim(f->>'audience'), ''),
    prerequisites = nullif(btrim(f->>'prerequisites'), ''),
    general_objective = nullif(btrim(f->>'general_objective'), ''),
    methodology = nullif(btrim(f->>'methodology'), ''),
    assessment_rules = nullif(btrim(f->>'assessment_rules'), ''),
    resources = nullif(btrim(f->>'resources'), ''),
    references_text = nullif(btrim(f->>'references_text'), ''),
    important_notice = nullif(btrim(f->>'important_notice'), ''),
    instructor_name = nullif(btrim(f->>'instructor_name'), '')
  where id = v_version;

  for it in select value from jsonb_array_elements(p_modules) loop
    v_pos := (it->>'position')::integer;
    if v_pos = 1 then
      select m.id into v_mod from audita.training_modules m where m.version_id = v_version and m.is_orientation;
    else
      if v_pos <= v_last then
        raise exception 'Módulos fora de ordem no pacote (M%)', lpad(v_pos::text, 2, '0') using errcode = '23514';
      end if;
      insert into audita.training_modules (version_id, position, title)
      values (v_version, v_pos, coalesce(nullif(btrim(it->>'title'), ''), 'Módulo ' || lpad(v_pos::text, 2, '0')))
      returning id into v_mod;
      v_last := v_pos;
    end if;
    update audita.training_modules set
      title = coalesce(nullif(btrim(it->>'title'), ''), title),
      objective = nullif(btrim(it->>'objective'), ''),
      content_summary = nullif(btrim(it->>'content_summary'), ''),
      video_minutes = nullif(it->>'video_minutes', '')::integer,
      reading_minutes = nullif(it->>'reading_minutes', '')::integer,
      activity_minutes = nullif(it->>'activity_minutes', '')::integer
    where id = v_mod;
    v_out := v_out || jsonb_build_object(v_pos::text, v_mod);
  end loop;

  return jsonb_build_object('course_id', v_course, 'version_id', v_version, 'created_course', v_created, 'modules', v_out);
end;
$$;

revoke all on function audita.training_import_package(text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function audita.training_import_package(text, text, text, jsonb, jsonb) to authenticated;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
