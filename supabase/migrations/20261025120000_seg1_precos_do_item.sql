-- AUDITA — Correções da auditoria de segurança (25/10/2026), achado 1: o operador lia margem, contingência e desconto
-- dos itens da cotação (audita.quote_items) direto pela API, embora a regra do AUDDOC017 §10 (i9_1_permissoes_restritivas)
-- seja "o operador NÃO vê preços, custos de hora nem margens".
--
-- A RLS é por linha e não esconde colunas. Correção no banco, por privilégio de coluna:
--   * "authenticated" deixa de ter SELECT na tabela inteira e passa a ter SELECT só nas colunas que o operador prepara
--     (serviço, descrição, horas, despesas e escopo). Inserir, alterar e remover continuam como estavam (a gravação de
--     contingência, margem e desconto pelo operador já é barrada pelo gatilho pricing_admin_guard);
--   * o administrador lê os ajustes de preço do item pela função audita.quote_item_pricing (SECURITY DEFINER, só admin).
-- Nenhum dado é alterado. As funções do fluxo que leem estas colunas (revisão, emissão) já são SECURITY DEFINER.

revoke select on audita.quote_items from authenticated;
grant select (id, quote_id, position, service_id, description, periodicity, quantity_ref,
              hours_preparation, hours_execution, hours_delivery, hours_followup, hours_travel,
              cost_travel, cost_materials, cost_external, cost_other, scope_notes,
              created_at, created_by, updated_at, updated_by)
  on audita.quote_items to authenticated;

-- Ajustes de preço dos itens de uma cotação: somente o administrador (com MFA, quando ativado)
create or replace function audita.quote_item_pricing(p_quote_id uuid)
returns table (
  item_id uuid, contingency numeric, margin numeric, discount numeric, discount_reason text,
  discount_authorized boolean, discount_authorized_at timestamptz, discount_authorized_by uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not audita.is_admin() then
    raise exception 'Somente o administrador vê contingência, margem e desconto do item.' using errcode = '42501';
  end if;
  return query
  select i.id, i.contingency, i.margin, i.discount, i.discount_reason, i.discount_authorized, i.discount_authorized_at, i.discount_authorized_by
    from audita.quote_items i
   where i.quote_id = p_quote_id
   order by i.position, i.created_at;
end;
$$;

revoke all on function audita.quote_item_pricing(uuid) from public, anon, authenticated;
grant execute on function audita.quote_item_pricing(uuid) to authenticated;
grant all on function audita.quote_item_pricing(uuid) to service_role;

notify pgrst, 'reload schema';
