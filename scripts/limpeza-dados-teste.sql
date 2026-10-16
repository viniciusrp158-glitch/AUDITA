-- Limpeza dos dados de TESTE do banco audita-dev antes do uso real (autorizada pelo Diretor em 14/10/2026 — "pode limpar
-- antes de publicar"). Executar no SQL Editor do Supabase (projeto audita-dev), na ordem, revisando o resultado de cada etapa.
-- Mantém: catálogo (serviços e histórico inicial), Biblioteca oficial (AUDDOC001–018), modelos técnicos, termo do autocadastro,
-- prazos de guarda, logos aprovados e o usuário mestre real. Nada do Audita PRO/HUB é tocado (somente o schema audita).
-- Revisão de 15/10/2026: corrigida a coluna do ativo de marca (title, não name); a trilha guarda só o que continua existindo;
-- etapa 2 segue as decisões do Diretor de 15/10/2026 (remover teste01rosalia; manter a conta técnica de teste inativa).

-- ETAPA 1 — dados de teste (todas as linhas destas tabelas são de teste; conferido em 15/10/2026: nenhum registro real)
-- Tudo numa transação: se qualquer comando falhar, nada é apagado.
begin;
set local session_replication_role = replica;  -- os bloqueios de imutabilidade valem para o uso normal, não para esta limpeza
delete from audita.cash_entries;
delete from audita.comm_exports;
delete from audita.comm_piece_versions;
delete from audita.comm_pieces;
delete from audita.comm_campaigns;
delete from audita.contract_documents;
delete from audita.scope_changes;
delete from audita.service_orders;
delete from audita.service_contract_events;
delete from audita.service_contracts;
delete from audita.generated_documents;
delete from audita.quote_items;
delete from audita.quote_revisions;
delete from audita.quotes;
delete from audita.demand_events;
delete from audita.demands;
delete from audita.client_contacts;
delete from audita.client_units;
delete from audita.client_registration_requests;
delete from audita.client_invites;
delete from audita.clients;
delete from audita.pricing_parameter_sets;
delete from audita.institutional_profiles;
delete from audita.code_counters;          -- os códigos reais começam do 1 (CLI-0001, DEM-2026-0001…)
-- catálogo: desfaz as liberações fictícias e volta à situação inicial do AUDDOC004
delete from audita.service_status_history where from_status is not null;
update audita.services s set commercial_status = 'nao_liberado', status_basis = h.basis, status_reference = h.reference,
       status_decided_at = h.decided_at, status_decided_by = null
  from audita.service_status_history h where h.service_id = s.id and h.from_status is null;
-- Biblioteca: documentos fictícios AUDDOC9xx
delete from audita.library_revisions where document_id in (select id from audita.library_documents where doc_code ~ '^AUDDOC9');
delete from audita.library_documents where doc_code ~ '^AUDDOC9';
-- Marca: remove o ativo de teste; os logos oficiais aprovados passam a valer no uso real
delete from audita.brand_asset_versions where asset_id in (select id from audita.brand_assets where title like '[TESTE]%');
delete from audita.brand_assets where title like '[TESTE]%';
update audita.brand_asset_versions set is_test = false;
-- Trilha: mantém só o histórico do que continua existindo — inclusão dos 45 serviços, documentos e revisões oficiais da
-- Biblioteca e logos oficiais. Saem as alterações fictícias do catálogo e os downloads feitos pelas contas de teste.
delete from audita.audit_log a where not (
  (
    (a.entity = 'library_documents' and a.entity_id in (select id::text from audita.library_documents))
    or (a.entity = 'library_revisions' and a.entity_id in (select id::text from audita.library_revisions))
    or (a.entity = 'brand_assets' and a.entity_id in (select id::text from audita.brand_assets))
    or (a.entity = 'brand_asset_versions' and a.entity_id in (select id::text from audita.brand_asset_versions))
    or (a.entity = 'services' and a.action = 'insert')
  )
  and not (a.action = 'download' and a.actor_user_id in (select id from auth.users where email like '%@audita.test'))
);
commit;

-- Conferência depois da etapa 1 (deve mostrar 0 nas tabelas apagadas, 0 serviços liberados de 45, 36 documentos e
-- 37 revisões oficiais, 3 logos e 168 linhas de trilha)
select 'clientes' item, count(*) from audita.clients union all
select 'demandas', count(*) from audita.demands union all
select 'propostas', count(*) from audita.quotes union all
select 'parâmetros', count(*) from audita.pricing_parameter_sets union all
select 'serviços liberados', count(*) from audita.services where commercial_status <> 'nao_liberado' union all
select 'serviços', count(*) from audita.services union all
select 'documentos da Biblioteca', count(*) from audita.library_documents union all
select 'revisões da Biblioteca', count(*) from audita.library_revisions union all
select 'logos', count(*) from audita.brand_assets union all
select 'trilha de auditoria', count(*) from audita.audit_log;

-- ETAPA 2 — usuários (decisões do Diretor de 15/10/2026). Rodar depois da carga real (scripts/carga-configuracao-real.mjs),
-- que deve ser feita com o login do Diretor.
-- begin;
-- -- a) conta técnica de teste: fica INATIVA e bloqueada (não é apagada, porque registrou a Biblioteca oficial e os logos)
-- -- (a marca de mestre de teste só vale para conta ativa — regra app_users_test_master_is_test —, por isso sai junto)
-- update audita.app_users set status = 'inactive', is_test_master = false, updated_at = now()
--   where user_id in (select id from auth.users where email = 'admin.teste@audita.test');
-- update auth.users set banned_until = '2999-12-31' where email = 'admin.teste@audita.test';
-- -- b) demais contas de teste (e-mails @audita.test)
-- delete from audita.app_users where user_id in (select id from auth.users where email like '%@audita.test' and email <> 'admin.teste@audita.test');
-- delete from auth.users where email like '%@audita.test' and email <> 'admin.teste@audita.test';
-- -- c) teste01rosalia@hotmail.com — remoção decidida pelo Diretor (criada em 10/10/2026, sem registros mantidos)
-- delete from audita.app_users where user_id in (select id from auth.users where email = 'teste01rosalia@hotmail.com');
-- delete from auth.users where email = 'teste01rosalia@hotmail.com';
-- -- conferência: deve sobrar o Diretor (mestre, ativo) e a conta técnica inativa
-- select u.email, a.role, a.status, a.is_master from auth.users u left join audita.app_users a on a.user_id = u.id;
-- commit;

-- Arquivos antigos de teste no armazenamento (documentos emitidos, contratos, Biblioteca AUDDOC9xx e o ativo de marca de
-- teste) ficam sem nenhum registro apontando para eles e inacessíveis pelo sistema. O Supabase não permite apagá-los por
-- SQL; a remoção é feita pelo painel (Storage): audita-documentos/quotes/*, audita-documentos/contratos/* e, em
-- audita-biblioteca/library/, as pastas sem revisão oficial. Guarde a minuta AUDPRO001 (pasta do AUDDOC001).
