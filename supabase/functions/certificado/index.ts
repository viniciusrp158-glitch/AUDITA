// T2d — Verificação pública do certificado de curso livre pelo código (página audita.seg.br/treinamentos/certificado/<código>).
// Nada é liberado para "anon" no banco: esta função usa a chave de serviço (que só existe aqui) para chamar
// audita.training_verify_certificate e devolve somente o necessário para conferir o documento (sem CPF nem e-mail).
// Ação: POST { codigo: "XXXX-XXXX-XXXX" } → { encontrado, situacao, aluno, curso, codigo_curso, carga_minutos, inicio, conclusao, emitido_em }
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const codeRe = /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { erro: "Método não permitido." });
  let codigo = "";
  try {
    codigo = String((await req.json())?.codigo ?? "").trim().toUpperCase();
  } catch {
    return json(400, { erro: "Requisição inválida." });
  }
  if (!codeRe.test(codigo)) return json(200, { encontrado: false });
  const admin = createClient(URL, SERVICE, { db: { schema: "audita" }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.rpc("training_verify_certificate", { p_code: codigo });
  if (error) return json(500, { erro: "Não foi possível consultar o certificado." });
  const c = Array.isArray(data) ? data[0] : null;
  if (!c) return json(200, { encontrado: false });
  return json(200, {
    encontrado: true,
    codigo: c.code,
    situacao: c.status,
    aluno: c.student_name,
    curso: c.course_title,
    codigo_curso: c.course_code,
    carga_minutos: c.workload_minutes,
    inicio: c.started_on,
    conclusao: c.completed_on,
    emitido_em: c.issued_at,
  });
});
