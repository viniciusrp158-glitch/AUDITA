-- V1.1 — Serviço contratado e execução (AUDDOC017 RF-07), documentos de formalização M03–M06 (RF-23) e
-- caixa gerencial de recebimentos e pagamentos efetivos (RF-18; AUDDOC011 §7 e aba "Caixa Mensal" do ANX01).
-- Referências: AUDDOC009 §6.3–§6.5 e §8 (execução, entrega, encerramento; estados Em execução → Entregue → Encerrada);
-- AUDDOC010 §2–§4 e ANX03–ANX06 (M03 aceite, M04 contrato, M05 OS comercial OS-COM-AAAA-NNNN, M06 alteração ALT-AAAA-NNNN;
-- CTR-AAAA-NNNN como identificador sugerido de contratação, sujeito ao AUDDOC013).
-- Limites: não replica operações do Audita PRO/HUB (RF-07); o caixa não substitui contabilidade (RF-18); os modelos M03–M06
-- saem sempre como MINUTA, pendentes de revisão jurídica (AUDDOC010 §7; caderno de pendências item 8).
-- Acesso: somente o administrador (modo mais restritivo). Sem exclusão física; estorno lógico no caixa. Somente aditiva.

-- ---------------------------------------------------------------------------
-- Serviço contratado (RF-07)
-- ---------------------------------------------------------------------------
create table audita.service_contracts (
  id                     uuid primary key default gen_random_uuid(),
  contract_code          text not null unique,
  quote_id               uuid not null unique references audita.quotes (id) on delete restrict,
  revision_id            uuid not null references audita.quote_revisions (id) on delete restrict,
  client_id              uuid not null references audita.clients (id) on delete restrict,
  demand_id              uuid not null references audita.demands (id) on delete restrict,
  modality               text not null check (modality in ('pontual', 'recorrente')),
  starts_on              date,
  ends_on                date,
  executor_name          text check (executor_name is null or length(executor_name) <= 160),
  executor_role          text check (executor_role is null or length(executor_role) <= 160),
  client_representative  text check (client_representative is null or length(client_representative) <= 200),
  scope_summary          text check (scope_summary is null or length(scope_summary) <= 2000),
  deliverables           text check (deliverables is null or length(deliverables) <= 2000),
  additional_conditions  text check (additional_conditions is null or length(additional_conditions) <= 2000),
  notes                  text check (notes is null or length(notes) <= 2000),
  status                 text not null default 'planejado'
                           check (status in ('planejado', 'em_execucao', 'suspenso', 'entregue', 'encerrado', 'cancelado')),
  status_note            text check (status_note is null or length(status_note) <= 1000),
  status_changed_at      timestamptz not null default now(),
  is_test                boolean not null default false,
  created_at             timestamptz not null default now(),
  created_by             uuid default auth.uid(),
  updated_at             timestamptz not null default now(),
  updated_by             uuid,
  constraint service_contracts_period check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
comment on table audita.service_contracts is 'Serviço contratado a partir de proposta aceita (RF-07). Código CTR-AAAA-NNNN (sugestão do AUDDOC010 §4).';
create index service_contracts_status_idx on audita.service_contracts (status);
create index service_contracts_client_idx on audita.service_contracts (client_id);

create or replace function audita.service_contracts_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('audita.contract_flow', true), '') <> 'on' then
      raise exception 'Use a função de registro do serviço contratado.' using errcode = '42501';
    end if;
    new.contract_code := 'CTR-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-'
      || lpad(audita.allocate_code('contract', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY'))::text, 4, '0');
    new.created_by := (select auth.uid());
    return new;
  end if;
  if new.contract_code is distinct from old.contract_code or new.quote_id is distinct from old.quote_id
     or new.revision_id is distinct from old.revision_id or new.client_id is distinct from old.client_id
     or new.demand_id is distinct from old.demand_id or new.is_test is distinct from old.is_test
     or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'Campo não pode ser alterado' using errcode = '42501';
  end if;
  if coalesce(current_setting('audita.contract_flow', true), '') <> 'on' then
    if new.status is distinct from old.status or new.status_note is distinct from old.status_note
       or new.status_changed_at is distinct from old.status_changed_at then
      raise exception 'A situação muda somente pela função de situação.' using errcode = '42501';
    end if;
    if old.status in ('encerrado', 'cancelado') then
      raise exception 'Serviço encerrado ou cancelado não pode ser alterado.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger service_contracts_before_write before insert or update on audita.service_contracts
  for each row execute function audita.service_contracts_before_write();
create trigger service_contracts_set_updated_meta before update on audita.service_contracts
  for each row execute function audita.set_updated_meta();
create trigger service_contracts_audit after insert or update on audita.service_contracts
  for each row execute function audita.log_row_change('id', 'client_id');

-- Linha do tempo da execução (somente inclusão) — AUDDOC009 §6.3–§6.5 e §8 "Execução"/"Conclusão"
create table audita.service_contract_events (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references audita.service_contracts (id) on delete restrict,
  event_type   text not null check (event_type in ('agenda', 'execucao', 'evidencia', 'entrega', 'pendencia', 'ocorrencia', 'anotacao', 'situacao', 'alteracao_escopo', 'documento')),
  occurred_on  date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  description  text not null check (length(btrim(description)) between 3 and 2000),
  channel      text check (channel is null or length(channel) <= 200),
  recipient    text check (recipient is null or length(recipient) <= 200),
  from_status  text,
  to_status    text,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid()
);
create index service_contract_events_contract_idx on audita.service_contract_events (contract_id, created_at);

create or replace function audita.service_contract_events_block_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A linha do tempo da execução é somente inclusão' using errcode = '42501';
end;
$$;
create trigger service_contract_events_block_changes before update or delete on audita.service_contract_events
  for each row execute function audita.service_contract_events_block_changes();
create trigger service_contract_events_audit after insert on audita.service_contract_events
  for each row execute function audita.log_row_change('id', 'contract_id');

-- Registro do serviço contratado a partir da proposta aceita (cliente e demanda vêm da própria cotação)
create or replace function audita.create_service_contract(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  q   audita.quotes;
  r   audita.quote_revisions;
  d   audita.demands;
  cid uuid;
  mod text;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into q from audita.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Cotação não encontrada' using errcode = 'P0002';
  elsif q.status <> 'aceita' then
    raise exception 'Somente propostas aceitas viram serviço contratado' using errcode = '22023';
  end if;
  if exists (select 1 from audita.service_contracts where quote_id = q.id) then
    raise exception 'Esta proposta já tem serviço contratado registrado' using errcode = '23505';
  end if;
  select * into r from audita.quote_revisions where id = q.current_revision_id;
  select * into d from audita.demands where id = q.demand_id;
  mod := case when r.total_monthly is not null and r.total_monthly > 0 then 'recorrente' else 'pontual' end;
  perform set_config('audita.contract_flow', 'on', true);
  insert into audita.service_contracts (quote_id, revision_id, client_id, demand_id, modality, starts_on, ends_on,
                                        scope_summary, deliverables, client_representative, is_test)
  values (q.id, r.id, d.client_id, d.id, mod,
          nullif(r.snapshot #>> '{quote,contract_start_on}', '')::date,
          case when nullif(r.snapshot #>> '{quote,contract_start_on}', '') is not null and nullif(r.snapshot #>> '{quote,contract_months}', '') is not null
               then ((r.snapshot #>> '{quote,contract_start_on}')::date + make_interval(months => (r.snapshot #>> '{quote,contract_months}')::int) - interval '1 day')::date end,
          left(coalesce(r.snapshot #>> '{quote,objective}', r.snapshot #>> '{quote,scope_included}'), 2000),
          left(r.snapshot #>> '{quote,deliverables}', 2000),
          left(nullif(btrim(coalesce(r.accepted_by_name, '')), ''), 200),
          q.is_test)
  returning id into cid;
  insert into audita.service_contract_events (contract_id, event_type, description, to_status)
  values (cid, 'situacao', format('Serviço contratado registrado a partir da proposta %s (aceite em %s).', q.quote_code,
          coalesce(to_char(r.accepted_on, 'DD/MM/YYYY'), 'data não informada')), 'planejado');
  perform set_config('audita.contract_flow', 'off', true);
  return cid;
end;
$$;

-- Situação do serviço; mantém a demanda alinhada (Em execução → Entregue → Encerrada), sem retroceder nem reabrir
create or replace function audita.change_service_contract_status(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c    audita.service_contracts;
  d    audita.demands;
  note text := nullif(btrim(coalesce(p_note, '')), '');
  dmap text;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into c from audita.service_contracts where id = p_id for update;
  if not found then
    raise exception 'Serviço não encontrado' using errcode = 'P0002';
  end if;
  if p_status not in ('planejado', 'em_execucao', 'suspenso', 'entregue', 'encerrado', 'cancelado') then
    raise exception 'Situação inválida' using errcode = '22023';
  elsif p_status = c.status then
    raise exception 'O serviço já está nesta situação' using errcode = '22023';
  elsif c.status in ('encerrado', 'cancelado') then
    raise exception 'Serviço encerrado ou cancelado não muda de situação' using errcode = '22023';
  elsif p_status in ('suspenso', 'cancelado') and (note is null or length(note) < 5) then
    raise exception 'Informe o motivo' using errcode = '23514';
  end if;
  perform set_config('audita.contract_flow', 'on', true);
  update audita.service_contracts set status = p_status, status_note = note, status_changed_at = now() where id = c.id;
  insert into audita.service_contract_events (contract_id, event_type, description, from_status, to_status)
  values (c.id, 'situacao', coalesce(note, 'Situação alterada.'), c.status, p_status);
  perform set_config('audita.contract_flow', 'off', true);

  dmap := case p_status when 'em_execucao' then 'em_execucao' when 'entregue' then 'entregue' when 'encerrado' then 'encerrada' end;
  select * into d from audita.demands where id = c.demand_id;
  if dmap is not null and d.status <> dmap and d.status not in ('encerrada', 'nao_viavel', 'cancelada')
     and not (d.status = 'entregue' and dmap = 'em_execucao') then
    perform audita.change_demand_status(d.id, dmap, format('Serviço %s: %s.', c.contract_code, coalesce(note, 'situação atualizada')));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- M05 — Ordem de serviço comercial (OS-COM-AAAA-NNNN)
-- ---------------------------------------------------------------------------
create table audita.service_orders (
  id                  uuid primary key default gen_random_uuid(),
  order_code          text not null unique,
  contract_id         uuid not null references audita.service_contracts (id) on delete restrict,
  scheduled_start     date,
  scheduled_end       date,
  time_window         text check (time_window is null or length(time_window) <= 200),
  location            text check (location is null or length(location) <= 500),
  executor_name       text check (executor_name is null or length(executor_name) <= 160),
  executor_role       text check (executor_role is null or length(executor_role) <= 160),
  client_contact      text check (client_contact is null or length(client_contact) <= 300),
  activities          jsonb not null default '[]'::jsonb check (jsonb_typeof(activities) = 'array' and jsonb_array_length(activities) <= 20),
  access_conditions   text check (access_conditions is null or length(access_conditions) <= 2000),
  pending_conditions  text check (pending_conditions is null or length(pending_conditions) <= 2000),
  status              text not null default 'rascunho' check (status in ('rascunho', 'liberada', 'concluida', 'cancelada')),
  released_by_name    text check (released_by_name is null or length(released_by_name) <= 160),
  released_on         date,
  status_note         text check (status_note is null or length(status_note) <= 1000),
  is_test             boolean not null default false,
  created_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid,
  constraint service_orders_period check (scheduled_end is null or scheduled_start is null or scheduled_end >= scheduled_start)
);
comment on table audita.service_orders is 'M05 — OS comercial (AUDDOC010-ANX05). Não substitui a Ordem de Serviço de SST do empregador.';

-- M06 — Alteração de escopo (ALT-AAAA-NNNN)
create table audita.scope_changes (
  id                    uuid primary key default gen_random_uuid(),
  change_code           text not null unique,
  contract_id           uuid not null references audita.service_contracts (id) on delete restrict,
  reason                text not null check (length(btrim(reason)) between 5 and 1000),
  activities_before     text check (activities_before is null or length(activities_before) <= 2000),
  activities_after      text check (activities_after is null or length(activities_after) <= 2000),
  deadline_before       text check (deadline_before is null or length(deadline_before) <= 300),
  deadline_after        text check (deadline_after is null or length(deadline_after) <= 300),
  value_before          numeric(14, 2) check (value_before is null or value_before >= 0),
  value_after           numeric(14, 2) check (value_after is null or value_after >= 0),
  deliverables_before   text check (deliverables_before is null or length(deliverables_before) <= 2000),
  deliverables_after    text check (deliverables_after is null or length(deliverables_after) <= 2000),
  client_approval       text check (client_approval is null or length(client_approval) <= 500),
  validated_by_name     text check (validated_by_name is null or length(validated_by_name) <= 160),
  validated_on          date,
  documents_update      text check (documents_update is null or length(documents_update) <= 500),
  status                text not null default 'rascunho' check (status in ('rascunho', 'aprovada', 'cancelada')),
  status_note           text check (status_note is null or length(status_note) <= 1000),
  is_test               boolean not null default false,
  created_at            timestamptz not null default now(),
  created_by            uuid default auth.uid(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid
);
comment on table audita.scope_changes is 'M06 — Alteração de escopo (AUDDOC010-ANX06); vale só com aceite rastreável do cliente.';

-- Código, imutabilidade após saída do rascunho e mudança de situação só pelas funções
create or replace function audita.contract_children_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  flow boolean := coalesce(current_setting('audita.contract_flow', true), '') = 'on';
  st   text;
begin
  if tg_op = 'INSERT' then
    select status into st from audita.service_contracts where id = new.contract_id;
    if st in ('encerrado', 'cancelado') then
      raise exception 'Serviço encerrado ou cancelado' using errcode = '22023';
    end if;
    if tg_table_name = 'service_orders' then
      new.order_code := 'OS-COM-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-'
        || lpad(audita.allocate_code('service_order', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY'))::text, 4, '0');
    else
      new.change_code := 'ALT-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-'
        || lpad(audita.allocate_code('scope_change', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY'))::text, 4, '0');
    end if;
    new.status := 'rascunho';
    new.status_note := null;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if new.contract_id is distinct from old.contract_id or new.is_test is distinct from old.is_test
     or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by
     or (to_jsonb(new) ->> (case when tg_table_name = 'service_orders' then 'order_code' else 'change_code' end))
        is distinct from (to_jsonb(old) ->> (case when tg_table_name = 'service_orders' then 'order_code' else 'change_code' end)) then
    raise exception 'Campo não pode ser alterado' using errcode = '42501';
  end if;
  if not flow then
    if old.status <> 'rascunho' then
      raise exception 'Somente rascunhos podem ser editados' using errcode = '42501';
    end if;
    if new.status is distinct from old.status or new.status_note is distinct from old.status_note then
      raise exception 'A situação muda somente pelas funções do fluxo' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger service_orders_before_write before insert or update on audita.service_orders
  for each row execute function audita.contract_children_before_write();
create trigger scope_changes_before_write before insert or update on audita.scope_changes
  for each row execute function audita.contract_children_before_write();
create trigger service_orders_set_updated_meta before update on audita.service_orders
  for each row execute function audita.set_updated_meta();
create trigger scope_changes_set_updated_meta before update on audita.scope_changes
  for each row execute function audita.set_updated_meta();
create trigger service_orders_audit after insert or update on audita.service_orders
  for each row execute function audita.log_row_change('id', 'contract_id');
create trigger scope_changes_audit after insert or update on audita.scope_changes
  for each row execute function audita.log_row_change('id', 'contract_id');

-- OS: liberar (exige responsável, data e nenhuma condicionante pendente), concluir ou cancelar
create or replace function audita.change_service_order_status(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o    audita.service_orders;
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into o from audita.service_orders where id = p_id for update;
  if not found then
    raise exception 'OS não encontrada' using errcode = 'P0002';
  end if;
  if p_status = 'liberada' then
    if o.status <> 'rascunho' then
      raise exception 'Somente rascunhos podem ser liberados' using errcode = '22023';
    elsif o.released_by_name is null or o.released_on is null then
      raise exception 'Informe quem libera e a data da liberação' using errcode = '23514';
    elsif nullif(btrim(coalesce(o.pending_conditions, '')), '') is not null and lower(btrim(o.pending_conditions)) not in ('nenhuma', 'nenhum') then
      raise exception 'Há condicionantes pendentes: resolva antes de liberar a execução' using errcode = '23514';
    elsif jsonb_array_length(o.activities) = 0 then
      raise exception 'Informe ao menos uma atividade' using errcode = '23514';
    end if;
  elsif p_status = 'concluida' then
    if o.status <> 'liberada' then
      raise exception 'Somente OS liberadas podem ser concluídas' using errcode = '22023';
    end if;
  elsif p_status = 'cancelada' then
    if o.status in ('concluida', 'cancelada') then
      raise exception 'OS concluída ou cancelada' using errcode = '22023';
    elsif note is null or length(note) < 5 then
      raise exception 'Informe o motivo' using errcode = '23514';
    end if;
  else
    raise exception 'Situação inválida' using errcode = '22023';
  end if;
  perform set_config('audita.contract_flow', 'on', true);
  update audita.service_orders set status = p_status, status_note = note where id = o.id;
  insert into audita.service_contract_events (contract_id, event_type, description)
  values (o.contract_id, 'agenda', format('%s %s%s', o.order_code,
          case p_status when 'liberada' then 'liberada para execução' when 'concluida' then 'concluída' else 'cancelada' end,
          coalesce(': ' || note, '.')));
  perform set_config('audita.contract_flow', 'off', true);
end;
$$;

-- Alteração de escopo: aprovar exige aceite rastreável do cliente e validação AUDITA
create or replace function audita.change_scope_change_status(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a    audita.scope_changes;
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into a from audita.scope_changes where id = p_id for update;
  if not found then
    raise exception 'Alteração não encontrada' using errcode = 'P0002';
  elsif a.status <> 'rascunho' then
    raise exception 'Somente rascunhos mudam de situação' using errcode = '22023';
  end if;
  if p_status = 'aprovada' then
    if nullif(btrim(coalesce(a.client_approval, '')), '') is null then
      raise exception 'Registre o aceite rastreável do cliente (nome/função, data, meio)' using errcode = '23514';
    elsif a.validated_by_name is null or a.validated_on is null then
      raise exception 'Informe a validação da AUDITA (responsável e data)' using errcode = '23514';
    end if;
  elsif p_status = 'cancelada' then
    if note is null or length(note) < 5 then
      raise exception 'Informe o motivo' using errcode = '23514';
    end if;
  else
    raise exception 'Situação inválida' using errcode = '22023';
  end if;
  perform set_config('audita.contract_flow', 'on', true);
  update audita.scope_changes set status = p_status, status_note = note where id = a.id;
  insert into audita.service_contract_events (contract_id, event_type, description)
  values (a.contract_id, 'alteracao_escopo', format('%s %s: %s', a.change_code,
          case p_status when 'aprovada' then 'aprovada' else 'cancelada' end, coalesce(note, a.reason)));
  perform set_config('audita.contract_flow', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Documentos gerados M03–M06 (RF-23/RF-24): arquivos no bucket privado, imutáveis
-- ---------------------------------------------------------------------------
create table audita.contract_documents (
  id               uuid primary key default gen_random_uuid(),
  contract_id      uuid not null references audita.service_contracts (id) on delete restrict,
  model            text not null check (model in ('M03', 'M04', 'M05', 'M06')),
  source_id        uuid,
  reference        text not null check (length(reference) between 3 and 80),
  docx_path        text not null unique check (docx_path like 'contratos/%'),
  pdf_path         text not null unique check (pdf_path like 'contratos/%'),
  docx_sha256      text not null check (docx_sha256 ~ '^[0-9a-f]{64}$'),
  pdf_sha256       text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  missing_fields   text[] not null default '{}',
  watermark        text not null,
  is_test          boolean not null default false,
  generated_at     timestamptz not null default now(),
  generated_by     uuid default auth.uid()
);
comment on table audita.contract_documents is 'M03–M06 gerados (minutas, pendentes de revisão jurídica). Somente inclusão.';
create index contract_documents_contract_idx on audita.contract_documents (contract_id, generated_at desc);

create or replace function audita.contract_documents_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Documentos gerados são imutáveis' using errcode = '42501';
  end if;
  new.generated_by := (select auth.uid());
  new.generated_at := now();
  return new;
end;
$$;
create trigger contract_documents_before_write before insert or update or delete on audita.contract_documents
  for each row execute function audita.contract_documents_before_write();
create trigger contract_documents_audit after insert on audita.contract_documents
  for each row execute function audita.log_row_change('id', 'contract_id');

create policy audita_documentos_insert_contratos on storage.objects for insert to authenticated
  with check (bucket_id = 'audita-documentos' and (select audita.is_admin()) and name like 'contratos/%');

-- ---------------------------------------------------------------------------
-- Caixa gerencial (RF-18; AUDDOC011 §7): só movimentações efetivamente ocorridas
-- ---------------------------------------------------------------------------
create table audita.cash_entries (
  id               uuid primary key default gen_random_uuid(),
  occurred_on      date not null,
  kind             text not null check (kind in ('recebimento', 'pagamento')),
  category         text not null check (category in ('recebimento', 'custo_direto', 'fixo', 'pro_labore', 'tributo', 'outro')),
  amount           numeric(14, 2) not null check (amount > 0),
  description      text not null check (length(btrim(description)) between 3 and 300),
  counterparty     text check (counterparty is null or length(counterparty) <= 200),
  reference        text check (reference is null or length(reference) <= 200),
  client_id        uuid references audita.clients (id) on delete restrict,
  contract_id      uuid references audita.service_contracts (id) on delete restrict,
  status           text not null default 'lancado' check (status in ('lancado', 'estornado')),
  reversal_reason  text check (reversal_reason is null or length(reversal_reason) <= 500),
  reversed_at      timestamptz,
  reversed_by      uuid,
  is_test          boolean not null default false,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  constraint cash_entries_category_kind check ((kind = 'recebimento') = (category = 'recebimento')),
  constraint cash_entries_reversal check ((status = 'estornado') = (reversed_at is not null))
);
comment on table audita.cash_entries is 'Caixa gerencial: recebimentos e pagamentos EFETIVOS (AUDDOC011 §7). Não é contabilidade nem DRE. Correção por estorno.';
create index cash_entries_date_idx on audita.cash_entries (occurred_on);

create or replace function audita.cash_entries_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.occurred_on > (now() at time zone 'America/Sao_Paulo')::date then
      raise exception 'Lance apenas movimentações já ocorridas (data futura não é permitida)' using errcode = '23514';
    end if;
    new.status := 'lancado';
    new.reversal_reason := null;
    new.reversed_at := null;
    new.reversed_by := null;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Lançamentos não são excluídos; use o estorno' using errcode = '42501';
  end if;
  if coalesce(current_setting('audita.cash_flow', true), '') <> 'on'
     or (to_jsonb(new) - 'status' - 'reversal_reason' - 'reversed_at' - 'reversed_by')
        <> (to_jsonb(old) - 'status' - 'reversal_reason' - 'reversed_at' - 'reversed_by') then
    raise exception 'Lançamentos são imutáveis; estorne e lance novamente' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger cash_entries_before_write before insert or update or delete on audita.cash_entries
  for each row execute function audita.cash_entries_before_write();
create trigger cash_entries_audit after insert or update on audita.cash_entries
  for each row execute function audita.log_row_change('id');

create or replace function audita.reverse_cash_entry(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe o motivo do estorno' using errcode = '23514';
  end if;
  perform set_config('audita.cash_flow', 'on', true);
  update audita.cash_entries
     set status = 'estornado', reversal_reason = btrim(p_reason), reversed_at = now(), reversed_by = (select auth.uid())
   where id = p_id and status = 'lancado';
  if not found then
    raise exception 'Lançamento não encontrado ou já estornado' using errcode = '22023';
  end if;
  perform set_config('audita.cash_flow', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS e privilégios — somente o administrador
-- ---------------------------------------------------------------------------
alter table audita.service_contracts enable row level security;
alter table audita.service_contract_events enable row level security;
alter table audita.service_orders enable row level security;
alter table audita.scope_changes enable row level security;
alter table audita.contract_documents enable row level security;
alter table audita.cash_entries enable row level security;

create policy service_contracts_select on audita.service_contracts for select to authenticated using ((select audita.is_admin()));
create policy service_contracts_update on audita.service_contracts for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));
create policy service_contract_events_select on audita.service_contract_events for select to authenticated using ((select audita.is_admin()));
create policy service_contract_events_insert on audita.service_contract_events for insert to authenticated
  with check ((select audita.is_admin()) and event_type in ('agenda', 'execucao', 'evidencia', 'entrega', 'pendencia', 'ocorrencia', 'anotacao'));
create policy service_orders_select on audita.service_orders for select to authenticated using ((select audita.is_admin()));
create policy service_orders_insert on audita.service_orders for insert to authenticated with check ((select audita.is_admin()));
create policy service_orders_update on audita.service_orders for update to authenticated
  using ((select audita.is_admin()) and status = 'rascunho') with check ((select audita.is_admin()));
create policy scope_changes_select on audita.scope_changes for select to authenticated using ((select audita.is_admin()));
create policy scope_changes_insert on audita.scope_changes for insert to authenticated with check ((select audita.is_admin()));
create policy scope_changes_update on audita.scope_changes for update to authenticated
  using ((select audita.is_admin()) and status = 'rascunho') with check ((select audita.is_admin()));
create policy contract_documents_select on audita.contract_documents for select to authenticated using ((select audita.is_admin()));
create policy contract_documents_insert on audita.contract_documents for insert to authenticated with check ((select audita.is_admin()));
create policy cash_entries_select on audita.cash_entries for select to authenticated using ((select audita.is_admin()));
create policy cash_entries_insert on audita.cash_entries for insert to authenticated with check ((select audita.is_admin()));

revoke all on audita.service_contracts, audita.service_contract_events, audita.service_orders, audita.scope_changes,
  audita.contract_documents, audita.cash_entries from public, anon, authenticated;
grant select, update on audita.service_contracts to authenticated;
grant select, insert on audita.service_contract_events, audita.contract_documents, audita.cash_entries to authenticated;
grant select, insert, update on audita.service_orders, audita.scope_changes to authenticated;
grant all on audita.service_contracts, audita.service_contract_events, audita.service_orders, audita.scope_changes,
  audita.contract_documents, audita.cash_entries to service_role;

revoke all on function
  audita.service_contracts_before_write(), audita.service_contract_events_block_changes(), audita.contract_children_before_write(),
  audita.contract_documents_before_write(), audita.cash_entries_before_write(),
  audita.create_service_contract(uuid), audita.change_service_contract_status(uuid, text, text),
  audita.change_service_order_status(uuid, text, text), audita.change_scope_change_status(uuid, text, text),
  audita.reverse_cash_entry(uuid, text)
  from public, anon, authenticated;
grant execute on function
  audita.create_service_contract(uuid), audita.change_service_contract_status(uuid, text, text),
  audita.change_service_order_status(uuid, text, text), audita.change_scope_change_status(uuid, text, text),
  audita.reverse_cash_entry(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
