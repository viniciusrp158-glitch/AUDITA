"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { setThemeCookie, type Theme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";

export type AccountState = { ok?: string; error?: string; fieldErrors?: Record<string, string>; seq?: number };

const ROLES = ["admin", "operador", "marketing"] as const;
const LEVELS = ["mestre", ...ROLES] as const;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tema claro/escuro: guardado na conta (vale em qualquer aparelho) e num cookie (a página já abre no tema certo). */
export async function setThemeAction(theme: Theme): Promise<void> {
  const user = await requireAppUser();
  const t: Theme = theme === "escuro" ? "escuro" : "claro";
  const supabase = await createClient();
  await supabase.from("app_users").update({ theme: t }).eq("user_id", user.id);
  await setThemeCookie(t);
}

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome completo.").max(160, "Nome muito longo."),
  job_title: z
    .string()
    .trim()
    .max(120, "Cargo muito longo.")
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || v.length >= 2, "Cargo muito curto."),
});

export async function updateProfileAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireAppUser();
  const parsed = profileSchema.safeParse({ full_name: formData.get("full_name") ?? "", job_title: formData.get("job_title") ?? "" });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Revise os campos destacados.", fieldErrors: fe };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("app_users").update(parsed.data).eq("user_id", user.id);
  if (error) return { error: "Não foi possível salvar. Tente novamente." };
  revalidatePath("/", "layout");
  return { ok: "Dados da conta salvos.", seq: Date.now() };
}

// ---------------------------------------------------------------------------------------------------------------
// Gestão de usuários — somente o usuário mestre. A conta de login é criada pela função do Supabase "usuarios",
// que usa a chave privilegiada só dentro do Supabase e confere no banco se quem chama é o mestre.
// ---------------------------------------------------------------------------------------------------------------

export type ManagedUser = {
  user_id: string;
  full_name: string;
  job_title: string | null;
  role: (typeof ROLES)[number];
  status: "active" | "inactive";
  is_master: boolean;
  is_comaster: boolean;
  is_test: boolean;
  is_test_master: boolean;
  must_change_password: boolean;
  created_at: string;
  email: string | null;
  last_sign_in_at: string | null;
};

async function callUsersFunction(body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { status: 401, data: { erro: "Sessão expirada. Entre novamente." } };
  const { data, error } = await supabase.functions.invoke("usuarios", {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    // Erros da função vêm com o corpo JSON { erro }
    const ctx = (error as { context?: Response }).context;
    try {
      const payload = ctx ? await ctx.json() : null;
      return { status: ctx?.status ?? 500, data: payload ?? { erro: "Falha ao falar com o serviço de usuários." } };
    } catch {
      return { status: 500, data: { erro: "Falha ao falar com o serviço de usuários." } };
    }
  }
  return { status: 200, data: (data ?? {}) as Record<string, unknown> };
}

export async function listManagedUsers(): Promise<{ users: ManagedUser[]; error?: string }> {
  const me = await requireAppUser(["admin"]);
  if (!me.isMaster) return { users: [] };
  const r = await callUsersFunction({ acao: "listar" });
  if (r.status !== 200) return { users: [], error: String(r.data.erro ?? "Não foi possível listar os usuários.") };
  return { users: (r.data.usuarios as ManagedUser[]) ?? [] };
}

const createSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome completo.").max(160),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  cargo: z.string().trim().max(120),
  nivel: z.enum(LEVELS, { message: "Escolha o nível de acesso." }),
  senha: z
    .string()
    .min(12, "A senha provisória precisa ter 12 caracteres ou mais.")
    .max(72)
    .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), "Use letras e números."),
});

export async function createUserAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const me = await requireAppUser(["admin"]);
  if (!me.isMaster) return { error: "Somente o usuário mestre cria usuários." };
  const parsed = createSchema.safeParse(Object.fromEntries(["nome", "email", "cargo", "nivel", "senha"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Revise os campos destacados.", fieldErrors: fe };
  }
  const r = await callUsersFunction({ acao: "criar", ...parsed.data });
  if (r.status !== 201 && r.status !== 200) return { error: String(r.data.erro ?? "Não foi possível criar o usuário.") };
  revalidatePath("/conta");
  return {
    ok: `Usuário criado. Informe a senha provisória a ${parsed.data.nome} por um canal seguro; a troca é obrigatória no primeiro acesso.`,
    seq: Date.now(),
  };
}

export async function resetPasswordAction(userId: string, _prev: AccountState, formData: FormData): Promise<AccountState> {
  const me = await requireAppUser(["admin"]);
  if (!me.isMaster || !uuidRe.test(userId)) return { error: "Operação não permitida." };
  const senha = String(formData.get("senha") ?? "");
  if (senha.length < 12 || !/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha))
    return { error: "A senha provisória precisa ter 12 caracteres ou mais, com letras e números." };
  const r = await callUsersFunction({ acao: "redefinir_senha", user_id: userId, senha });
  if (r.status !== 200) return { error: String(r.data.erro ?? "Não foi possível redefinir a senha.") };
  return { ok: "Senha provisória definida; a troca será exigida no próximo acesso.", seq: Date.now() };
}

/** Nível e situação: gravados direto na tabela — o banco só aceita se quem grava é o mestre. */
export async function updateAccessAction(userId: string, _prev: AccountState, formData: FormData): Promise<AccountState> {
  const me = await requireAppUser(["admin"]);
  if (!me.isMaster || !uuidRe.test(userId)) return { error: "Operação não permitida." };
  const level = String(formData.get("nivel") ?? "");
  const status = String(formData.get("situacao") ?? "");
  if (!LEVELS.includes(level as (typeof LEVELS)[number]) || !["active", "inactive"].includes(status)) return { error: "Dados inválidos." };
  if (userId === me.id) return { error: "Ninguém altera o próprio nível ou situação; peça a outro usuário mestre." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_users")
    .update({ role: level === "mestre" ? "admin" : level, is_comaster: level === "mestre", status })
    .eq("user_id", userId)
    .select("user_id");
  if (error || !data?.length) return { error: error?.message?.includes("mestre") || error?.message?.includes("próprio") ? error.message : "Não foi possível alterar o acesso." };
  revalidatePath("/conta");
  return { ok: "Acesso atualizado.", seq: Date.now() };
}
