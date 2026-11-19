-- AUDITA PROSPECT — P3: pesquisa de empresas numa função do banco (AUDDOC020, RP-03).
-- Motivo (17/11/2026, produção): pela API, o filtro de região chegava como uma lista literal de municípios; com raio de
-- 150 km (181 municípios) o planejador lia a tabela inteira (1,7 GB): 9,8 s para buscar + 5,6 s para contar, acima do
-- limite de 8 s da API ("Não foi possível pesquisar na base"). Aqui a região entra como subconsulta e os CNAEs como
-- prefixos com índice: a mesma pesquisa usa os índices em qualquer raio.
-- No Estado inteiro, mesmo com índice o banco lia boa parte da tabela (cache frio > 8 s). Por isso: um índice "de busca"
-- com tudo o que a pesquisa filtra (CNAE, porte, município, abertura, CNPJ e telefone) e uma leitura por prefixo de CNAE
-- (UNION), que o banco faz só no índice (index-only scan); a tabela só é lida para as até 1.000 empresas da página.

create index if not exists cnpj_establishments_busca on audita.cnpj_establishments
  (cnae_main text_pattern_ops, size_code, ibge_code, started_on, cnpj) include (phone1);
-- SECURITY DEFINER: sob RLS o banco não usa índice no LIKE (o operador não é "leakproof") e voltava a ler a tabela
-- inteira para o usuário do sistema. A função confere a mesma permissão da RLS (audita.can_operate: administrador e
-- operador) logo no início e só devolve colunas da base pública. search_path vazio (CLAUDE.md, regra 4); só acrescenta (regra 3).

create or replace function audita.prospect_search(
  p_prefixes  text[],
  p_max_km    numeric default 50,
  p_ibge      text    default null,
  p_sizes     text[]  default array['01', '03', '05'],
  p_with_phone boolean default false,
  p_since     date    default null,
  p_term      text    default null,
  p_limit     integer default 1000
)
returns table (
  cnpj text, is_headquarters boolean, legal_name text, trade_name text, legal_nature text, size_code text,
  started_on date, cnae_main text, cnae_secondary text[], street text, number text, complement text, district text,
  zip text, ibge_code text, phone1 text, phone2 text, email text, publication text, total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cnae text;
  v_where text := '';
  v_sql text;
begin
  if not audita.can_operate() then
    raise exception 'sem permissão para pesquisar a base de CNPJ' using errcode = '42501';
  end if;
  if p_prefixes is null or cardinality(p_prefixes) = 0 or cardinality(p_prefixes) > 60 then
    raise exception 'informe de 1 a 60 prefixos de CNAE' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_prefixes) x where x is null or x !~ '^\d{2,7}$') then
    raise exception 'prefixo de CNAE inválido' using errcode = '22023';
  end if;
  if p_ibge is not null and p_ibge !~ '^\d{7}$' then
    raise exception 'código de município inválido' using errcode = '22023';
  end if;

  -- um ramo por prefixo (só dígitos, já validados): cada ramo lê só o índice de busca; UNION (não ALL) para que
  -- prefixos sobrepostos de um nicho editado (ex.: 41 e 4120) não contem a mesma empresa duas vezes
  select string_agg(format('select e.cnpj, e.started_on, e.ibge_code, e.phone1 from audita.cnpj_establishments e where e.cnae_main like %L and e.size_code = any ($3)', x || '%')
      || case when nullif(p_term, '') is not null then ' and e.search_text like ''%'' || $5 || ''%''' else '' end,
    ' union ') into v_cnae from (select distinct x from unnest(p_prefixes) x) d;

  if p_ibge is not null then
    v_where := v_where || ' and u.ibge_code = $1';
  elsif coalesce(p_max_km, 0) > 0 then
    v_where := v_where || ' and u.ibge_code in (select m.ibge_code from audita.ibge_municipalities m where m.km_from_base <= $2)';
  end if;
  if coalesce(p_with_phone, false) then
    v_where := v_where || ' and u.phone1 is not null';
  end if;
  if p_since is not null then
    v_where := v_where || ' and u.started_on >= $4';
  end if;

  v_sql := 'with c as (
      select u.cnpj, u.started_on, count(*) over () as total
      from (' || v_cnae || ') u
      where true' || v_where || '
      order by u.started_on desc nulls last, u.cnpj
      limit $6)
    select e.cnpj, e.is_headquarters, e.legal_name, e.trade_name, e.legal_nature, e.size_code, e.started_on,
      e.cnae_main, e.cnae_secondary, e.street, e.number, e.complement, e.district, e.zip, e.ibge_code, e.phone1,
      e.phone2, e.email, e.publication, c.total
    from c join audita.cnpj_establishments e on e.cnpj = c.cnpj
    order by c.started_on desc nulls last, c.cnpj';

  return query execute v_sql
    using p_ibge, p_max_km, coalesce(p_sizes, array['01', '03', '05']), p_since, p_term,
          least(greatest(coalesce(p_limit, 1000), 1), 1000);
end;
$$;

comment on function audita.prospect_search(text[], numeric, text, text[], boolean, date, text, integer) is
  'PROSPECT: empresas-alvo por prefixos de CNAE, região (raio da sede ou município), porte, telefone, abertura e nome; até 1.000 mais recentes, com o total encontrado. Só administrador e operador (mesma regra da RLS).';

revoke all on function audita.prospect_search(text[], numeric, text, text[], boolean, date, text, integer) from public, anon;
grant execute on function audita.prospect_search(text[], numeric, text, text[], boolean, date, text, integer) to authenticated;
