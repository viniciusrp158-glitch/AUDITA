/**
 * Níveis de acesso (AUDDOC017 §10). Decisão do Diretor (10/10/2026): modo MAIS RESTRITIVO — entra só o que o
 * AUDDOC017 já define; os pontos em aberto da matriz D7 do caderno de pendências ficam sem acesso até a resposta.
 * Este arquivo só orienta telas e menus: a proteção efetiva está no banco (RLS, gatilhos e funções do fluxo).
 */
export type Role = "admin" | "operador" | "marketing";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  operador: "Operador administrativo",
  marketing: "Marketing",
};

export const ROLE_HINT: Record<Role, string> = {
  admin: "Acesso completo: parâmetros, catálogo, orçamentos, emissão, biblioteca, indicadores e registro de atividades. Criar usuários é só do mestre.",
  operador:
    "Clientes, unidades e contatos; demandas; prepara orçamentos (itens, horas, despesas e conteúdo) sem ver preços e margens. Não conclui revisão, não emite, não registra aceite, não libera serviços nem altera parâmetros (AUDDOC017 §10).",
  marketing: "Rascunhos de comunicação quando o módulo existir (I10). Até lá, apenas a própria conta. Não vê preços nem clientes (AUDDOC017 §10).",
};

/** Menu principal por nível. */
export const NAV_ROLES: Record<string, Role[]> = {
  "/": ["admin"],
  "/clientes": ["admin", "operador"],
  "/demandas": ["admin", "operador"],
  "/orcamentos": ["admin", "operador"],
  "/biblioteca": ["admin"],
  "/comunicacao": ["admin"],
  "/configuracoes": ["admin"],
};

export function homeFor(role: Role): string {
  if (role === "operador") return "/clientes";
  if (role === "marketing") return "/conta";
  return "/";
}

export const OPERATE: Role[] = ["admin", "operador"];
export const ADMIN_ONLY: Role[] = ["admin"];
