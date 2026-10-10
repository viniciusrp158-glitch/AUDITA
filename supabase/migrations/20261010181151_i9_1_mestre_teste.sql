-- I9.1 — Usuário mestre: um mestre real por ambiente (is_master, índice único). No desenvolvimento, um usuário
-- fictício marcado como TESTE pode receber a marca separada "mestre de teste" para os testes automáticos
-- (decisão do Diretor, 10/10/2026; CLAUDE.md regra 7). Em produção não há usuários de teste.
-- Somente aditiva. Definir mestre ou usuário de teste é ato de administração do banco (papel postgres), nunca pela API.

alter table audita.app_users
  add column is_test        boolean not null default false,
  add column is_test_master boolean not null default false;
alter table audita.app_users add constraint app_users_test_master_is_test
  check (not is_test_master or (is_test and role = 'admin' and status = 'active'));
comment on column audita.app_users.is_test is 'Usuário fictício de teste (somente no ambiente de desenvolvimento).';
comment on column audita.app_users.is_test_master is 'Mestre fictício para testes automáticos; exige is_test.';

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
      and (u.is_master or (u.is_test and u.is_test_master))
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
      raise exception 'Usuário mestre ou de teste só é definido pela administração do banco.' using errcode = '42501';
    end if;
    if v_uid is not null then
      new.created_by := v_uid;
    end if;
    return new;
  end if;

  -- UPDATE
  if (new.is_master is distinct from old.is_master or new.is_test is distinct from old.is_test
      or new.is_test_master is distinct from old.is_test_master) and not v_dba then
    raise exception 'Usuário mestre ou de teste só é definido pela administração do banco.' using errcode = '42501';
  end if;
  if new.user_id is distinct from old.user_id or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Campo não pode ser alterado.' using errcode = '42501';
  end if;
  if (new.role is distinct from old.role or new.status is distinct from old.status) and not v_dba then
    if not v_master then
      raise exception 'Somente o usuário mestre altera nível ou situação de usuários.' using errcode = '42501';
    end if;
    if old.is_master or old.is_test_master then
      raise exception 'O usuário mestre não pode ter o nível ou a situação alterados.' using errcode = '42501';
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
