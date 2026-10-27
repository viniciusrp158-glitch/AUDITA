/**
 * Escopo do serviço do catálogo (AUDDOC004/005) em texto corrido, para pré-preencher a demanda e o item da cotação
 * quando o serviço ou treinamento é escolhido. Módulo sem dependências de servidor (usado nos formulários).
 */
export type ServiceScope = {
  service_code: string;
  name: string;
  scope_preliminary: string | null;
  scope_limits: string | null;
  modality: string | null;
  evidence_required: string | null;
  legal_reference: string | null;
};

/** Colunas que o texto usa (para os selects das opções). */
export const SCOPE_COLUMNS = "scope_preliminary, scope_limits, modality, evidence_required, legal_reference";

export function serviceScopeText(s: ServiceScope): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  const add = (label: string, v: string | null) => {
    const t = (v ?? "").trim();
    // Na carga da AUDDOC004 alguns campos repetem o mesmo texto: mostra uma vez só
    if (!t || seen.has(t)) return;
    seen.add(t);
    lines.push(`${label}: ${t}`);
  };
  add("Escopo preliminar", s.scope_preliminary);
  add("Limites e condições", s.scope_limits);
  add("Modalidade", s.modality);
  add("Evidências e recursos", s.evidence_required);
  add("Referência legal", s.legal_reference);
  if (!lines.length) return "";
  return [`${s.service_code} — ${s.name} (catálogo AUDDOC004/005)`, ...lines].join("\n");
}
