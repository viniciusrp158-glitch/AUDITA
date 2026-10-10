import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { homeFor, type Role } from "@/lib/permissions";

export type { Role } from "@/lib/permissions";

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  role: Role;
  isMaster: boolean;
  theme: "claro" | "escuro" | null;
  mustChangePassword: boolean;
};

/**
 * Usuário autenticado E autorizado no AUDITA (lista audita.app_users, situação ativa).
 * Estar logado no Supabase não basta: usuários de outros sistemas não têm acesso.
 * O nível (administrador, operador, marketing) é aplicado no banco (RLS); aqui só orienta telas e menus.
 */
export const getAppUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("app_users")
    .select("full_name, job_title, role, status, is_master, is_comaster, is_test, is_test_master, theme, must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data || data.status !== "active" || !["admin", "operador", "marketing"].includes(data.role)) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    fullName: data.full_name,
    jobTitle: data.job_title,
    role: data.role as Role,
    isMaster: Boolean(data.is_master || data.is_comaster || (data.is_test && data.is_test_master)),
    theme: data.theme,
    mustChangePassword: data.must_change_password,
  };
});

/**
 * Use no topo de páginas e ações protegidas. `roles` restringe o acesso (padrão: qualquer nível ativo).
 * Quem não tem o nível é levado à sua página inicial com aviso — a proteção real continua no banco.
 */
export async function requireAppUser(roles?: Role[]): Promise<AppUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?motivo=sessao");

  const appUser = await getAppUser();
  if (!appUser) redirect("/sem-acesso");
  if (appUser.mustChangePassword) redirect("/atualizar-senha?primeiro=1");
  if (roles && !roles.includes(appUser.role)) redirect(`${homeFor(appUser.role)}?sem_permissao=1`);
  return appUser;
}
