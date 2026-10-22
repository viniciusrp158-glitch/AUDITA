"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; ok?: string; email?: string };

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!emailRe.test(email) || !password) return { email, error: "Informe o e-mail e a senha." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { email, error: "E-mail ou senha incorretos." };
  redirect("/meus-cursos");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

/** Envia o link para criar uma nova senha (o link volta para /treinamentos/auth/confirm). */
export async function requestReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailRe.test(email)) return { email, error: "Informe um e-mail válido." };
  const h = await headers();
  const origin = process.env.ALUNO_PUBLIC_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/treinamentos`;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm?next=/definir-senha` });
  // Mesma resposta exista ou não a conta (não revela quem é aluno)
  return { ok: "Se este e-mail tiver cadastro, você vai receber um link para criar uma nova senha. Confira também a caixa de spam." };
}

export async function setPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return { error: "A senha precisa ter pelo menos 8 caracteres, com letras e números." };
  if (password !== confirm) return { error: "As senhas não conferem." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "O link expirou. Peça um novo em “Esqueci minha senha”." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: /same|different/i.test(error.message) ? "Escolha uma senha diferente da anterior." : "Não foi possível salvar a senha." };
  redirect("/meus-cursos?bemvindo=1");
}
