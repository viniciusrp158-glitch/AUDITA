"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string };

const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Mensagem genérica: não revela se o e-mail existe.
    return { error: "E-mail ou senha inválidos." };
  }

  const { data: role } = await supabase.rpc("current_app_role");
  if (role !== "admin") {
    await supabase.rpc("log_access_event", { event: "access_denied" });
    await supabase.auth.signOut();
    redirect("/sem-acesso");
  }

  await supabase.rpc("log_access_event", { event: "login" });
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.rpc("log_access_event", { event: "logout" });
  await supabase.auth.signOut();
  redirect("/login?motivo=saida");
}

const resetSchema = z.object({ email: z.string().trim().email("Informe um e-mail válido.") });

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/atualizar-senha`,
  });
  // Resposta idêntica exista ou não o e-mail.
  return {
    message: "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.",
  };
}

const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "A senha deve ter pelo menos 12 caracteres.")
      .regex(/[A-Za-z]/, "Inclua letras.")
      .regex(/[0-9]/, "Inclua números."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "As senhas não conferem.", path: ["confirm"] });

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Não foi possível alterar a senha. Solicite um novo link." };
  redirect("/");
}
