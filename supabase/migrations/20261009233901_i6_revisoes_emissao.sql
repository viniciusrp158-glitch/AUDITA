-- AUDITA — I6 Revisões imutáveis, emissão de proposta (AUDDOC010-ANX01/ANX02) e decisão do cliente
-- Referências: AUDDOC017 RF-14, RF-15, RF-16, RF-17, RF-22, RF-23, RF-24, CA-04, CA-08; AUDDOC010 §§4–5 e anexos M01/M02;
-- AUDDOC011 §2 (uma cotação por demanda). Somente acréscimos; nada do Audita PRO/HUB é tocado.

-- ---------------------------------------------------------------------------
-- Conteúdo da proposta (campos customizáveis dos modelos M01/M02)
-- ---------------------------------------------------------------------------
alter table audita.quotes
  add column document_model      text not null default 'ANX01' check (document_model in ('ANX01', 'ANX02')),
  add column objective           text check (objective is null or length(objective) <= 4000),
  add column scope_included      text check (scope_included is null or length(scope_included) <= 4000),
  add column scope_excluded      text check (scope_excluded is null or length(scope_excluded) <= 4000),
  add column location_modality   text check (location_modality is null or length(location_modality) <= 1000),
  add column schedule            text check (schedule is null or length(schedule) <= 1000),
  add column methodology         text check (methodology is null or length(methodology) <= 4000),
  add column deliverables        text check (deliverables is null or length(deliverables) <= 4000),
  add column completion_criteria text check (completion_criteria is null or length(completion_criteria) <= 2000),
  add column additional_expenses text check (additional_expenses is null or length(additional_expenses) <= 2000),
  add column cancellation_terms  text check (cancellation_terms is null or length(cancellation_terms) <= 2000),
  add column next_step           text check (next_step is null or length(next_step) <= 1000);

-- ---------------------------------------------------------------------------
-- Modelos técnicos derivados dos anexos aprovados (RF-21: revisão documental × versão técnica)
-- ---------------------------------------------------------------------------
create table audita.document_templates (
  id                 uuid primary key default gen_random_uuid(),
  template_code      text not null check (template_code ~ '^AUDDOC\d{3}-ANX\d{2}$'),
  model_code         text not null,
  title              text not null,
  document_revision  text not null,
  technical_version  text not null,
  source_file_name   text not null,
  source_sha256      text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  status             text not null default 'vigente' check (status in ('vigente', 'substituido')),
  notes              text,
  created_at         timestamptz not null default now(),
  unique (template_code, technical_version)
);
comment on table audita.document_templates is 'Versões técnicas dos modelos usados na emissão, vinculadas à revisão do anexo oficial (arquivo-fonte e SHA-256).';
create unique index document_templates_one_vigente on audita.document_templates (template_code) where status = 'vigente';

insert into audita.document_templates (template_code, model_code, title, document_revision, technical_version, source_file_name, source_sha256, notes) values
  ('AUDDOC010-ANX01', 'M01', 'Proposta comercial integrada (orçamento + aceite)', 'Rev.00', 'v1',
   'AUDDOC010-ANX01_Proposta_Comercial_Integrada_Rev00.docx', 'a3ee2196337de041f1fb42123ddea8153cd63ae93ca90252e83b38159ea551ab',
   'Estrutura e campos do M01 preenchidos pelo sistema; custos internos, horas e margens nunca aparecem no documento do cliente.'),
  ('AUDDOC010-ANX02', 'M02', 'Orçamento simplificado', 'Rev.00', 'v1',
   'AUDDOC010-ANX02_Orcamento_Simplificado_Rev00.docx', '92775de31feb4c82727a7ef8e38137c1aba3e58d8321ba2e4ecd5c98d416fd40',
   'Estrutura e campos do M02 preenchidos pelo sistema; referência pelo código da cotação (PROP).');

create trigger document_templates_block_changes
  before update or delete on audita.document_templates
  for each row execute function audita.audit_log_block_changes();

-- ---------------------------------------------------------------------------
-- Revisões da cotação (snapshot imutável — RF-14, CA-08)
-- ---------------------------------------------------------------------------
create table audita.quote_revisions (
  id                 uuid primary key default gen_random_uuid(),
  quote_id           uuid not null references audita.quotes (id) on delete restrict,
  revision_number    integer not null check (revision_number between 0 and 99),
  status             text not null default 'revisada'
                       check (status in ('revisada', 'emitida', 'aceita', 'recusada', 'cancelada', 'substituida')),
  snapshot           jsonb not null,
  parameter_set_id   uuid not null references audita.pricing_parameter_sets (id) on delete restrict,
  total_once         numeric(16,2),
  total_monthly      numeric(16,2),
  reason             text check (reason is null or length(reason) <= 1000),
  reviewed_at        timestamptz not null default now(),
  reviewed_by        uuid,
  document_model     text check (document_model in ('ANX01', 'ANX02')),
  template_id        uuid references audita.document_templates (id) on delete restrict,
  is_test_document   boolean,
  emitted_at         timestamptz,
  emitted_by         uuid,
  valid_until        date,
  decided_at         timestamptz,
  decided_by         uuid,
  accepted_on        date,
  accepted_by_name   text check (accepted_by_name is null or length(accepted_by_name) <= 200),
  decision_reference text check (decision_reference is null or length(decision_reference) <= 500),
  decision_note      text check (decision_note is null or length(decision_note) <= 2000),
  superseded_at      timestamptz,
  is_test            boolean not null default false,
  unique (quote_id, revision_number),
  constraint quote_revisions_emission_consistent check (
    (status = 'revisada' and emitted_at is null)
    or (status in ('emitida', 'aceita', 'recusada') and emitted_at is not null)
    or status in ('cancelada', 'substituida'))
);
comment on table audita.quote_revisions is 'Revisões Rev.NN da cotação: snapshot imutável de cliente, conteúdo, itens, parâmetros e resultados; emissão e decisão do cliente.';
create index quote_revisions_quote_idx on audita.quote_revisions (quote_id, revision_number desc);

alter table audita.quotes add column current_revision_id uuid references audita.quote_revisions (id) on delete restrict;

create or replace function audita.quote_revisions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Revisões de cotação não podem ser excluídas' using errcode = '42501';
  end if;
  if coalesce(current_setting('audita.quote_flow', true), '') <> 'on' then
    raise exception 'Revisões só mudam pelo fluxo de emissão e decisão' using errcode = '42501';
  end if;
  if new.snapshot is distinct from old.snapshot or new.quote_id is distinct from old.quote_id
     or new.revision_number is distinct from old.revision_number or new.parameter_set_id is distinct from old.parameter_set_id
     or new.total_once is distinct from old.total_once or new.total_monthly is distinct from old.total_monthly
     or new.reviewed_at is distinct from old.reviewed_at or new.reviewed_by is distinct from old.reviewed_by
     or new.reason is distinct from old.reason or new.is_test is distinct from old.is_test
     or (old.emitted_at is not null and (new.emitted_at is distinct from old.emitted_at or new.valid_until is distinct from old.valid_until
         or new.template_id is distinct from old.template_id or new.document_model is distinct from old.document_model
         or new.is_test_document is distinct from old.is_test_document)) then
    raise exception 'O conteúdo de uma revisão é imutável' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger quote_revisions_guard
  before update or delete on audita.quote_revisions
  for each row execute function audita.quote_revisions_guard();
create trigger quote_revisions_audit
  after insert or update on audita.quote_revisions
  for each row execute function audita.log_row_change('id', 'quote_id');

-- ---------------------------------------------------------------------------
-- Documentos gerados (RF-24) — arquivos no bucket privado
-- ---------------------------------------------------------------------------
create table audita.generated_documents (
  id             uuid primary key default gen_random_uuid(),
  revision_id    uuid not null references audita.quote_revisions (id) on delete restrict,
  quote_id       uuid not null references audita.quotes (id) on delete restrict,
  template_id    uuid not null references audita.document_templates (id) on delete restrict,
  kind           text not null check (kind in ('docx', 'pdf')),
  file_name      text not null check (length(file_name) between 5 and 200),
  storage_path   text not null unique check (storage_path ~ '^quotes/[0-9a-f-]{36}/r\d{2}/[A-Za-z0-9._-]+$'),
  size_bytes     integer not null check (size_bytes between 1 and 10485760),
  sha256         text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  watermark      boolean not null,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  unique (revision_id, kind)
);
comment on table audita.generated_documents is 'Arquivos emitidos (DOCX/PDF) por revisão, com SHA-256 e indicação de marca d''água de teste. Somente inclusão.';

create trigger generated_documents_block_changes
  before update or delete on audita.generated_documents
  for each row execute function audita.audit_log_block_changes();
create trigger generated_documents_audit
  after insert on audita.generated_documents
  for each row execute function audita.log_row_change('id', 'quote_id');

-- Downloads também entram na trilha
alter table audita.audit_log drop constraint audit_log_action_check;
alter table audita.audit_log add constraint audit_log_action_check
  check (action in ('insert', 'update', 'delete', 'login', 'logout', 'access_denied', 'download'));

-- ---------------------------------------------------------------------------
-- Cotação: situação e revisão corrente só pelo fluxo (sessão "audita.quote_flow")
-- ---------------------------------------------------------------------------
create or replace function audita.quotes_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dem_client uuid;
  dem_status text;
  flow boolean := coalesce(current_setting('audita.quote_flow', true), '') = 'on';
begin
  select client_id, status into dem_client, dem_status from audita.demands where id = new.demand_id;
  new.client_id := dem_client;
  if tg_op = 'INSERT' then
    if dem_status in ('encerrada', 'nao_viavel', 'cancelada') then
      raise exception 'Demanda encerrada, não viável ou cancelada não recebe cotação' using errcode = '23514';
    end if;
    new.quote_code := 'PROP-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-'
      || lpad(audita.allocate_code('quote', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY'))::text, 4, '0');
    new.status := 'rascunho';
    new.current_revision_id := null;
    new.created_at := now();
    new.created_by := (select auth.uid());
  else
    if new.id is distinct from old.id or new.quote_code is distinct from old.quote_code or new.demand_id is distinct from old.demand_id
       or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
      raise exception 'Código e demanda da cotação são permanentes' using errcode = '42501';
    end if;
    if flow then
      -- pelo fluxo: apenas situação e revisão corrente
      if (to_jsonb(new) - 'status' - 'current_revision_id' - 'updated_at' - 'updated_by')
         is distinct from (to_jsonb(old) - 'status' - 'current_revision_id' - 'updated_at' - 'updated_by') then
        raise exception 'O fluxo de emissão altera apenas a situação da cotação' using errcode = '42501';
      end if;
    else
      if old.status <> 'rascunho' then
        raise exception 'Somente cotações em rascunho podem ser alteradas' using errcode = '42501';
      end if;
      if new.status is distinct from old.status or new.current_revision_id is distinct from old.current_revision_id then
        raise exception 'A situação da cotação é controlada pelo fluxo de revisão e emissão' using errcode = '42501';
      end if;
    end if;
  end if;
  if new.parameter_set_id is not null
     and (tg_op = 'INSERT' or new.parameter_set_id is distinct from old.parameter_set_id)
     and not exists (select 1 from audita.pricing_parameter_sets p where p.id = new.parameter_set_id and p.status = 'vigente') then
    raise exception 'A cotação só pode adotar a versão vigente dos parâmetros' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Verificações (mostradas na tela e repetidas no banco)
-- ---------------------------------------------------------------------------
create or replace function audita.quote_contact_id(p_quote_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select d.contact_id from audita.quotes q join audita.demands d on d.id = q.demand_id
      join audita.client_contacts c on c.id = d.contact_id and c.status = 'ativo' where q.id = p_quote_id),
    (select c.id from audita.quotes q join audita.client_contacts c on c.client_id = q.client_id and c.status = 'ativo'
      where q.id = p_quote_id order by c.is_primary desc, c.created_at limit 1));
$$;

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

create or replace function audita.revision_emission_blockers(p_revision_id uuid)
returns text[]
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  r audita.quote_revisions;
  out text[] := '{}';
  it jsonb;
begin
  select * into r from audita.quote_revisions where id = p_revision_id;
  if not found then
    return array['Revisão não encontrada.'];
  end if;
  if r.status <> 'revisada' then
    out := array_append(out, 'Somente revisões concluídas e ainda não emitidas podem ser emitidas.');
  end if;
  for it in select * from jsonb_array_elements(r.snapshot -> 'items') loop
    if (it ->> 'service_id') is null or not audita.service_allows_commercial_proposal((it ->> 'service_id')::uuid) then
      out := out || format('%s — %s: serviço não liberado comercialmente (AUDDOC004/AUDDOC005 §14).',
                           coalesce(it #>> '{service,service_code}', 'sem código'), it ->> 'description');
    end if;
  end loop;
  return out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fluxo: concluir revisão → emitir → aceite / recusa / cancelamento; reabrir para nova revisão
-- ---------------------------------------------------------------------------
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

create or replace function audita.reopen_quote(p_quote_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q audita.quotes;
  r audita.quote_revisions;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into q from audita.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Cotação não encontrada' using errcode = 'P0002';
  end if;
  if q.status not in ('revisada', 'emitida', 'recusada', 'aceita') then
    raise exception 'Esta cotação não pode ser reaberta' using errcode = '22023';
  end if;
  if reason is null or length(reason) < 5 then
    raise exception 'Informe o motivo da reabertura' using errcode = '23514';
  end if;
  select * into r from audita.quote_revisions where id = q.current_revision_id for update;
  perform set_config('audita.quote_flow', 'on', true);
  update audita.quote_revisions
     set status = case when status in ('revisada', 'emitida') then 'substituida' else status end,
         superseded_at = now(),
         decision_note = case when status in ('revisada', 'emitida') then reason else decision_note end,
         decided_at = case when status in ('revisada', 'emitida') then now() else decided_at end,
         decided_by = case when status in ('revisada', 'emitida') then (select auth.uid()) else decided_by end
   where id = r.id;
  update audita.quotes set status = 'rascunho' where id = q.id;
  perform set_config('audita.quote_flow', 'off', true);
end;
$$;

create or replace function audita.register_emission(p_revision_id uuid, p_template_id uuid, p_watermark boolean, p_docs jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r audita.quote_revisions;
  q audita.quotes;
  t audita.document_templates;
  d audita.demands;
  blockers text[];
  doc jsonb;
  must_mark boolean;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into r from audita.quote_revisions where id = p_revision_id for update;
  if not found then
    raise exception 'Revisão não encontrada' using errcode = 'P0002';
  end if;
  select * into q from audita.quotes where id = r.quote_id for update;
  if q.current_revision_id is distinct from r.id then
    raise exception 'Somente a revisão corrente pode ser emitida' using errcode = '22023';
  end if;
  blockers := audita.revision_emission_blockers(p_revision_id);
  if cardinality(blockers) > 0 then
    raise exception 'Emissão bloqueada: %', array_to_string(blockers, ' | ') using errcode = '23514';
  end if;
  select * into t from audita.document_templates
   where id = p_template_id and status = 'vigente' and template_code = 'AUDDOC010-' || (r.snapshot #>> '{quote,model}');
  if not found then
    raise exception 'Modelo técnico inválido para esta revisão' using errcode = '22023';
  end if;
  -- Marca d'água obrigatória para dados de teste (RF-17)
  must_mark := r.is_test or coalesce((r.snapshot #>> '{parameters,is_test}')::boolean, false)
               or coalesce((r.snapshot #>> '{client,is_test}')::boolean, false);
  if must_mark and not coalesce(p_watermark, false) then
    raise exception 'Documento de teste exige marca d''água' using errcode = '23514';
  end if;
  if jsonb_typeof(p_docs) <> 'array' or jsonb_array_length(p_docs) <> 2
     or (select count(distinct e ->> 'kind') from jsonb_array_elements(p_docs) e where e ->> 'kind' in ('docx', 'pdf')) <> 2 then
    raise exception 'Informe os arquivos DOCX e PDF' using errcode = '22023';
  end if;

  for doc in select * from jsonb_array_elements(p_docs) loop
    if not exists (select 1 from storage.objects o where o.bucket_id = 'audita-documentos' and o.name = doc ->> 'storage_path') then
      raise exception 'Arquivo não encontrado no armazenamento: %', doc ->> 'storage_path' using errcode = '22023';
    end if;
    if (doc ->> 'storage_path') not like ('quotes/' || q.id::text || '/r' || lpad(r.revision_number::text, 2, '0') || '/%') then
      raise exception 'Caminho de arquivo fora da revisão' using errcode = '22023';
    end if;
    insert into audita.generated_documents (revision_id, quote_id, template_id, kind, file_name, storage_path, size_bytes, sha256, watermark)
    values (r.id, q.id, t.id, doc ->> 'kind', doc ->> 'file_name', doc ->> 'storage_path', (doc ->> 'size_bytes')::integer,
            doc ->> 'sha256', coalesce(p_watermark, false));
  end loop;

  perform set_config('audita.quote_flow', 'on', true);
  update audita.quote_revisions
     set status = 'emitida', emitted_at = now(), emitted_by = (select auth.uid()), template_id = t.id,
         document_model = r.snapshot #>> '{quote,model}', is_test_document = coalesce(p_watermark, false),
         valid_until = (now() at time zone 'America/Sao_Paulo')::date + coalesce((r.snapshot #>> '{quote,validity_days}')::integer, 0)
   where id = r.id;
  update audita.quotes set status = 'emitida' where id = q.id;
  perform set_config('audita.quote_flow', 'off', true);

  -- Demanda acompanha: proposta enviada (sem retroceder situações posteriores)
  select * into d from audita.demands where id = q.demand_id;
  if d.status in ('recebida', 'em_analise', 'aguardando_cliente') then
    perform audita.change_demand_status(d.id, 'proposta_enviada',
      format('Proposta %s Rev.%s emitida.', q.quote_code, lpad(r.revision_number::text, 2, '0')));
  else
    insert into audita.demand_events (demand_id, event_type, description)
    values (d.id, 'nota', format('Proposta %s Rev.%s emitida.', q.quote_code, lpad(r.revision_number::text, 2, '0')));
  end if;
end;
$$;

create or replace function audita.register_quote_decision(
  p_quote_id uuid, p_decision text, p_date date default null, p_name text default null,
  p_reference text default null, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q audita.quotes;
  r audita.quote_revisions;
  d audita.demands;
  note text := nullif(btrim(coalesce(p_note, '')), '');
  ref text := nullif(btrim(coalesce(p_reference, '')), '');
  nm text := nullif(btrim(coalesce(p_name, '')), '');
  label text;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into q from audita.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Cotação não encontrada' using errcode = 'P0002';
  end if;
  select * into r from audita.quote_revisions where id = q.current_revision_id for update;
  label := format('%s Rev.%s', q.quote_code, lpad(coalesce(r.revision_number, 0)::text, 2, '0'));

  perform set_config('audita.quote_flow', 'on', true);
  if p_decision = 'aceita' then
    if q.status <> 'emitida' then
      raise exception 'Somente propostas emitidas podem ser aceitas' using errcode = '22023';
    end if;
    if p_date is null or p_date > today or p_date < (r.emitted_at at time zone 'America/Sao_Paulo')::date then
      raise exception 'Data do aceite inválida (entre a emissão e hoje)' using errcode = '23514';
    end if;
    if ref is null or length(ref) < 3 or nm is null or length(nm) < 2 then
      raise exception 'Informe quem aceitou e a referência do aceite (e-mail, protocolo, assinatura)' using errcode = '23514';
    end if;
    update audita.quote_revisions
       set status = 'aceita', decided_at = now(), decided_by = (select auth.uid()), accepted_on = p_date,
           accepted_by_name = nm, decision_reference = ref, decision_note = note
     where id = r.id;
    update audita.quotes set status = 'aceita' where id = q.id;
  elsif p_decision = 'recusada' then
    if q.status <> 'emitida' then
      raise exception 'Somente propostas emitidas podem ser recusadas' using errcode = '22023';
    end if;
    if note is null or length(note) < 3 then
      raise exception 'Informe o motivo da recusa' using errcode = '23514';
    end if;
    update audita.quote_revisions
       set status = 'recusada', decided_at = now(), decided_by = (select auth.uid()), decision_reference = ref, decision_note = note
     where id = r.id;
    update audita.quotes set status = 'recusada' where id = q.id;
  elsif p_decision = 'cancelada' then
    if q.status not in ('rascunho', 'revisada', 'emitida', 'recusada') then
      raise exception 'Esta cotação não pode ser cancelada' using errcode = '22023';
    end if;
    if note is null or length(note) < 3 then
      raise exception 'Informe o motivo do cancelamento' using errcode = '23514';
    end if;
    if r.id is not null and r.status in ('revisada', 'emitida') then
      update audita.quote_revisions
         set status = 'cancelada', decided_at = now(), decided_by = (select auth.uid()), decision_note = note
       where id = r.id;
    end if;
    update audita.quotes set status = 'cancelada' where id = q.id;
  else
    raise exception 'Decisão inválida' using errcode = '22023';
  end if;
  perform set_config('audita.quote_flow', 'off', true);

  select * into d from audita.demands where id = q.demand_id;
  if p_decision = 'aceita' and d.status not in ('aceita', 'em_execucao', 'entregue', 'encerrada', 'nao_viavel', 'cancelada') then
    perform audita.change_demand_status(d.id, 'aceita', format('Proposta %s aceita em %s — %s.', label, to_char(p_date, 'DD/MM/YYYY'), ref));
  else
    insert into audita.demand_events (demand_id, event_type, description)
    values (d.id, 'nota', case p_decision
      when 'aceita' then format('Proposta %s aceita em %s — %s.', label, to_char(p_date, 'DD/MM/YYYY'), ref)
      when 'recusada' then format('Proposta %s recusada: %s', label, note)
      else format('Cotação %s cancelada: %s', q.quote_code, note) end);
  end if;
end;
$$;

create or replace function audita.log_document_download(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g audita.generated_documents;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into g from audita.generated_documents where id = p_document_id;
  if not found then
    raise exception 'Documento não encontrado' using errcode = 'P0002';
  end if;
  insert into audita.audit_log (actor_user_id, action, entity, entity_id, parent_entity_id, summary, origin)
  values ((select auth.uid()), 'download', 'generated_documents', g.id::text, g.quote_id::text,
          jsonb_build_object('file_name', g.file_name, 'kind', g.kind), 'app');
end;
$$;

-- ---------------------------------------------------------------------------
-- Armazenamento privado (RF-22): somente usuários autorizados; sem atualização nem exclusão
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audita-documentos', 'audita-documentos', false, 10485760,
        array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy audita_documentos_select on storage.objects for select to authenticated
  using (bucket_id = 'audita-documentos' and (select audita.is_admin()));
create policy audita_documentos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'audita-documentos' and (select audita.is_admin()) and name like 'quotes/%');

-- ---------------------------------------------------------------------------
-- RLS e privilégios
-- ---------------------------------------------------------------------------
alter table audita.document_templates enable row level security;
alter table audita.quote_revisions enable row level security;
alter table audita.generated_documents enable row level security;

create policy document_templates_select on audita.document_templates for select to authenticated using ((select audita.is_admin()));
create policy quote_revisions_select on audita.quote_revisions for select to authenticated using ((select audita.is_admin()));
create policy generated_documents_select on audita.generated_documents for select to authenticated using ((select audita.is_admin()));

revoke all on audita.document_templates, audita.quote_revisions, audita.generated_documents from public, anon, authenticated;
grant select on audita.document_templates, audita.quote_revisions, audita.generated_documents to authenticated;

revoke all on function audita.quote_revisions_guard(), audita.quote_contact_id(uuid), audita.quote_review_blockers(uuid),
  audita.revision_emission_blockers(uuid), audita.freeze_quote_revision(uuid, jsonb, text), audita.reopen_quote(uuid, text),
  audita.register_emission(uuid, uuid, boolean, jsonb), audita.register_quote_decision(uuid, text, date, text, text, text),
  audita.log_document_download(uuid) from public, anon, authenticated;
grant execute on function audita.quote_contact_id(uuid), audita.quote_review_blockers(uuid), audita.revision_emission_blockers(uuid),
  audita.freeze_quote_revision(uuid, jsonb, text), audita.reopen_quote(uuid, text),
  audita.register_emission(uuid, uuid, boolean, jsonb), audita.register_quote_decision(uuid, text, date, text, text, text),
  audita.log_document_download(uuid) to authenticated;

grant all on all tables in schema audita to service_role;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
