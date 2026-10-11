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
  marketing:
    "Comunicação: campanhas e peças (briefing e rascunhos), envio para revisão e exportação do que o administrador aprovou; vê só os logos oficiais aprovados. Não aprova peças, não envia logos e não vê preços nem clientes (AUDDOC017 §10).",
};

/** Níveis oferecidos ao criar/alterar usuários. "mestre" = mestre adicional: Administrador + marca de mestre
 *  (mesmas permissões do mestre titular, inclusive gerenciar usuários) — pedido do Diretor em 10/10/2026. */
export type AccessLevel = "mestre" | Role;
export const LEVEL_LABEL: Record<AccessLevel, string> = { mestre: "Usuário mestre", ...ROLE_LABEL };
export const LEVEL_HINT: Record<AccessLevel, string> = {
  mestre:
    "Mesmas permissões e acessos do usuário mestre: tudo o que o Administrador faz e também cria usuários e define níveis. Cada pessoa com o próprio login.",
  ...ROLE_HINT,
};
export const LEVELS: AccessLevel[] = ["mestre", "admin", "operador", "marketing"];

/** Menu principal por nível. */
export const NAV_ROLES: Record<string, Role[]> = {
  "/": ["admin"],
  "/clientes": ["admin", "operador"],
  "/demandas": ["admin", "operador"],
  "/orcamentos": ["admin", "operador"],
  "/biblioteca": ["admin"],
  "/comunicacao": ["admin", "marketing"],
  "/configuracoes": ["admin"],
};

export function homeFor(role: Role): string {
  if (role === "operador") return "/clientes";
  if (role === "marketing") return "/comunicacao";
  return "/";
}

export const OPERATE: Role[] = ["admin", "operador"];
/** Comunicação (I10): administrador e marketing; só o administrador aprova peças e logos. */
export const COMMUNICATE: Role[] = ["admin", "marketing"];
export const ADMIN_ONLY: Role[] = ["admin"];
