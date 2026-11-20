-- AUDITA PROSPECT — P5: Prospecção 2.0, Fase 1 (AUDDOC020 Rev.01: RP-06, RP-20, RP-22; decisões do Diretor de 19/11/2026).
-- Somente aditiva: tabelas e funções novas; nenhuma tabela existente é alterada.
--
-- 1. audita.cnpj_companies      — capital social e número de estabelecimentos por CNPJ básico (dados públicos da Receita,
--                                 espelho recarregável como cnpj_establishments; carga por scripts/prospect).
-- 2. audita.prospect_contact_marks — telefones/e-mails marcados pelo usuário como "da contabilidade" (RP-22).
-- 3. audita.prospect_portfolio  — carteira pré-calculada (RP-20): empresas do público-alvo até 150 km de Sorocaba, com
--                                 nota, grupo de chance de resposta e motivos. Recalculada por
--                                 audita.refresh_prospect_portfolio() (carga mensal, noite e marcação de contabilidade).
--
-- Público-alvo (seção 2 da Rev.01): grande = S.A. (2046/2054), 3+ estabelecimentos ou capital ≥ R$ 5 mi; média =
-- capital ≥ R$ 1 mi ou porte "Demais" (05: não é ME nem EPP); EPP = porte 03; ME (01) só com capital ≥ R$ 100 mil ou
-- 2+ estabelecimentos. Fora: empresário individual (já fora da base), produtor rural PF (4120), associação (3999) e
-- condomínio (3085). Fora também quem já é lead, cliente ou está em "não contatar".
--
-- Chance de resposta (estimativa por regras, a calibrar com o histórico — RP-06). Grupos: Quentes ≥ 90 pontos, Mornos
-- 80–89, Frios < 80 (cortes calibrados na base de 19/11/2026: ~18%, ~25% e ~57% das empresas com contato próprio);
-- "precisa de contato" sem telefone nem e-mail próprios. Contato "próprio" quando o telefone
-- ou e-mail não se repete em 5 ou mais CNPJs da base e não foi marcado como da contabilidade.

-- 1. Empresas (CNPJ básico) ------------------------------------------------------------------------------------------
create table audita.cnpj_companies (
  cnpj_base      text primary key check (cnpj_base ~ '^[0-9A-Z]{8}$'),
  capital_social numeric(18, 2) check (capital_social is null or capital_social >= 0),
  establishments integer not null check (establishments >= 1),
  publication    text not null references audita.cnpj_publications (reference) on delete restrict
);
comment on table audita.cnpj_companies is 'Capital social e nº de estabelecimentos (em SP) por CNPJ básico — dados abertos da Receita; espelho recarregável.';
alter table audita.cnpj_companies enable row level security;
create policy cnpj_companies_select on audita.cnpj_companies for select to authenticated using ((select audita.can_operate()));
revoke all on audita.cnpj_companies from public, anon, authenticated;
grant select on audita.cnpj_companies to authenticated;
grant all on audita.cnpj_companies to service_role;

-- 2. Marcação "é da contabilidade" -----------------------------------------------------------------------------------
create table audita.prospect_contact_marks (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('phone', 'email')),
  value       text not null check ((kind = 'phone' and value ~ '^\d{10,11}$') or (kind = 'email' and value = lower(value) and value like '%@%' and length(value) <= 254)),
  reason      text not null default 'contabilidade' check (reason in ('contabilidade')),
  lead_id     uuid references audita.leads (id) on delete restrict,
  is_test     boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  unique (kind, value)
);
comment on table audita.prospect_contact_marks is 'Telefones e e-mails marcados pelo usuário como da contabilidade (RP-22): rebaixam todas as empresas com o mesmo contato.';
alter table audita.prospect_contact_marks enable row level security;
create policy prospect_contact_marks_select on audita.prospect_contact_marks for select to authenticated using ((select audita.can_operate()));
create policy prospect_contact_marks_insert on audita.prospect_contact_marks for insert to authenticated with check ((select audita.can_operate()));
revoke all on audita.prospect_contact_marks from public, anon, authenticated;
grant select, insert on audita.prospect_contact_marks to authenticated;
grant all on audita.prospect_contact_marks to service_role;

create or replace function audita.prospect_contact_marks_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  new.created_by := (select auth.uid());
  return new;
end;
$$;
create trigger prospect_contact_marks_guard before insert on audita.prospect_contact_marks
  for each row execute function audita.prospect_contact_marks_guard();

-- 3. Carteira pré-calculada ------------------------------------------------------------------------------------------
create table audita.prospect_portfolio (
  cnpj          text primary key check (cnpj ~ '^[0-9A-Z]{12}\d{2}$'),
  niche_id      uuid not null references audita.prospect_niches (id) on delete restrict,
  size_class    text not null check (size_class in ('grande', 'media', 'epp', 'me')),
  group_code    text not null check (group_code in ('quente', 'morno', 'frio', 'precisa_contato')),
  score         smallint not null check (score between 0 and 100),
  own_phone     boolean not null,
  own_email     boolean not null,
  phone_shared  integer not null default 0,
  email_shared  integer not null default 0,
  km            numeric(6, 1),
  capital_social numeric(18, 2),
  establishments integer,
  reasons       text[] not null default '{}',
  -- Dados de exibição copiados da base no recálculo: a leitura da tela não cruza com os 3,8 milhões de estabelecimentos
  legal_name    text not null,
  trade_name    text,
  municipality  text not null,
  phone         text,
  email         text,
  cnae_main     text not null,
  started_on    date,
  niche_name    text not null,
  refreshed_at  timestamptz not null default now()
);
comment on table audita.prospect_portfolio is 'Carteira de oportunidades (RP-20): público-alvo até 150 km, com nota, grupo de chance de resposta e motivos. Recalculada, não editada.';
create index prospect_portfolio_lista on audita.prospect_portfolio (group_code, score desc, cnpj);
create index prospect_portfolio_nicho on audita.prospect_portfolio (niche_id, group_code, score desc);
alter table audita.prospect_portfolio enable row level security;
create policy prospect_portfolio_select on audita.prospect_portfolio for select to authenticated using ((select audita.can_operate()));
revoke all on audita.prospect_portfolio from public, anon, authenticated;
grant select on audita.prospect_portfolio to authenticated;
grant all on audita.prospect_portfolio to service_role;

-- Recalcula a carteira inteira (dezenas de segundos). Quem prospecta (após marcar contabilidade) ou a conexão direta do
-- servidor (carga mensal / tarefa noturna).
create or replace function audita.refresh_prospect_portfolio()
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '600s'
as $$
declare
  n integer;
begin
  if not audita.can_operate() and not (session_user = 'postgres' and (select auth.uid()) is null) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  delete from audita.prospect_portfolio;

  insert into audita.prospect_portfolio
    (cnpj, niche_id, size_class, group_code, score, own_phone, own_email, phone_shared, email_shared, km, capital_social, establishments, reasons,
     legal_name, trade_name, municipality, phone, email, cnae_main, started_on, niche_name)
  with _phone as (
    select phone1 as v, count(*)::int as n from audita.cnpj_establishments where phone1 is not null group by 1
  ),
  _email as (
    select lower(email) as v, count(*)::int as n from audita.cnpj_establishments where email is not null group by 1
  ),
  _pref as (
    select n.id as niche_id, n.is_entry, n.name as niche_name, p as prefix from audita.prospect_niches n, unnest(n.cnae_prefixes) p where n.status = 'ativo'
  ),
  base as (
    select e.cnpj, e.cnae_main, e.size_code, e.legal_nature, e.started_on, e.phone1, lower(e.email) as email, m.km_from_base as km,
           c.capital_social as cap, coalesce(c.establishments, 1) as est, e.legal_name, e.trade_name, m.name as mun
      from audita.cnpj_establishments e
      join audita.ibge_municipalities m on m.ibge_code = e.ibge_code
      left join audita.cnpj_companies c on c.cnpj_base = left(e.cnpj, 8)
     where m.km_from_base <= 150
       and e.legal_nature not in ('4120', '3999', '3085')
  ),
  nicho as (
    select distinct on (b.cnpj) b.*, p.niche_id, p.is_entry, p.niche_name
      from base b join _pref p on b.cnae_main like p.prefix || '%'
     order by b.cnpj, length(p.prefix) desc
  ),
  porte as (
    select x.*,
      case
        when x.legal_nature in ('2046', '2054') or x.est >= 3 or x.cap >= 5000000 then 'grande'
        when x.cap >= 1000000 or x.size_code = '05' then 'media'
        when x.size_code = '03' then 'epp'
        else 'me'
      end as size_class
      from nicho x
  ),
  alvo as (
    select x.*,
      coalesce(ph.n, 0) as phone_n, coalesce(em.n, 0) as email_n,
      (mp.id is not null) as phone_marked, (me.id is not null) as email_marked
      from porte x
      left join _phone ph on ph.v = x.phone1
      left join _email em on em.v = x.email
      left join audita.prospect_contact_marks mp on mp.kind = 'phone' and mp.value = x.phone1
      left join audita.prospect_contact_marks me on me.kind = 'email' and me.value = x.email
     where (x.size_class <> 'me' or x.cap >= 100000 or x.est >= 2)
       and not exists (select 1 from audita.leads l where l.cnpj = x.cnpj)
       and not exists (select 1 from audita.clients cl where cl.tax_id = x.cnpj)
       and not exists (select 1 from audita.contact_suppressions s
                        where s.cnpj = x.cnpj or (x.phone1 is not null and s.phone = x.phone1) or (x.email is not null and s.email = x.email))
  ),
  canal as (
    select a.*,
      (a.phone1 is not null and a.phone_n < 5 and not a.phone_marked) as own_phone,
      (a.email is not null and a.email_n < 5 and not a.email_marked) as own_email,
      (a.email is not null and a.email_n < 5 and not a.email_marked and split_part(a.email, '@', 2) not in
        ('gmail.com', 'hotmail.com', 'hotmail.com.br', 'outlook.com', 'outlook.com.br', 'live.com', 'msn.com', 'yahoo.com',
         'yahoo.com.br', 'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br', 'icloud.com', 'globo.com', 'r7.com')) as own_domain,
      (a.phone1 ~ '^\d{2}9\d{8}$') as mobile,
      case when a.started_on is null then null else extract(year from age(current_date, a.started_on))::int end as years
      from alvo a
  ),
  pontos as (
    select c.*,
      (case when c.own_phone then 30 + (case when c.mobile then 10 else 0 end) else 0 end)
      + (case when c.own_email then 15 else 0 end) + (case when c.own_domain then 10 else 0 end)
      + (case c.size_class when 'grande' then 20 when 'media' then 16 when 'epp' then 12 else 6 end)
      + (case when c.is_entry then 10 else 6 end)
      + (case when c.km <= 60 then 10 when c.km <= 100 then 7 else 4 end)
      + (case when c.years is null then 0 when c.years < 2 then 4 when c.years <= 25 then 5 else 3 end)
      -- Em recuperação judicial, falência ou liquidação (pelo nome registrado): dificilmente contrata agora
      - (case when c.distress then 40 else 0 end) as pts
      from (select c0.*, (c0.legal_name ~* '(RECUPERA[CÇ][AÃ]O JUDICIAL|FAL[EÊ]NCIA|MASSA FALIDA|EM LIQUIDA[CÇ][AÃ]O)') as distress from canal c0) c
  )
  select p.cnpj, p.niche_id, p.size_class,
         case when not p.own_phone and not p.own_email then 'precisa_contato'
              when greatest(least(p.pts, 100), 0) >= 90 then 'quente'
              when greatest(least(p.pts, 100), 0) >= 80 then 'morno'
              else 'frio' end,
         greatest(least(p.pts, 100), 0), p.own_phone, p.own_email, p.phone_n, p.email_n, round(p.km, 1), p.cap, p.est,
         array_remove(array[
           case p.size_class when 'grande' then 'Grande empresa' when 'media' then 'Média empresa' when 'epp' then 'Empresa de pequeno porte' else 'Microempresa com estrutura' end,
           case when p.own_phone and p.mobile then 'Celular próprio' when p.own_phone then 'Telefone próprio'
                when p.phone1 is not null then 'Telefone provável da contabilidade' end,
           case when p.own_domain then 'E-mail com domínio próprio' when p.own_email then 'E-mail próprio'
                when p.email is not null then 'E-mail provável da contabilidade' end,
           case when p.is_entry then 'Nicho de entrada' end,
           case when p.km <= 60 then 'Até 60 km de Sorocaba' end,
           case when p.distress then 'Atenção: em recuperação judicial, falência ou liquidação' end
         ], null),
         p.legal_name, p.trade_name, p.mun, p.phone1, p.email, p.cnae_main, p.started_on, p.niche_name
    from pontos p;
  get diagnostics n = row_count;
  return n;
end;
$$;
comment on function audita.refresh_prospect_portfolio() is 'Recalcula a carteira de oportunidades (RP-20) com o público-alvo e a chance de resposta da Rev.01 do AUDDOC020.';
revoke all on function audita.refresh_prospect_portfolio() from public, anon;
grant execute on function audita.refresh_prospect_portfolio() to authenticated;

-- 4. Leitura da carteira pela tela (RP-20/RP-21) -----------------------------------------------------------------------
-- O recálculo completo é noturno; a leitura aplica na hora o que mudou no dia: marcação de contabilidade (o contato
-- deixa de contar como próprio e, sem outro contato próprio, a empresa vai para "precisa de contato") e quem virou lead,
-- cliente ou pediu para não ser contatado (some da lista).
create or replace function audita.prospect_opportunities(p_group text default null, p_niche uuid default null, p_limit integer default 50, p_offset integer default 0)
returns table (
  cnpj text, legal_name text, trade_name text, municipality text, km numeric, niche_id uuid, niche_name text,
  size_class text, group_code text, score smallint, own_phone boolean, own_email boolean,
  phone text, email text, cnae_main text, started_on date, capital_social numeric, establishments integer, reasons text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not audita.can_operate() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  if p_group is not null and p_group not in ('quente', 'morno', 'frio', 'precisa_contato') then
    raise exception 'Grupo inválido' using errcode = '22023';
  end if;
  return query
  with v as (
    select p.*, (p.own_phone and mp.value is null) as eff_phone, (p.own_email and me.value is null) as eff_email
      from audita.prospect_portfolio p
      left join audita.prospect_contact_marks mp on mp.kind = 'phone' and mp.value = p.phone
      left join audita.prospect_contact_marks me on me.kind = 'email' and me.value = p.email
     where (p_niche is null or p.niche_id = p_niche)
       -- candidatos: o próprio grupo; para "precisa de contato", também quem teve o contato marcado como da contabilidade
       and (p_group is null or p.group_code = p_group
            or (p_group = 'precisa_contato' and (p.phone in (select k.value from audita.prospect_contact_marks k where k.kind = 'phone')
                                                or p.email in (select k.value from audita.prospect_contact_marks k where k.kind = 'email'))))
       and not exists (select 1 from audita.leads l where l.cnpj = p.cnpj)
       and not exists (select 1 from audita.clients cl where cl.tax_id = p.cnpj)
       and not exists (select 1 from audita.contact_suppressions s where s.cnpj = p.cnpj)
  ),
  g as (
    select v.*, case when not v.eff_phone and not v.eff_email then 'precisa_contato' else v.group_code end as eff_group from v
  )
  select g.cnpj, g.legal_name, g.trade_name, g.municipality, g.km, g.niche_id, g.niche_name, g.size_class, g.eff_group, g.score,
         g.eff_phone, g.eff_email, g.phone, g.email, g.cnae_main, g.started_on, g.capital_social, g.establishments, g.reasons
    from g
   where p_group is null or g.eff_group = p_group
   -- mesma ordem do índice prospect_portfolio_lista: lê só as primeiras linhas do grupo (o total vem de prospect_opportunity_counts)
   order by g.score desc, g.cnpj
   limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;
comment on function audita.prospect_opportunities(text, uuid, integer, integer) is 'Oportunidades do dia (RP-20) por grupo de chance, aplicando as mudanças do dia sobre a carteira noturna.';
revoke all on function audita.prospect_opportunities(text, uuid, integer, integer) from public, anon;
grant execute on function audita.prospect_opportunities(text, uuid, integer, integer) to authenticated;

-- Quantidade por grupo (cartões do topo da tela), com as mesmas regras da leitura
create or replace function audita.prospect_opportunity_counts()
returns table (group_code text, n bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not audita.can_operate() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  return query
  select case when not (p.own_phone and mp.value is null) and not (p.own_email and me.value is null)
              then 'precisa_contato' else p.group_code end, count(*)
    from audita.prospect_portfolio p
    left join audita.prospect_contact_marks mp on mp.kind = 'phone' and mp.value = p.phone
    left join audita.prospect_contact_marks me on me.kind = 'email' and me.value = p.email
   where not exists (select 1 from audita.leads l where l.cnpj = p.cnpj)
     and not exists (select 1 from audita.clients cl where cl.tax_id = p.cnpj)
     and not exists (select 1 from audita.contact_suppressions s where s.cnpj = p.cnpj)
   group by 1;
end;
$$;
revoke all on function audita.prospect_opportunity_counts() from public, anon;
grant execute on function audita.prospect_opportunity_counts() to authenticated;

notify pgrst, 'reload schema';
