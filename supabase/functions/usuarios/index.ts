// I9.1 — Gestão de usuários do AUDITA (AUDDOC017 §10).
// A chave privilegiada existe SOMENTE dentro do Supabase (variável do próprio ambiente da função): nunca no navegador,
// na Vercel ou no Git. Só o usuário mestre (verificado no banco com o token de quem chama) consegue usar.
// Ações: "listar" (usuários do AUDITA com e-mail), "criar" (conta com senha provisória e troca obrigatória) e
// "redefinir_senha" (nova senha provisória). Só os e-mails de quem está em audita.app_users são consultados.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ROLES = ["admin", "operador", "marketing"];

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

function senhaValida(p: unknown): p is string {
  return typeof p === "string" && p.length >= 12 && p.length <= 72 && /[A-Za-z]/.test(p) && /[0-9]/.test(p);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { erro: "Método não permitido." });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json(401, { erro: "Sessão necessária." });

  // Cliente com o token de quem chama: tudo o que ele gravar passa pela RLS e fica na trilha com o autor certo.
  const user = createClient(URL, ANON, {
    global: { headers: { Authorization: auth } },
    db: { schema: "audita" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const master = await user.rpc("is_master");
  if (master.error || master.data !== true) return json(403, { erro: "Somente o usuário mestre pode gerenciar usuários." });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { erro: "Requisição inválida." });
  }
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  if (body.acao === "listar") {
    const rows = await user
      .from("app_users")
      .select("user_id, full_name, job_title, role, status, is_master, is_test, is_test_master, must_change_password, created_at")
      .order("full_name");
    if (rows.error) return json(400, { erro: "Não foi possível listar os usuários." });
    const usuarios = [];
    for (const r of rows.data ?? []) {
      const u = await admin.auth.admin.getUserById(r.user_id);
      usuarios.push({ ...r, email: u.data.user?.email ?? null, last_sign_in_at: u.data.user?.last_sign_in_at ?? null });
    }
    return json(200, { ok: true, usuarios });
  }

  if (body.acao === "criar") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.nome ?? "").trim();
    const jobTitle = String(body.cargo ?? "").trim();
    const role = String(body.nivel ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { erro: "Informe um e-mail válido." });
    if (fullName.length < 2 || fullName.length > 160) return json(400, { erro: "Informe o nome completo." });
    if (jobTitle && (jobTitle.length < 2 || jobTitle.length > 120)) return json(400, { erro: "Cargo inválido." });
    if (!ROLES.includes(role)) return json(400, { erro: "Nível inválido." });
    if (!senhaValida(body.senha)) return json(400, { erro: "A senha provisória precisa ter 12 caracteres ou mais, com letras e números." });

    const created = await admin.auth.admin.createUser({
      email,
      password: body.senha,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (created.error || !created.data.user) {
      const exists = /already|registered|exists/i.test(created.error?.message ?? "");
      return json(exists ? 409 : 400, { erro: exists ? "Já existe uma conta com este e-mail." : "Não foi possível criar a conta." });
    }
    const id = created.data.user.id;
    const ins = await user.from("app_users").insert({
      user_id: id,
      full_name: fullName,
      job_title: jobTitle || null,
      role,
      status: "active",
      must_change_password: true,
    });
    if (ins.error) {
      await admin.auth.admin.deleteUser(id); // desfaz a conta recém-criada: nada fica pela metade
      return json(400, { erro: "Não foi possível registrar o usuário no AUDITA." });
    }
    return json(201, { ok: true, user_id: id });
  }

  if (body.acao === "redefinir_senha") {
    const id = String(body.user_id ?? "");
    if (!/^[0-9a-f-]{36}$/.test(id)) return json(400, { erro: "Usuário inválido." });
    if (!senhaValida(body.senha)) return json(400, { erro: "A senha provisória precisa ter 12 caracteres ou mais, com letras e números." });
    const target = await user.from("app_users").select("user_id, is_master").eq("user_id", id).maybeSingle();
    if (target.error || !target.data) return json(404, { erro: "Usuário não encontrado." });
    if (target.data.is_master) return json(400, { erro: "Use “Minha conta” para alterar a sua própria senha." });
    const upd = await admin.auth.admin.updateUserById(id, { password: body.senha });
    if (upd.error) return json(400, { erro: "Não foi possível redefinir a senha." });
    const flag = await user.from("app_users").update({ must_change_password: true }).eq("user_id", id);
    if (flag.error) return json(400, { erro: "Senha redefinida, mas não foi possível exigir a troca." });
    return json(200, { ok: true });
  }

  return json(400, { erro: "Ação desconhecida." });
});
