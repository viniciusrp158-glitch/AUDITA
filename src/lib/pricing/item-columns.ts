/**
 * Colunas do item da cotação (audita.quote_items) visíveis por nível de acesso (auditoria de segurança, 25/10/2026).
 * O banco só deixa "authenticated" ler as colunas que o operador prepara (privilégio de coluna, migração
 * seg1_precos_do_item); contingência, margem e desconto vêm da função audita.quote_item_pricing, só do administrador.
 * Sem "server-only": também usado pelos testes de integração.
 */

/** Colunas que operador e administrador leem direto da tabela. */
export const ITEM_BASE_COLS =
  "id, position, service_id, description, periodicity, quantity_ref, hours_preparation, hours_execution, hours_delivery, hours_followup, hours_travel, cost_travel, cost_materials, cost_external, cost_other, scope_notes";

/** Ajustes de preço do item (só administrador), como devolvidos por audita.quote_item_pricing. */
export type ItemPricingRow = {
  item_id: string;
  contingency: string | number | null;
  margin: string | number | null;
  discount: string | number | null;
  discount_reason: string | null;
  discount_authorized: boolean;
  discount_authorized_at: string | null;
  discount_authorized_by: string | null;
};

export type ItemPricingFields = Omit<ItemPricingRow, "item_id">;

const EMPTY: ItemPricingFields = {
  contingency: null,
  margin: null,
  discount: null,
  discount_reason: null,
  discount_authorized: false,
  discount_authorized_at: null,
  discount_authorized_by: null,
};

/**
 * Junta aos itens os ajustes de preço. Sem `pricing` (operador), os campos ficam vazios: nada de margem, contingência ou
 * desconto chega à tela nem ao navegador de quem não é administrador.
 */
export function withItemPricing<T extends { id: string }>(items: T[], pricing: ItemPricingRow[] | null | undefined): (T & ItemPricingFields)[] {
  const byId = new Map((pricing ?? []).map((p) => [p.item_id, p]));
  return items.map((it) => {
    const p = byId.get(it.id);
    if (!p) return { ...it, ...EMPTY };
    const { item_id: _ignored, ...fields } = p;
    void _ignored;
    return { ...it, ...fields };
  });
}
