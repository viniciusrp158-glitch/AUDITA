-- AUDITA — T2f Treinamentos: troca do link da videoaula em versão publicada. Somente acréscimos (a regra do módulo é
-- substituída por uma versão que aceita esta única exceção).
--
-- Pedido do Diretor (22/10/2026): poder corrigir os links do YouTube com o curso já em venda. A versão publicada
-- continua congelada; a única exceção é TROCAR um link que já existe (vídeo republicado, link quebrado). Incluir ou
-- retirar a videoaula mudaria as etapas de quem já está no curso, então isso continua exigindo uma nova versão.
-- A troca fica na trilha de auditoria (gatilho training_modules_audit).

create or replace function audita.training_modules_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and coalesce(current_setting('audita.training_video_link', true), '') = 'on' then
    if (to_jsonb(new) - 'video_url' - 'updated_at' - 'updated_by') is distinct from (to_jsonb(old) - 'video_url' - 'updated_at' - 'updated_by') then
      raise exception 'Na versão publicada só o link da videoaula pode ser trocado' using errcode = '42501';
    end if;
    return new;
  end if;
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

-- Troca do link (administrador). No rascunho o link continua sendo editado no formulário do módulo.
create or replace function audita.training_replace_video_url(p_module_id uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m audita.training_modules;
  v_status text;
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into m from audita.training_modules where id = p_module_id for update;
  if not found then
    raise exception 'Módulo não encontrado' using errcode = 'P0002';
  end if;
  select v.status into v_status from audita.training_versions v where v.id = m.version_id;
  if v_status <> 'publicada' then
    raise exception 'A troca de link é para versões publicadas; no rascunho, edite o módulo' using errcode = '22023';
  end if;
  if m.video_url is null then
    raise exception 'Este módulo não tem videoaula na versão publicada; para incluir, crie uma nova versão' using errcode = '23514';
  end if;
  if v_url is null then
    raise exception 'Informe o novo link; para retirar a videoaula, crie uma nova versão' using errcode = '23514';
  end if;
  perform set_config('audita.training_video_link', 'on', true);
  update audita.training_modules set video_url = v_url where id = m.id;
  perform set_config('audita.training_video_link', 'off', true);
end;
$$;

revoke all on function audita.training_replace_video_url(uuid, text) from public, anon, authenticated;
grant execute on function audita.training_replace_video_url(uuid, text) to authenticated;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
