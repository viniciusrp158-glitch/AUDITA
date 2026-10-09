import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin";
};

/**
 * Usuário autenticado E autorizado no AUDITA (lista audita.app_users).
 * Estar logado no Supabase não basta: usuários de outros sistemas não têm acesso.
 */
export const getAppUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("app_users")
    .select("full_name, role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data || data.status !== "active" || data.role !== "admin") return null;
  return { id: user.id, email: user.email ?? "", fullName: data.full_name, role: "admin" };
});

/** Use no topo de páginas protegidas. */
export async function requireAppUser(): Promise<AppUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?motivo=sessao");

  const appUser = await getAppUser();
  if (!appUser) redirect("/sem-acesso");
  return appUser;
}
