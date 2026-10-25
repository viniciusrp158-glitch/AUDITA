// T2 — Alunos dos treinamentos: cria a conta do aluno (convite por e-mail para ele criar a senha) e faz a matrícula.
// Mesmo modelo da função "usuarios": a chave privilegiada existe SOMENTE no ambiente da função; quem chama precisa ser
// administrador (conferido no banco com o próprio token), e tudo o que é gravado passa pela RLS com o autor certo.
// Ações:
//   "matricular"  { curso_id, acesso_ate?, origem: gestao|lote|cortesia, alunos: [{ nome, email, cpf?, empresa?, telefone? }] }
//   "situacao"    { curso_id } → por matrícula: convite pendente ou senha criada, e último acesso
//   "reenviar"    { aluno_id }  → reenvia o convite a quem ainda não criou a senha
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { contaCriadaNestaRequisicao, podeApagarConta } from "./conta-criada.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Endereço da área do aluno (o convite leva a <PORTAL>/auth/confirm, que confere o link e abre "Criar senha")
const PORTAL = (Deno.env.get("AUDITA_ALUNO_URL") ?? "https://audita.seg.br/treinamentos").replace(/\/$/, "");
const MAX_LOTE = 500;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cpfValido(v: string): boolean {
  if (!/^\d{11}$/.test(v) || /^(\d)\1{10}$/.test(v)) return false;
  for (const t of [9, 10]) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(v[i]) * (t + 1 - i);
    const d = ((s * 10) % 11) % 10;
    if (d !== Number(v[t])) return false;
  }
  return true;
}

type Aluno = { nome?: unknown; email?: unknown; cpf?: unknown; empresa?: unknown; telefone?: unknown };
type Resultado = { email: string; nome: string; situacao: "convidado" | "conta_existente" | "ja_matriculado" | "erro"; mensagem?: string };

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { erro: "Método não permitido." });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json(401, { erro: "Sessão necessária." });

  const user = createClient(URL, ANON, {
    global: { headers: { Authorization: auth } },
    db: { schema: "audita" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const isAdmin = await user.rpc("is_admin");
  if (isAdmin.error || isAdmin.data !== true) return json(403, { erro: "Somente administradores matriculam alunos." });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { erro: "Requisição inválida." });
  }
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  if (body.acao === "matricular") {
    const cursoId = String(body.curso_id ?? "");
    const acessoAte = body.acesso_ate ? String(body.acesso_ate) : null;
    const origem = String(body.origem ?? "gestao");
    const lista = Array.isArray(body.alunos) ? (body.alunos as Aluno[]) : [];
    if (!uuidRe.test(cursoId)) return json(400, { erro: "Treinamento inválido." });
    if (acessoAte && !dateRe.test(acessoAte)) return json(400, { erro: "Data de acesso inválida." });
    if (!["gestao", "lote", "cortesia"].includes(origem)) return json(400, { erro: "Origem inválida." });
    if (!lista.length) return json(400, { erro: "Informe pelo menos um aluno." });
    if (lista.length > MAX_LOTE) return json(400, { erro: `No máximo ${MAX_LOTE} alunos por envio.` });

    const resultados: Resultado[] = [];
    const vistos = new Set<string>();
    for (const a of lista) {
      const email = String(a.email ?? "").trim().toLowerCase();
      const nome = String(a.nome ?? "").trim().replace(/\s+/g, " ");
      const cpf = String(a.cpf ?? "").replace(/\D/g, "");
      const empresa = String(a.empresa ?? "").trim();
      const telefone = String(a.telefone ?? "").replace(/\D/g, "");
      const erro = (mensagem: string) => resultados.push({ email, nome, situacao: "erro", mensagem });
      if (!emailRe.test(email) || email.length > 254) { erro("E-mail inválido."); continue; }
      if (nome.length < 3 || nome.length > 160) { erro("Informe o nome completo."); continue; }
      if (cpf && !cpfValido(cpf)) { erro("CPF inválido."); continue; }
      if (empresa && (empresa.length < 2 || empresa.length > 200)) { erro("Empresa inválida."); continue; }
      if (telefone && !/^\d{10,13}$/.test(telefone)) { erro("Telefone inválido."); continue; }
      if (vistos.has(email)) { erro("E-mail repetido na lista."); continue; }
      vistos.add(email);

      // Aluno já cadastrado: só matricula
      const found = await user.from("training_students").select("id, status").eq("email", email).maybeSingle();
      if (found.error) { erro("Não foi possível consultar o aluno."); continue; }
      let studentId = found.data?.id as string | undefined;
      let situacao: Resultado["situacao"] = "conta_existente";
      if (found.data && found.data.status !== "ativo") { erro("Aluno inativo: reative o cadastro antes de matricular."); continue; }

      if (!studentId) {
        let userId: string | undefined;
        let created = false;
        const inicio = Date.now();
        const inv = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: nome }, redirectTo: `${PORTAL}/auth/confirm` });
        if (!inv.error && inv.data.user) {
          userId = inv.data.user.id;
          // O convite também devolve uma conta já existente (não confirmada): só é "criada aqui" se nasceu agora
          created = contaCriadaNestaRequisicao(inv.data.user.created_at, inicio);
          situacao = "convidado";
        } else if (/already|registered|exists/i.test(inv.error?.message ?? "")) {
          // Já existe uma conta com este e-mail (ex.: alguém da equipe): reaproveita, sem enviar e-mail
          const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
          userId = link.data.user?.id;
        }
        if (!userId) { erro("Não foi possível criar a conta do aluno."); continue; }
        const ins = await user
          .from("training_students")
          .insert({
            user_id: userId,
            full_name: nome,
            email,
            cpf: cpf || null,
            company: empresa || null,
            phone: telefone || null,
            source: origem === "lote" ? "lote" : "gestao",
          })
          .select("id")
          .single();
        if (ins.error || !ins.data) {
          // Nada fica pela metade, mas só se apaga a conta que esta requisição criou e que nenhum aluno usa
          // (ex.: matrícula simultânea do mesmo e-mail ou compra liberada no mesmo instante)
          if (created) {
            const ref = await admin.schema("audita").from("training_students").select("id").eq("user_id", userId).maybeSingle();
            if (podeApagarConta({ criadaNestaRequisicao: created, referenciadaPorAluno: Boolean(ref.error) || Boolean(ref.data) })) {
              await admin.auth.admin.deleteUser(userId);
            }
          }
          erro(ins.error?.code === "23505" ? "Esta conta já pertence a outro aluno." : "Não foi possível registrar o aluno.");
          continue;
        }
        studentId = ins.data.id;
      }

      const enr = await user.rpc("training_enroll", { p_student_id: studentId, p_course_id: cursoId, p_access_until: acessoAte, p_source: origem });
      if (enr.error) {
        if (enr.error.code === "23505") resultados.push({ email, nome, situacao: "ja_matriculado" });
        else erro(enr.error.code === "23514" ? enr.error.message : "Não foi possível matricular.");
        continue;
      }
      resultados.push({ email, nome, situacao });
    }
    return json(200, { ok: true, resultados });
  }

  if (body.acao === "situacao") {
    const cursoId = String(body.curso_id ?? "");
    if (!uuidRe.test(cursoId)) return json(400, { erro: "Treinamento inválido." });
    const rows = await user.from("training_enrollments").select("id, training_students(user_id)").eq("course_id", cursoId);
    if (rows.error) return json(400, { erro: "Não foi possível consultar as matrículas." });
    const situacao: Record<string, { senha_criada: boolean; ultimo_acesso: string | null }> = {};
    for (const r of rows.data ?? []) {
      const uid = (r.training_students as unknown as { user_id: string } | null)?.user_id;
      if (!uid) continue;
      const u = await admin.auth.admin.getUserById(uid);
      situacao[r.id] = {
        senha_criada: Boolean(u.data.user?.email_confirmed_at || u.data.user?.last_sign_in_at),
        ultimo_acesso: u.data.user?.last_sign_in_at ?? null,
      };
    }
    return json(200, { ok: true, situacao });
  }

  if (body.acao === "reenviar") {
    const alunoId = String(body.aluno_id ?? "");
    if (!uuidRe.test(alunoId)) return json(400, { erro: "Aluno inválido." });
    const s = await user.from("training_students").select("user_id, email, full_name, status").eq("id", alunoId).maybeSingle();
    if (s.error || !s.data) return json(404, { erro: "Aluno não encontrado." });
    if (s.data.status !== "ativo") return json(400, { erro: "Aluno inativo." });
    const u = await admin.auth.admin.getUserById(s.data.user_id);
    if (u.data.user?.email_confirmed_at || u.data.user?.last_sign_in_at)
      return json(400, { erro: "O aluno já criou a senha. Se esqueceu, ele usa “Esqueci minha senha” na área do aluno." });
    const inv = await admin.auth.admin.inviteUserByEmail(s.data.email, { data: { full_name: s.data.full_name }, redirectTo: `${PORTAL}/auth/confirm` });
    if (inv.error) return json(400, { erro: "Não foi possível reenviar o convite." });
    return json(200, { ok: true });
  }

  return json(400, { erro: "Ação desconhecida." });
});
