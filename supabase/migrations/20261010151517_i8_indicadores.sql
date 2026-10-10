-- AUDITA — I8 Indicadores gerenciais (AUDDOC017 RF-29, RF-30, §14, CA-11)
-- Uma única função calcula todos os números a partir dos dados reais, respeitando a RLS de quem consulta
-- (security invoker: usuário não autorizado vê zeros). Datas no fuso America/Sao_Paulo. Somente acréscimo.
--
-- Regras (AUDDOC017 §14):
--  * Clientes ativos: situação ativa (fotografia atual), excluindo dados de teste salvo pedido expresso.
--  * Cotações por estágio: cotações criadas no período, pela situação atual; "em aberto" = rascunho + revisada + emitida.
--  * Valor cotado: propostas emitidas no período — por cotação, só a última revisão emitida no período;
--    valor único e valor mensal NUNCA somados entre si. Não é receita.
--  * Valor aceito: propostas aceitas no período — por cotação, só a última revisão aceita (sem duplicar revisões).
--  * Conversão: aceitas ÷ (aceitas + recusadas) com decisão no período; null ("sem dados") se o denominador for zero.
--  * Ticket médio aceito: valor aceito ÷ quantidade aceita, por periodicidade; null sem dados.
--  * Demandas: pendentes (não encerradas) e atrasadas (prazo vencido) agora; recebidas no período.

create or replace function audita.dashboard_indicators(p_from date, p_to date, p_include_test boolean default false)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  q as (
    select q.* from audita.quotes q where p_include_test or not q.is_test
  ),
  -- última revisão emitida no período, por cotação (revisões emitidas mantêm emitted_at mesmo se substituídas)
  emitted as (
    select distinct on (r.quote_id) r.quote_id, r.total_once, r.total_monthly
      from audita.quote_revisions r join q on q.id = r.quote_id
     where r.emitted_at is not null
       and (r.emitted_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
     order by r.quote_id, r.emitted_at desc
  ),
  -- última decisão (aceite/recusa) no período, por cotação
  decided as (
    select distinct on (r.quote_id) r.quote_id, r.status, r.total_once, r.total_monthly
      from audita.quote_revisions r join q on q.id = r.quote_id
     where r.status in ('aceita', 'recusada') and r.decided_at is not null
       and (r.decided_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
     order by r.quote_id, r.decided_at desc
  ),
  accepted as (select * from decided where status = 'aceita'),
  stages as (
    select q.status, count(*) as n from q
     where (q.created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
     group by q.status
  ),
  d as (select dm.* from audita.demands dm where p_include_test or not dm.is_test),
  today as (select (now() at time zone 'America/Sao_Paulo')::date as t)
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'include_test', p_include_test,
    'clients_active', (select count(*) from audita.clients c where c.status = 'ativo' and (p_include_test or not c.is_test)),
    'quotes_by_stage', coalesce((select jsonb_object_agg(status, n) from stages), '{}'::jsonb),
    'quotes_open', coalesce((select sum(n) from stages where status in ('rascunho', 'revisada', 'emitida')), 0),
    'quotes_open_now', (select count(*) from q where q.status in ('rascunho', 'revisada', 'emitida')),
    'quoted', jsonb_build_object(
      'count', (select count(*) from emitted),
      'once', (select coalesce(sum(total_once), 0) from emitted),
      'monthly', (select coalesce(sum(total_monthly), 0) from emitted)),
    'accepted', jsonb_build_object(
      'count', (select count(*) from accepted),
      'once', (select coalesce(sum(total_once), 0) from accepted),
      'monthly', (select coalesce(sum(total_monthly), 0) from accepted),
      'avg_once', (select case when count(total_once) = 0 then null else round(avg(total_once), 2) end from accepted),
      'avg_monthly', (select case when count(total_monthly) = 0 then null else round(avg(total_monthly), 2) end from accepted)),
    'decisions', jsonb_build_object(
      'accepted', (select count(*) from decided where status = 'aceita'),
      'refused', (select count(*) from decided where status = 'recusada')),
    'conversion', (select case when count(*) = 0 then null
                               else round(count(*) filter (where status = 'aceita')::numeric / count(*), 4) end from decided),
    'demands', jsonb_build_object(
      'pending', (select count(*) from d where d.status not in ('encerrada', 'nao_viavel', 'cancelada')),
      'overdue', (select count(*) from d, today where d.status not in ('encerrada', 'nao_viavel', 'cancelada') and d.due_on < today.t),
      'received', (select count(*) from d where d.received_on between p_from and p_to))
  );
$$;

comment on function audita.dashboard_indicators(date, date, boolean) is
  'Indicadores do painel (AUDDOC017 §14). Valor cotado/aceito ≠ dinheiro recebido; único e mensal separados.';

revoke all on function audita.dashboard_indicators(date, date, boolean) from public, anon, authenticated;
grant execute on function audita.dashboard_indicators(date, date, boolean) to authenticated;
grant all on function audita.dashboard_indicators(date, date, boolean) to service_role;
