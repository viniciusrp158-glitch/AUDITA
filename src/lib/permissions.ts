/**
 * Níveis de acesso (AUDDOC017 §10; decisões do Diretor de 10/10/2026). Só orienta telas e menus:
 * a proteção efetiva está nas políticas do banco (RLS) e nas funções do fluxo.
 */
export type Role = "admin" | "operador" | "marketing";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  operador: "Operador administrativo",
  marketing: "Marketing",
};

export const ROLE_HINT: Record<Role, string> = {
  admin: "Acesso completo, inclusive parâmetros, catálogo, biblioteca e registro de atividades. Não cria usuários (só o mestre).",
  operador:
    "Clientes, demandas e orçamentos completos (preços, emissão, aceite e autorização de desconto); consulta a biblioteca e vê os indicadores. Não libera serviços, não altera parâmetros nem publica documentos.",
  marketing: "Até o módulo de comunicação (I10): apenas consulta e baixa documentos publicados da biblioteca. Não vê preços nem clientes.",
};

/** Menu principal por nível. */
export const NAV_ROLES: Record<string, Role[]> = {
  "/": ["admin", "operador"],
  "/clientes": ["admin", "operador"],
  "/demandas": ["admin", "operador"],
  "/orcamentos": ["admin", "operador"],
  "/biblioteca": ["admin", "operador", "marketing"],
  "/comunicacao": ["admin"],
  "/configuracoes": ["admin"],
};

export function homeFor(role: Role): string {
  return role === "marketing" ? "/biblioteca" : "/";
}

export const OPERATE: Role[] = ["admin", "operador"];
export const ADMIN_ONLY: Role[] = ["admin"];
