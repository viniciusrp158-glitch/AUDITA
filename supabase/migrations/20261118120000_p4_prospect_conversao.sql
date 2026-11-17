-- AUDITA PROSPECT — P4: conversão do lead (AUDDOC020 RP-12, aprovado em 17/11/2026).
-- "Converter lead em cliente (com verificação por CNPJ), abrir demanda e gerar orçamento pelo fluxo atual; mudança
-- automática de etapa ao emitir e ao aceitar a proposta."
--
-- A conversão em si (cadastro do cliente a partir do lead, com verificação de duplicidade por CNPJ, e o vínculo
-- leads.client_id) é feita pela tela, pelo fluxo de cadastro já existente. Aqui fica só a mudança automática de etapa:
--   * orçamento do cliente passa a "emitida"  → leads ativos vinculados ao cliente vão para "Proposta enviada"
--     (exceto os que já estão em proposta, cliente ou perdido);
--   * orçamento do cliente passa a "aceita"   → leads ativos vinculados ao cliente vão para "Cliente conquistado".
-- Cada mudança fica no histórico de etapas do lead (gatilho leads_stage_log), com o motivo.
-- Somente aditiva: uma função e um gatilho novos; nenhuma tabela ou dado existente é alterado por esta migração.

create or replace function audita.leads_follow_quote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return null;
  end if;
  if new.status = 'emitida' then
    update audita.leads
       set stage = 'proposta'
     where client_id = new.client_id
       and status = 'ativo'
       and stage not in ('proposta', 'cliente', 'perdido');
  elsif new.status = 'aceita' then
    update audita.leads
       set stage = 'cliente'
     where client_id = new.client_id
       and status = 'ativo'
       and stage <> 'cliente';
  end if;
  return null;
end;
$$;
comment on function audita.leads_follow_quote() is
  'RP-12: leva os leads vinculados ao cliente para "Proposta enviada" quando o orçamento é emitido e para "Cliente conquistado" quando é aceito.';
revoke all on function audita.leads_follow_quote() from public, anon, authenticated;

create trigger leads_follow_quote after update of status on audita.quotes
  for each row execute function audita.leads_follow_quote();
