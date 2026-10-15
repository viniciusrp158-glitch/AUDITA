-- V1.2 — Aplicação do Caderno de Pendências respondido (14/10/2026).
-- Referências: caderno J1.10 (qualificação do proponente), D5/J1 (textos padrão → nova versão técnica do M01/M02),
-- J4 (prazos de guarda e anonimização — decisão do Diretor: somente anonimizar, nunca excluir), AUDDOC013 §9 e §14.
-- Somente aditiva no schema audita. Nenhuma tabela do Audita PRO/HUB é tocada.

-- ---------------------------------------------------------------------------
-- 1) CPF do titular que assina pela AUDITA (qualificação do M04 — caderno J1.10)
-- ---------------------------------------------------------------------------
alter table audita.institutional_profiles
  add column signatory_cpf text check (signatory_cpf is null or (signatory_cpf ~ '^\d{11}$' and audita.is_valid_cpf(signatory_cpf)));
comment on column audita.institutional_profiles.signatory_cpf is 'CPF do titular que representa a AUDITA (MEI) — usado só na qualificação do contrato M04 (caderno J1.10).';

-- ---------------------------------------------------------------------------
-- 2) Versão técnica v2 dos modelos M01/M02: textos padrão aprovados no caderno (D5, J1.04–J1.09, J1.10, J6.03).
--    Mesma revisão do anexo oficial (Rev.00, mesmo SHA-256); a v1 fica preservada como substituída (RF-21).
-- ---------------------------------------------------------------------------
alter table audita.document_templates disable trigger document_templates_block_changes;
update audita.document_templates set status = 'substituido'
 where template_code in ('AUDDOC010-ANX01', 'AUDDOC010-ANX02') and technical_version = 'v1' and status = 'vigente';
alter table audita.document_templates enable trigger document_templates_block_changes;

insert into audita.document_templates (template_code, model_code, title, document_revision, technical_version, source_file_name, source_sha256, notes) values
  ('AUDDOC010-ANX01', 'M01', 'Proposta comercial integrada (orçamento + aceite)', 'Rev.00', 'v2',
   'AUDDOC010-ANX01_Proposta_Comercial_Integrada_Rev00.docx', 'a3ee2196337de041f1fb42123ddea8153cd63ae93ca90252e83b38159ea551ab',
   'Caderno de pendências (14/10/2026): qualificação do proponente MEI (J1.10), condições gerais aprovadas — mora, reajuste, rescisão, alcance e limitações, foro (J1.05–J1.09, J6.03) — e textos padrão pré-preenchidos (D5, J1.04).'),
  ('AUDDOC010-ANX02', 'M02', 'Orçamento simplificado', 'Rev.00', 'v2',
   'AUDDOC010-ANX02_Orcamento_Simplificado_Rev00.docx', '92775de31feb4c82727a7ef8e38137c1aba3e58d8321ba2e4ecd5c98d416fd40',
   'Caderno de pendências (14/10/2026): identificação do emitente (J1.10) e texto curto de alcance e limitações (J6.03).');

-- ---------------------------------------------------------------------------
-- 3) Prazos de guarda aprovados (caderno J4) — consulta no sistema; mudança só por nova migração
-- ---------------------------------------------------------------------------
create table audita.retention_rules (
  code            text primary key check (code ~ '^RET-\d{2}$'),
  category        text not null,
  retention       text not null,
  basis           text not null,
  disposal        text not null,
  automatic       boolean not null default false,
  approved_on     date not null,
  approved_by     text not null,
  source          text not null
);
comment on table audita.retention_rules is 'Prazos de guarda e condição de anonimização por categoria (caderno J4; AUDDOC013 §9, §14). Decisão do Diretor: somente anonimizar, nunca excluir; nada automático.';

insert into audita.retention_rules (code, category, retention, basis, disposal, approved_on, approved_by, source) values
  ('RET-01', 'Cadastro de clientes, unidades e contatos',
   'Ativos: enquanto durar a relação. Inativos com proposta ou contrato: 10 anos após o encerramento do último serviço ou proposta. Inativos sem vínculo: 5 anos após a inativação.',
   'CC art. 205; LGPD art. 7º, VI, e art. 16, I.',
   'Anonimizar os dados pessoais dos contatos (nome, e-mail, telefone). Razão social e CNPJ permanecem.', '2026-10-14', 'Vinicius Rocha Pereira — Diretor', 'Caderno J4'),
  ('RET-02', 'Solicitações de autocadastro recusadas', '6 meses após a recusa.',
   'LGPD art. 6º, III, e art. 15, I.',
   'Anonimizar os dados do solicitante; manter só o registro da solicitação, data e motivo.', '2026-10-14', 'Vinicius Rocha Pereira — Diretor', 'Caderno J4'),
  ('RET-03', 'Convites de autocadastro expirados', '90 dias após a expiração.',
   'LGPD art. 15, I.',
   'Anonimizar o destinatário e invalidar o token; o registro do envio continua na trilha.', '2026-10-14', 'Vinicius Rocha Pereira — Diretor', 'Caderno J4'),
  ('RET-04', 'Demandas e linha do tempo',
   'Que viraram proposta ou contrato: mesmo prazo da proposta/contrato. Perdidas ou canceladas: 5 anos após o encerramento.',
   'CDC art. 27; CC art. 206, §3º, V.',
   'Anonimizar os dados pessoais do solicitante; histórico mantido sem identificação.', '2026-10-14', 'Vinicius Rocha Pereira — Diretor', 'Caderno J4'),
  ('RET-05', 'Propostas, revisões congeladas e aceites/recusas',
   'Aceitas: 10 anos após o encerramento do serviço. Recusadas ou expiradas: 5 anos após a decisão.',
   'CC art. 205 e art. 206, §5º, I. Revisões imutáveis durante todo o prazo.',
   'Anonimizar as pessoas físicas citadas (responsável pelo aceite e contatos).', '2026-10-14', 'Vinicius Rocha Pereira — Diretor', 'Caderno J4'),
  ('RET-06', 'Documentos emitidos (PDF/DOCX) e downloads',
   'Mesmo prazo do registro de origem; downloads, o da trilha. Documentos fiscais: 5 anos do 1º dia do ano seguinte.',
   'CTN art. 173, I, e art. 195, parágrafo único.',
   'Anonimizar as pessoas físicas citadas; manter código, data e hash da emissão.', '2026-10-14', 'Vinicius Rocha Pereira — Diretor', 'Caderno J4'),
  ('RET-07', 'Trilha de auditoria (log de ações)',
   '5 anos a partir do evento, ou enquanto o registro relacionado estiver guardado (o que for maior). Mínimo de 6 meses para acessos.',
   'LGPD art. 37 e art. 46; Lei 12.965/2014, art. 15 (referência).',
   'Anonimizar os dados pessoais dos eventos vencidos, em lote anual, registrando a própria anonimização.', '2026-10-14', 'Vinicius Rocha Pereira — Diretor', 'Caderno J4'),
  ('RET-08', 'Documentos da biblioteca (revisões substituídas)', 'Permanente, marcados como substituídos.',
   'Documentos institucionais, sem dados pessoais; necessários para reproduzir documentos emitidos.',
   'Nenhum.', '2026-10-14', 'Vinicius Rocha Pereira — Diretor', 'Caderno J4');

alter table audita.retention_rules enable row level security;
create policy retention_rules_select on audita.retention_rules for select to authenticated using ((select audita.is_admin()));
grant select on audita.retention_rules to authenticated;
grant all on audita.retention_rules to service_role;

-- ---------------------------------------------------------------------------
-- 4) Anonimização controlada (RET-02 e RET-03 têm prazos curtos; as demais categorias entram quando vencerem)
--    Somente o usuário mestre, um registro por vez, com motivo; nunca automática; registrada na trilha.
-- ---------------------------------------------------------------------------
alter table audita.client_registration_requests add column anonymized_at timestamptz;
alter table audita.client_invites add column anonymized_at timestamptz;

-- Trilha: durante a anonimização, a alteração é registrada sem repetir os dados pessoais
create or replace function audita.log_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  diff    jsonb := '{}'::jsonb;
  k       text;
  pk      text := tg_argv[0];
  parent  text := case when tg_nargs > 1 then tg_argv[1] end;
  ignored text[] := array['updated_at', 'updated_by', 'search_text'];
begin
  if tg_op = 'UPDATE' and coalesce(current_setting('audita.anonymize', true), '') = 'on' then
    diff := jsonb_build_object('anonimizado', true);
  elsif tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(new_row) loop
      if not (k = any (ignored)) and (old_row -> k) is distinct from (new_row -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_object('de', old_row -> k, 'para', new_row -> k));
      end if;
    end loop;
    if diff = '{}'::jsonb then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    diff := new_row - 'created_at' - 'updated_at' - 'updated_by' - 'search_text';
  else
    diff := old_row;
  end if;

  insert into audita.audit_log (actor_user_id, action, entity, entity_id, parent_entity_id, summary, origin)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(new_row ->> pk, old_row ->> pk),
    case when parent is not null then coalesce(new_row ->> parent, old_row ->> parent) end,
    diff,
    'db'
  );
  return coalesce(new, old);
end;
$$;

alter table audita.audit_log drop constraint audit_log_action_check;
alter table audita.audit_log add constraint audit_log_action_check
  check (action in ('insert', 'update', 'delete', 'login', 'logout', 'access_denied', 'download', 'anonymize'));

-- Trilha imutável, exceto a substituição do resumo por {"anonimizado": true} dentro da rotina de anonimização
create or replace function audita.audit_log_block_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- (testes aninhados: o gatilho também protege outras tabelas, que não têm a coluna "summary")
  if tg_op = 'UPDATE' and tg_table_name = 'audit_log' and coalesce(current_setting('audita.anonymize', true), '') = 'on' then
    if (to_jsonb(new) -> 'summary') = jsonb_build_object('anonimizado', true)
       and (to_jsonb(new) - 'summary') = (to_jsonb(old) - 'summary') then
      return new;
    end if;
  end if;
  raise exception 'A trilha de auditoria não pode ser alterada ou excluída'
    using errcode = '42501';
end;
$$;

create or replace function audita.requests_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if coalesce(current_setting('audita.anonymize', true), '') = 'on' then
      return new;
    end if;
    if old.status <> 'pendente' then
      raise exception 'Solicitação já analisada não pode ser alterada' using errcode = '42501';
    end if;
    if new.invite_id is distinct from old.invite_id or new.payload is distinct from old.payload
       or new.terms_version is distinct from old.terms_version or new.terms_accepted_at is distinct from old.terms_accepted_at
       or new.submitted_at is distinct from old.submitted_at then
      raise exception 'Os dados enviados pelo cliente são preservados como recebidos' using errcode = '42501';
    end if;
    if new.status <> 'pendente' then
      new.reviewed_at := now();
      new.reviewed_by := (select auth.uid());
    end if;
  end if;
  return new;
end;
$$;

create or replace function audita.client_invites_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := (select auth.uid());
    new.expires_at := least(coalesce(new.expires_at, now() + interval '24 hours'), now() + interval '24 hours');
    new.used_at := null;
    new.cancelled_at := null;
  else
    if coalesce(current_setting('audita.anonymize', true), '') = 'on' then
      return new;
    end if;
    if new.token_hash is distinct from old.token_hash or new.created_at is distinct from old.created_at
       or new.created_by is distinct from old.created_by or new.expires_at is distinct from old.expires_at then
      raise exception 'Dados do convite não podem ser alterados' using errcode = '42501';
    end if;
    if new.used_at is distinct from old.used_at
       and not (old.used_at is null and coalesce(current_setting('audita.allow_invite_use', true), '') = 'on') then
      raise exception 'O uso do convite é registrado apenas pelo envio do formulário' using errcode = '42501';
    end if;
    if old.used_at is not null and new.cancelled_at is distinct from old.cancelled_at then
      raise exception 'Convite já utilizado não pode ser cancelado' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Registros cujo prazo de guarda venceu (o mestre decide, um a um)
create or replace function audita.anonymization_candidates()
returns table (kind text, record_id uuid, rule_code text, label text, due_since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select 'solicitacao_recusada', r.id, 'RET-02',
         coalesce(r.payload #>> '{cliente,razao_social}', r.payload #>> '{cliente,nome}', 'Solicitação de autocadastro'),
         r.reviewed_at + interval '6 months'
    from audita.client_registration_requests r
   where (select audita.is_master()) and r.status = 'recusada' and r.anonymized_at is null
     and r.reviewed_at + interval '6 months' <= now()
  union all
  select 'convite_expirado', i.id, 'RET-03', 'Convite para ' || i.recipient, i.expires_at + interval '90 days'
    from audita.client_invites i
   where (select audita.is_master()) and i.used_at is null and i.anonymized_at is null
     and i.expires_at + interval '90 days' <= now()
   order by 5;
$$;

create or replace function audita.anonymize_record(p_kind text, p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  v_inv uuid;
begin
  if not (select audita.is_master()) then
    raise exception 'Somente o usuário mestre anonimiza registros' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 5 then
    raise exception 'Informe o motivo da anonimização (mínimo de 5 caracteres)' using errcode = '22023';
  end if;
  perform set_config('audita.anonymize', 'on', true);
  if p_kind = 'solicitacao_recusada' then
    update audita.client_registration_requests
       set payload = jsonb_build_object('anonimizado', true, 'regra', 'RET-02'), anonymized_at = now()
     where id = p_id and status = 'recusada' and anonymized_at is null and reviewed_at + interval '6 months' <= now()
    returning invite_id into v_inv;
    get diagnostics n = row_count;
    if n = 1 then
      update audita.audit_log set summary = jsonb_build_object('anonimizado', true)
       where entity = 'client_registration_requests' and entity_id = p_id::text;
    end if;
  elsif p_kind = 'convite_expirado' then
    update audita.client_invites
       set recipient = 'anonimizado', note = null, anonymized_at = now(),
           token_hash = encode(extensions.digest(gen_random_uuid()::text || clock_timestamp()::text, 'sha256'), 'hex')
     where id = p_id and used_at is null and anonymized_at is null and expires_at + interval '90 days' <= now();
    get diagnostics n = row_count;
    if n = 1 then
      update audita.audit_log set summary = jsonb_build_object('anonimizado', true)
       where entity = 'client_invites' and entity_id = p_id::text;
    end if;
  else
    raise exception 'Tipo de registro não previsto' using errcode = '22023';
  end if;
  perform set_config('audita.anonymize', 'off', true);
  if n <> 1 then
    raise exception 'Registro não encontrado ou ainda dentro do prazo de guarda' using errcode = '22023';
  end if;
  insert into audita.audit_log (actor_user_id, action, entity, entity_id, summary, origin)
  values ((select auth.uid()), 'anonymize', case when p_kind = 'convite_expirado' then 'client_invites' else 'client_registration_requests' end,
          p_id::text, jsonb_build_object('regra', case when p_kind = 'convite_expirado' then 'RET-03' else 'RET-02' end, 'motivo', btrim(p_reason)), 'app');
end;
$$;

revoke all on function audita.anonymization_candidates(), audita.anonymize_record(text, uuid, text) from public, anon;
grant execute on function audita.anonymization_candidates(), audita.anonymize_record(text, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Verificação em duas etapas (caderno I3.01): quem ativou o MFA só acessa os dados com a sessão verificada (aal2).
--    Vale no banco (RLS), não só na tela. Quem não ativou continua como hoje.
-- ---------------------------------------------------------------------------
create or replace function audita.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified');
$$;

create or replace function audita.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from audita.app_users u
  where u.user_id = (select auth.uid())
    and u.status = 'active'
    and audita.mfa_ok();
$$;

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
  ) and audita.mfa_ok();
$$;

revoke all on function audita.mfa_ok() from public, anon;
grant execute on function audita.mfa_ok() to authenticated;

notify pgrst, 'reload schema';
