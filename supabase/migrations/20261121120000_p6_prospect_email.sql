-- AUDITA PROSPECT — P6: e-mail de apresentação enviado pelo sistema (AUDDOC020 Rev.01, RP-09/RNF-P04; e-mail aprovado
-- pelo Diretor em 19/11/2026; descadastro público autorizado pelo Diretor em 19/11/2026 — exceção registrada na regra 4).
-- Somente aditiva.
--
-- 1. audita.prospect_email_config — remetente, "responder para", chave do Brevo CRIPTOGRAFADA pelo servidor (a chave de
--    criptografia fica só no ambiente do servidor; o banco guarda apenas o texto cifrado), limites e a data da validação
--    jurídica que libera o envio em lote.
-- 2. audita.prospect_email_sends  — cada envio (ou simulação no ambiente de testes), com o código do descadastro.
-- 3. audita.prospect_email_quota() — cota do dia com aquecimento (30 → 100, +5 por dia útil desde o 1º envio real) e
--    pausa automática se as devoluções passarem de 3% dos últimos 100 envios (mínimo de 20 envios).
-- 4. audita.prospect_unsubscribe(token) — PÚBLICA (anon): põe a empresa e o e-mail em "não contatar"; não devolve dados.
-- 5. audita.prospect_email_mark(ids, status) — marca devoluções informadas pelo Brevo.

-- 1. Configuração (linha única) ----------------------------------------------------------------------------------------
create table audita.prospect_email_config (
  id                  smallint primary key default 1 check (id = 1),
  sender_name         text check (sender_name is null or length(btrim(sender_name)) between 3 and 80),
  sender_email        text not null default 'prospeccao@audita.seg.br' check (sender_email ~ '^[a-z0-9._-]+@audita\.seg\.br$'),
  reply_to            text not null default 'engenharia.audita@outlook.com' check (reply_to ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and length(reply_to) <= 254),
  api_key_cipher      text check (api_key_cipher is null or length(api_key_cipher) between 20 and 2000),
  daily_start         integer not null default 30 check (daily_start between 1 and 100),
  daily_max           integer not null default 100 check (daily_max between 1 and 100 and daily_max >= daily_start),
  legal_validated_on  date,
  updated_at          timestamptz not null default now(),
  updated_by          uuid default auth.uid()
);
comment on table audita.prospect_email_config is 'E-mail da prospecção (Brevo): remetente, limites, chave cifrada pelo servidor e data da validação jurídica (libera o lote).';
insert into audita.prospect_email_config (id) values (1);

create or replace function audita.prospect_email_config_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'UPDATE' then
    raise exception 'A configuração do e-mail é uma linha única' using errcode = '42501';
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;
create trigger prospect_email_config_guard before insert or delete or update on audita.prospect_email_config
  for each row execute function audita.prospect_email_config_guard();
create trigger prospect_email_config_audit after update on audita.prospect_email_config
  for each row execute function audita.log_row_change('id');

alter table audita.prospect_email_config enable row level security;
create policy prospect_email_config_select on audita.prospect_email_config for select to authenticated using ((select audita.is_admin()));
create policy prospect_email_config_update on audita.prospect_email_config for update to authenticated using ((select audita.is_admin())) with check ((select audita.is_admin()));
revoke all on audita.prospect_email_config from public, anon, authenticated;
grant select, update on audita.prospect_email_config to authenticated;
grant all on audita.prospect_email_config to service_role;

-- 2. Envios ------------------------------------------------------------------------------------------------------------
create table audita.prospect_email_sends (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid references audita.leads (id) on delete restrict,
  cnpj         text not null check (cnpj ~ '^[0-9A-Z]{12}\d{2}$'),
  email        text not null check (email = lower(email) and length(email) <= 254),
  subject      text not null check (length(subject) <= 300),
  status       text not null check (status in ('enviado', 'falhou', 'devolvido', 'simulado')),
  provider_id  text check (provider_id is null or length(provider_id) <= 200),
  error        text check (error is null or length(error) <= 500),
  token        text not null unique check (token ~ '^[0-9a-f]{48}$'),
  batch        boolean not null default false,
  is_test      boolean not null default false,
  sent_at      timestamptz not null default now(),
  sent_by      uuid default auth.uid()
);
comment on table audita.prospect_email_sends is 'E-mails de apresentação enviados (ou simulados no ambiente de testes), com o código do descadastro.';
create index prospect_email_sends_dia on audita.prospect_email_sends (sent_at desc);
create index prospect_email_sends_email on audita.prospect_email_sends (email);

create or replace function audita.prospect_email_sends_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.sent_at := now();
    new.sent_by := (select auth.uid());
    return new;
  end if;
  -- Única alteração permitida: "enviado" → "devolvido", feita por prospect_email_mark_bounced (sinal da transação)
  if tg_op = 'UPDATE' and current_setting('audita.marca_devolucao', true) = 'sim'
     and old.status = 'enviado' and new.status = 'devolvido'
     and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
    return new;
  end if;
  raise exception 'O registro de envios não pode ser alterado nem excluído' using errcode = '42501';
end;
$$;
create trigger prospect_email_sends_guard before insert or update or delete on audita.prospect_email_sends
  for each row execute function audita.prospect_email_sends_guard();

alter table audita.prospect_email_sends enable row level security;
create policy prospect_email_sends_select on audita.prospect_email_sends for select to authenticated using ((select audita.can_operate()));
create policy prospect_email_sends_insert on audita.prospect_email_sends for insert to authenticated with check ((select audita.can_operate()));
revoke all on audita.prospect_email_sends from public, anon, authenticated;
grant select, insert on audita.prospect_email_sends to authenticated;
grant all on audita.prospect_email_sends to service_role;

-- 3. Cota do dia --------------------------------------------------------------------------------------------------------
create or replace function audita.prospect_email_quota()
returns table (configured boolean, batch_allowed boolean, daily_limit integer, sent_today integer, bounce_rate numeric, paused boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c audita.prospect_email_config;
  first_day date;
  bdays integer := 0;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  recent integer;
  bounced integer;
begin
  if not audita.can_operate() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into c from audita.prospect_email_config where id = 1;
  select min((s.sent_at at time zone 'America/Sao_Paulo')::date) into first_day
    from audita.prospect_email_sends s where s.status in ('enviado', 'devolvido');
  if first_day is not null then
    select count(*) into bdays from generate_series(first_day, today - 1, interval '1 day') d where extract(isodow from d) < 6;
  end if;
  select count(*), count(*) filter (where s.status = 'devolvido') into recent, bounced
    from (select x.status from audita.prospect_email_sends x where x.status in ('enviado', 'devolvido') order by x.sent_at desc limit 100) s;
  return query select
    (c.api_key_cipher is not null and c.sender_name is not null),
    (c.legal_validated_on is not null),
    least(c.daily_max, c.daily_start + 5 * bdays),
    (select count(*)::int from audita.prospect_email_sends s
      where s.status in ('enviado', 'devolvido', 'simulado') and (s.sent_at at time zone 'America/Sao_Paulo')::date = today),
    case when recent = 0 then 0 else round(bounced::numeric / recent, 4) end,
    (recent >= 20 and bounced::numeric / recent > 0.03);
end;
$$;
revoke all on function audita.prospect_email_quota() from public, anon;
grant execute on function audita.prospect_email_quota() to authenticated;

-- Dados do remetente para o servidor enviar em nome de quem prospecta (a chave vem cifrada: sem a chave de
-- criptografia, que só existe no ambiente do servidor, o texto não serve para nada)
create or replace function audita.prospect_email_sender()
returns table (sender_name text, sender_email text, reply_to text, api_key_cipher text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not audita.can_operate() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  return query select c.sender_name, c.sender_email, c.reply_to, c.api_key_cipher from audita.prospect_email_config c where c.id = 1;
end;
$$;
revoke all on function audita.prospect_email_sender() from public, anon;
grant execute on function audita.prospect_email_sender() to authenticated;

-- 4. Descadastro público (exceção da regra 4, autorizada pelo Diretor em 19/11/2026) ------------------------------------
create or replace function audita.prospect_unsubscribe(p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s audita.prospect_email_sends;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    return; -- código inválido: não informa nada
  end if;
  select * into s from audita.prospect_email_sends where token = p_token;
  if s.id is null then
    return;
  end if;
  if not exists (select 1 from audita.contact_suppressions x where x.cnpj = s.cnpj or x.email = s.email) then
    insert into audita.contact_suppressions (cnpj, email, reason, is_test)
    values (s.cnpj, s.email, 'Descadastro pelo link do e-mail de apresentação', s.is_test);
  end if;
end;
$$;
comment on function audita.prospect_unsubscribe(text) is 'Descadastro pelo link do e-mail (público): põe a empresa e o e-mail em "não contatar". Não devolve dados.';
revoke all on function audita.prospect_unsubscribe(text) from public;
grant execute on function audita.prospect_unsubscribe(text) to anon, authenticated;

-- 5. Devoluções informadas pelo Brevo --------------------------------------------------------------------------------
create or replace function audita.prospect_email_mark_bounced(p_provider_ids text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not audita.can_operate() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  -- O registro de envios é imutável; só esta função muda "enviado" para "devolvido" (sinal válido nesta transação)
  perform set_config('audita.marca_devolucao', 'sim', true);
  update audita.prospect_email_sends set status = 'devolvido' where provider_id = any (p_provider_ids) and status = 'enviado';
  get diagnostics n = row_count;
  perform set_config('audita.marca_devolucao', '', true);
  return n;
end;
$$;
revoke all on function audita.prospect_email_mark_bounced(text[]) from public, anon;
grant execute on function audita.prospect_email_mark_bounced(text[]) to authenticated;

notify pgrst, 'reload schema';
