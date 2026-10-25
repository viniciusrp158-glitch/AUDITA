/**
 * Sessão do aluno separada da sessão da equipe: cookie próprio e restrito a /treinamentos.
 * Entrar ou sair da área do aluno não afeta quem está logado no sistema (/empresa), e vice-versa.
 * HttpOnly (auditoria de segurança, 25/10/2026): nenhum script da página lê o token; a área do aluno não tem cliente
 * Supabase no navegador (tudo passa pelo servidor).
 */
export const STUDENT_COOKIE = {
  name: "audita-aluno",
  path: "/treinamentos",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
};
