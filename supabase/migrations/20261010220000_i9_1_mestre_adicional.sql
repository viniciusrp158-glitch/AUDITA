-- I9.1 (ajuste do Diretor, 10/10/2026) — Usuário mestre adicional.
-- Pedido: o usuário mestre pode criar outro usuário com as MESMAS permissões e acessos do mestre (ex.: a pessoa que
-- opera o sistema no dia a dia), cada um com o próprio login.
-- Solução aditiva: o mestre titular (is_master, único — o Diretor) continua como está; nova marca is_comaster para os
-- mestres adicionais. audita.is_master() passa a reconhecer os dois. Regras:
--   • só um mestre (titular ou adicional) concede ou retira a marca de mestre adicional, e sempre junto do nível
--     Administrador;
--   • ninguém altera o próprio nível, situação ou marca de mestre (evita perder o acesso por engano);
--   • o mestre titular e o mestre de teste continuam intocáveis pela API.

alter table audita.app_users add column is_comaster boolean not null default false;
comment on column audita.app_users.is_comaster is 'Mestre adicional: mesmas permissões do mestre titular (criar usuários e definir níveis). Concedido por um mestre.';
alter table audita.app_users add constraint app_users_comaster_is_admin check (not is_comaster or role = 'admin');

create or replace function audita.is_master()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from audita.app_users u
    where u.user_id = (select auth.uid()) and u.status = 'active' and u.role = 'admin'
      and (u.is_master or u.is_comaster or (u.is_test and u.is_test_master))
  );
$$;

create or replace function audita.app_users_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_master boolean := audita.is_master();
  v_dba boolean := current_user = 'postgres';
begin
  if tg_op = 'INSERT' then
    if (new.is_master or new.is_test or new.is_test_master) and not v_dba then
      raise exception 'Usuário mestre titular ou de teste só é definido pela administração do banco.' using errcode = '42501';
    end if;
    if new.is_comaster and not (v_master or v_dba) then
      raise exception 'Somente um usuário mestre concede a marca de mestre.' using errcode = '42501';
    end if;
    if v_uid is not null then
      new.created_by := v_uid;
    end if;
    return new;
  end if;

  -- UPDATE
  if (new.is_master is distinct from old.is_master or new.is_test is distinct from old.is_test
      or new.is_test_master is distinct from old.is_test_master) and not v_dba then
    raise exception 'Usuário mestre titular ou de teste só é definido pela administração do banco.' using errcode = '42501';
  end if;
  if new.user_id is distinct from old.user_id or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Campo não pode ser alterado.' using errcode = '42501';
  end if;
  if (new.role is distinct from old.role or new.status is distinct from old.status
      or new.is_comaster is distinct from old.is_comaster) and not v_dba then
    if not v_master then
      raise exception 'Somente o usuário mestre altera nível ou situação de usuários.' using errcode = '42501';
    end if;
    if old.is_master or old.is_test_master then
      raise exception 'O usuário mestre titular não pode ter o nível ou a situação alterados.' using errcode = '42501';
    end if;
    if old.user_id = v_uid then
      raise exception 'Ninguém altera o próprio nível ou situação; peça a outro usuário mestre.' using errcode = '42501';
    end if;
  end if;
  if new.must_change_password is distinct from old.must_change_password and not v_dba then
    -- o próprio usuário só pode concluir a troca (verdadeiro → falso); o mestre pode exigir nova troca
    if not (v_uid = old.user_id and old.must_change_password and not new.must_change_password) and not v_master then
      raise exception 'Alteração não permitida.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function audita.app_users_guard() from public, anon, authenticated;
