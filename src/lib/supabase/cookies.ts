import { BASE_PATH } from "@/lib/base-path";

/**
 * Sessão da equipe (auditoria de segurança, 25/10/2026): o site institucional (/) carrega script de terceiros (VLibras)
 * na mesma origem audita.seg.br. O cookie da sessão passa a ser HttpOnly (nenhum script lê o token), Secure em produção,
 * SameSite=Lax e restrito a /empresa. Nenhum código da equipe no navegador usa a sessão (o envio de arquivos usa link
 * assinado, sem sessão: browser-upload.ts).
 * Nome próprio ("audita-equipe", como "audita-aluno" na área do aluno): com o mesmo nome, o cookie antigo
 * (sb-<ref>-auth-token, path=/) teria precedência sobre o novo; ele é apagado pelo middleware e a equipe entra de novo
 * uma única vez.
 */
export const STAFF_COOKIE = {
  name: "audita-equipe",
  path: BASE_PATH,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
};

/** Cookies de sessão do formato antigo (padrão do @supabase/ssr, legíveis por script, em path=/). */
export const LEGACY_SESSION_COOKIE = /^sb-[A-Za-z0-9_-]+-auth-token(?:-code-verifier)?(?:\.\d+)?$/;
