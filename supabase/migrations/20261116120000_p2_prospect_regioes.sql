-- AUDITA — P2 AUDITA PROSPECT: contagens por município e nicho para a tela de Regiões (AUDDOC020 RP-14 e RP-15).
-- Função de leitura (SECURITY INVOKER: valem a RLS e o nível de quem consulta). Somente acréscimos.
--
-- Para cada município até p_max_km da sede (0 = todo o Estado): empresas-alvo por nicho ativo e o total de empresas-alvo.
-- O casamento CNAE ↔ nicho é por prefixo (2 a 7 dígitos), resolvido com junções por igualdade em cada tamanho de
-- prefixo para usar hash join (uma leitura da tabela por tamanho presente).

create or replace function audita.prospect_region_counts(p_max_km numeric)
returns table (ibge_code text, name text, km_from_base numeric, niche_id uuid, niche_count bigint, all_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with m as (
    select mm.ibge_code, mm.name, mm.km_from_base
    from audita.ibge_municipalities mm
    where p_max_km is null or p_max_km <= 0 or mm.km_from_base <= p_max_km
  ),
  np as (
    select n.id, p as prefix, length(p) as len
    from audita.prospect_niches n, unnest(n.cnae_prefixes) as p
    where n.status = 'ativo'
  ),
  e as (
    select est.ibge_code, est.cnae_main
    from audita.cnpj_establishments est
    join m on m.ibge_code = est.ibge_code
  ),
  matched as (
    select e.ibge_code, np.id, count(*) as c from e join np on np.len = 2 and np.prefix = left(e.cnae_main, 2) group by 1, 2
    union all
    select e.ibge_code, np.id, count(*) from e join np on np.len = 3 and np.prefix = left(e.cnae_main, 3) group by 1, 2
    union all
    select e.ibge_code, np.id, count(*) from e join np on np.len = 4 and np.prefix = left(e.cnae_main, 4) group by 1, 2
    union all
    select e.ibge_code, np.id, count(*) from e join np on np.len = 5 and np.prefix = left(e.cnae_main, 5) group by 1, 2
    union all
    select e.ibge_code, np.id, count(*) from e join np on np.len = 6 and np.prefix = left(e.cnae_main, 6) group by 1, 2
    union all
    select e.ibge_code, np.id, count(*) from e join np on np.len = 7 and np.prefix = e.cnae_main group by 1, 2
  ),
  per_niche as (
    select ibge_code, id, sum(c)::bigint as c from matched group by 1, 2
  ),
  totals as (
    select e.ibge_code, count(*)::bigint as c from e group by 1
  )
  select m.ibge_code, m.name, m.km_from_base, pn.id, coalesce(pn.c, 0), coalesce(t.c, 0)
  from m
  join totals t on t.ibge_code = m.ibge_code
  left join per_niche pn on pn.ibge_code = m.ibge_code;
$$;

comment on function audita.prospect_region_counts(numeric) is 'Empresas-alvo por município e nicho ativo (e o total do município) até p_max_km da sede; 0 = todo o Estado.';

revoke all on function audita.prospect_region_counts(numeric) from public, anon;
grant execute on function audita.prospect_region_counts(numeric) to authenticated;

-- Resumo pronto para a tela (a contagem leva alguns segundos na base inteira e só muda com a carga mensal ou com a
-- edição de um nicho): recalculado por audita.refresh_prospect_region_stats().
create table audita.prospect_region_stats (
  ibge_code    text not null references audita.ibge_municipalities (ibge_code) on delete restrict,
  niche_id     uuid references audita.prospect_niches (id) on delete restrict,
  niche_count  integer not null check (niche_count >= 0),
  all_count    integer not null check (all_count >= 0),
  refreshed_at timestamptz not null default now()
);
comment on table audita.prospect_region_stats is 'Resumo de empresas-alvo por município e nicho (tela de Regiões). Recalculado, não editado.';
create unique index prospect_region_stats_key on audita.prospect_region_stats (ibge_code, coalesce(niche_id, '00000000-0000-0000-0000-000000000000'::uuid));

create or replace function audita.refresh_prospect_region_stats()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  -- Quem prospecta, ou a carga mensal rodada no servidor (conexão direta como postgres, sem usuário do sistema).
  -- Atenção: aqui current_user é o dono da função (SECURITY DEFINER); session_user é a conexão real.
  if not audita.can_operate() and not (session_user = 'postgres' and (select auth.uid()) is null) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  delete from audita.prospect_region_stats;
  insert into audita.prospect_region_stats (ibge_code, niche_id, niche_count, all_count)
  select ibge_code, niche_id, niche_count, all_count from audita.prospect_region_counts(0);
  get diagnostics n = row_count;
  return n;
end;
$$;

alter table audita.prospect_region_stats enable row level security;
create policy prospect_region_stats_select on audita.prospect_region_stats for select to authenticated using ((select audita.can_operate()));
revoke all on audita.prospect_region_stats from public, anon, authenticated;
grant select on audita.prospect_region_stats to authenticated;
grant all on audita.prospect_region_stats to service_role;
revoke all on function audita.refresh_prospect_region_stats() from public, anon;
grant execute on function audita.refresh_prospect_region_stats() to authenticated;

notify pgrst, 'reload schema';
