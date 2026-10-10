-- AUDITA — I6 ajuste solicitado pelo Diretor (10/10/2026): tempo de contrato para serviços mensais.
-- Prestação mensal é feita sob contrato: a proposta informa o início previsto, o número de meses, a data final
-- e o valor total do contrato. Somente acréscimos: duas colunas novas e substituição de duas funções
-- (mesmas assinaturas; a única diferença é a inclusão do contrato nas pendências e no snapshot da revisão).

alter table audita.quotes
  add column contract_start_on date,
  add column contract_months   integer check (contract_months is null or contract_months between 1 and 120);
comment on column audita.quotes.contract_start_on is 'Início previsto do contrato (serviços mensais).';
comment on column audita.quotes.contract_months is 'Tempo de contrato em meses (serviços mensais); define a data final e o valor total do contrato.';

create or replace function audita.quote_review_blockers(p_quote_id uuid)
returns text[]
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  q audita.quotes;
  c audita.clients;
  out text[] := '{}';
  fld record;
begin
  select * into q from audita.quotes where id = p_quote_id;
  if not found then
    return array['Cotação não encontrada.'];
  end if;
  select * into c from audita.clients where id = q.client_id;
  if c.status = 'inativo' then out := array_append(out, 'Cliente inativo.'); end if;
  if c.tax_id is null then out := array_append(out, 'CNPJ/CPF do cliente não informado no cadastro.'); end if;
  if audita.quote_contact_id(p_quote_id) is null then out := array_append(out, 'Nenhum contato ativo do cliente (representante da proposta).'); end if;
  if q.parameter_set_id is null then out := array_append(out, 'Nenhuma versão de parâmetros financeiros adotada.'); end if;
  if not exists (select 1 from audita.quote_items i where i.quote_id = p_quote_id) then out := array_append(out, 'Cotação sem itens.'); end if;
  if exists (select 1 from audita.quote_items i where i.quote_id = p_quote_id and i.service_id is null) then
    out := array_append(out, 'Há item sem serviço do catálogo (necessário para verificar a liberação na AUDDOC004).');
  end if;
  if q.validity_days is null then out := array_append(out, 'Validade (dias) não informada.'); end if;
  if exists (select 1 from audita.quote_items i where i.quote_id = p_quote_id and i.periodicity = 'mensal') then
    if q.contract_start_on is null then out := array_append(out, 'Início previsto do contrato não informado (há item mensal).'); end if;
    if q.contract_months is null then out := array_append(out, 'Tempo de contrato (meses) não informado (há item mensal).'); end if;
  end if;
  for fld in
    select * from (values
      ('ANX01', 'objective', q.objective, 'Objetivo e necessidade do cliente'),
      ('ANX01', 'scope_included', q.scope_included, 'Escopo incluído'),
      ('ANX02', 'scope_included', q.scope_included, 'Inclusões'),
      ('ANX01', 'scope_excluded', q.scope_excluded, 'Exclusões'),
      ('ANX01', 'location_modality', q.location_modality, 'Local / modalidade'),
      ('ANX01', 'schedule', q.schedule, 'Prazo / vigência'),
      ('ANX02', 'schedule', q.schedule, 'Prazo estimado'),
      ('ANX01', 'methodology', q.methodology, 'Metodologia'),
      ('ANX01', 'deliverables', q.deliverables, 'Entregáveis'),
      ('ANX01', 'completion_criteria', q.completion_criteria, 'Critério de conclusão'),
      ('ANX01', 'payment_terms', q.payment_terms, 'Pagamento'),
      ('ANX02', 'payment_terms', q.payment_terms, 'Condição de pagamento'),
      ('ANX01', 'additional_expenses', q.additional_expenses, 'Despesas adicionais'),
      ('ANX01', 'cancellation_terms', q.cancellation_terms, 'Reagendamento e cancelamento'),
      ('ANX02', 'next_step', q.next_step, 'Próximo passo')
    ) as t(model, col, val, label)
    where model = q.document_model
  loop
    if fld.val is null or length(btrim(fld.val)) = 0 then
      out := array_append(out, (fld.label || ' não preenchido(a).'));
    end if;
  end loop;
  return out;
end;
$$;


create or replace function audita.freeze_quote_revision(p_quote_id uuid, p_results jsonb, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  q audita.quotes;
  blockers text[];
  n integer;
  rid uuid;
  snap jsonb;
  item_ids uuid[];
  result_ids uuid[];
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into q from audita.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Cotação não encontrada' using errcode = 'P0002';
  end if;
  if q.status <> 'rascunho' then
    raise exception 'Somente cotações em rascunho podem ser revisadas' using errcode = '22023';
  end if;
  blockers := audita.quote_review_blockers(p_quote_id);
  if cardinality(blockers) > 0 then
    raise exception 'Pendências para concluir a revisão: %', array_to_string(blockers, ' | ') using errcode = '23514';
  end if;

  -- Resultados do motor (aplicação) devem corresponder exatamente aos itens atuais e estar PRONTOS
  select array_agg(id order by id) into item_ids from audita.quote_items where quote_id = p_quote_id;
  select array_agg((e ->> 'id')::uuid order by (e ->> 'id')::uuid) into result_ids from jsonb_array_elements(p_results -> 'items') e;
  if item_ids is distinct from result_ids then
    raise exception 'Os resultados não correspondem aos itens atuais da cotação; recalcule' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_results -> 'items') e where e ->> 'status' <> 'PRONTO') then
    raise exception 'Todos os itens precisam estar PRONTO PARA ANÁLISE INTERNA' using errcode = '23514';
  end if;
  if (p_results ->> 'parameter_set_id')::uuid is distinct from q.parameter_set_id then
    raise exception 'Resultados calculados com outra versão de parâmetros; recalcule' using errcode = '22023';
  end if;

  select coalesce(max(revision_number) + 1, 0) into n from audita.quote_revisions where quote_id = p_quote_id;
  if n > 0 and (reason is null or length(reason) < 5) then
    raise exception 'Informe o motivo da nova revisão' using errcode = '23514';
  end if;

  -- Snapshot: dados de origem lidos do banco + resultados do motor
  select jsonb_build_object(
    'schema', 1,
    'frozen_at', now(),
    'quote', jsonb_build_object(
      'id', q.id, 'code', q.quote_code, 'revision', n, 'model', q.document_model, 'validity_days', q.validity_days,
      'payment_terms', q.payment_terms, 'objective', q.objective, 'scope_included', q.scope_included,
      'scope_excluded', q.scope_excluded, 'location_modality', q.location_modality, 'schedule', q.schedule,
      'methodology', q.methodology, 'deliverables', q.deliverables, 'completion_criteria', q.completion_criteria,
      'additional_expenses', q.additional_expenses, 'cancellation_terms', q.cancellation_terms, 'next_step', q.next_step,
      'contract_start_on', q.contract_start_on, 'contract_months', q.contract_months,
      'is_test', q.is_test),
    'demand', (select jsonb_build_object('id', d.id, 'code', d.demand_code, 'summary', d.summary) from audita.demands d where d.id = q.demand_id),
    'client', (select jsonb_build_object('id', c.id, 'code', c.client_code, 'person_type', c.person_type, 'legal_name', c.legal_name,
                 'trade_name', c.trade_name, 'tax_id', c.tax_id, 'address_street', c.address_street, 'address_number', c.address_number,
                 'address_complement', c.address_complement, 'address_district', c.address_district, 'address_city', c.address_city,
                 'address_state', c.address_state, 'address_zip', c.address_zip, 'is_test', c.is_test)
               from audita.clients c where c.id = q.client_id),
    'unit', (select jsonb_build_object('id', u.id, 'name', u.name, 'address_city', u.address_city, 'address_state', u.address_state)
             from audita.demands d join audita.client_units u on u.id = d.unit_id where d.id = q.demand_id),
    'contact', (select jsonb_build_object('id', ct.id, 'full_name', ct.full_name, 'role_title', ct.role_title, 'email', ct.email, 'phone', ct.phone)
                from audita.client_contacts ct where ct.id = audita.quote_contact_id(q.id)),
    'parameters', (select to_jsonb(p) - 'created_by' - 'updated_by' - 'published_by' from audita.pricing_parameter_sets p where p.id = q.parameter_set_id),
    'items', (select jsonb_agg(to_jsonb(i) - 'created_by' - 'updated_by' || jsonb_build_object('service',
                (select jsonb_build_object('service_code', s.service_code, 'name', s.name, 'family', s.family, 'pricing_model', s.pricing_model,
                        'commercial_status', s.commercial_status, 'catalog_status', s.catalog_status, 'billing_unit_ref', s.billing_unit_ref)
                 from audita.services s where s.id = i.service_id))
              order by i.position, i.created_at)
              from audita.quote_items i where i.quote_id = q.id),
    'results', p_results
  ) into snap;

  insert into audita.quote_revisions (quote_id, revision_number, status, snapshot, parameter_set_id, total_once, total_monthly,
                                      reason, reviewed_at, reviewed_by, is_test)
  values (q.id, n, 'revisada', snap, q.parameter_set_id,
          round(nullif(p_results #>> '{totals,unica}', '')::numeric, 2), round(nullif(p_results #>> '{totals,mensal}', '')::numeric, 2),
          reason, now(), (select auth.uid()), q.is_test)
  returning id into rid;

  perform set_config('audita.quote_flow', 'on', true);
  update audita.quotes set status = 'revisada', current_revision_id = rid where id = q.id;
  perform set_config('audita.quote_flow', 'off', true);
  return rid;
end;
$$;


revoke all on function audita.quote_review_blockers(uuid), audita.freeze_quote_revision(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function audita.quote_review_blockers(uuid), audita.freeze_quote_revision(uuid, jsonb, text) to authenticated;
grant all on function audita.quote_review_blockers(uuid), audita.freeze_quote_revision(uuid, jsonb, text) to service_role;

notify pgrst, 'reload schema';
