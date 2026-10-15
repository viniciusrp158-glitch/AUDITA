-- Limpeza dos dados de TESTE do banco audita-dev antes do uso real (autorizada pelo Diretor em 14/10/2026 — "pode limpar
-- antes de publicar"). Executar no SQL Editor do Supabase (projeto audita-dev), na ordem, revisando o resultado de cada etapa.
-- Mantém: catálogo (serviços e histórico inicial), Biblioteca oficial (AUDDOC001–018), modelos técnicos, termo do autocadastro,
-- prazos de guarda, logos aprovados e o usuário mestre real. Nada do Audita PRO/HUB é tocado (somente o schema audita).

-- ETAPA 1 — dados de teste (todas as linhas destas tabelas são de teste; conferido em 15/10/2026: nenhum registro real)
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
-- catálogo: desfaz as liberações fictícias de 09/10/2026 e volta à situação inicial do AUDDOC004
delete from audita.service_status_history where from_status is not null;
update audita.services s set commercial_status = 'nao_liberado', status_basis = h.basis, status_reference = h.reference,
       status_decided_at = h.decided_at, status_decided_by = null
  from audita.service_status_history h where h.service_id = s.id and h.from_status is null;
-- Biblioteca: documentos fictícios AUDDOC9xx
delete from audita.library_revisions where document_id in (select id from audita.library_documents where doc_code ~ '^AUDDOC9');
delete from audita.library_documents where doc_code ~ '^AUDDOC9';
-- Marca: remove o ativo de teste; os logos oficiais aprovados passam a valer no uso real
delete from audita.brand_asset_versions where asset_id in (select id from audita.brand_assets where name like '[TESTE]%');
delete from audita.brand_assets where name like '[TESTE]%';
update audita.brand_asset_versions set is_test = false;
-- Trilha: mantém só o histórico da Biblioteca, da marca e do catálogo
delete from audita.audit_log where entity not in ('library_documents', 'library_revisions', 'brand_assets', 'brand_asset_versions', 'services');
commit;

-- ETAPA 2 — depois de rodar scripts/carga-configuracao-real.mjs: remove os usuários de teste (e-mails @audita.test)
-- begin;
-- delete from audita.app_users where user_id in (select id from auth.users where email like '%@audita.test');
-- delete from auth.users where email like '%@audita.test';
-- commit;

-- Pendente de decisão do Diretor: usuário teste01rosalia@hotmail.com (administrador ativo, não marcado como teste).
-- Arquivos antigos de teste no armazenamento (documentos emitidos, peças e o ativo de marca de teste) ficam sem nenhum
-- registro apontando para eles e inacessíveis pelo sistema; a remoção física é feita pelo painel do Supabase (Storage),
-- pastas: audita-documentos/*, audita-marca/pecas/* e library/<ids dos AUDDOC9xx>.
