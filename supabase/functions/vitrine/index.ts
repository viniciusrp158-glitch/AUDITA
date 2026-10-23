// T3 — Vitrine dos treinamentos (audita.seg.br/treinamentos/cursos) e início da compra no Mercado Pago (Checkout Pro).
// Visitantes não acessam o banco (regra 4): a área do aluno chama esta função com a chave publicável, e ela usa a chave
// de serviço (que só existe aqui) para ler o catálogo e criar o pedido. O pagamento acontece na página do Mercado Pago;
// a liberação do acesso vem pelo aviso de pagamento (função "mercadopago").
// Ações (POST JSON):
//   "catalogo"            → { aberta, cursos: [...] }
//   "curso"   { codigo }  → { aberta, curso | null }
//   "loja"                → dados públicos do vendedor, termos e política de privacidade
//   "comprar" { codigo, nome, email, cpf?, telefone?, aceite, novidades? } → { ir_para: <URL do Mercado Pago> }
//   "pedido"  { pedido, token } → situação do pedido (página de retorno)
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PORTAL = (Deno.env.get("AUDITA_ALUNO_URL") ?? "https://audita.seg.br/treinamentos").replace(/\/$/, "");
const MP_API = (Deno.env.get("MP_API_URL") ?? "https://api.mercadopago.com").replace(/\/$/, "");
const WEBHOOK = Deno.env.get("MP_WEBHOOK_URL") ?? "https://audita.seg.br/pagamentos/mercadopago";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

// Mensagens das regras do banco (em português) podem ir ao comprador; o resto vira mensagem genérica
function rule(error: { code?: string; message?: string } | null, fallback: string) {
  return error && ["23514", "23505", "P0002", "22023"].includes(error.code ?? "") && error.message ? error.message : fallback;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { erro: "Método não permitido." });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { erro: "Requisição inválida." });
  }
  const db = createClient(SUPABASE_URL, SERVICE, { db: { schema: "audita" }, auth: { persistSession: false, autoRefreshToken: false } });

  if (body.acao === "catalogo" || body.acao === "curso") {
    const [open, cat] = await Promise.all([
      db.rpc("training_store_open"),
      db.rpc("training_catalog", { p_code: body.acao === "curso" ? String(body.codigo ?? "") : null }),
    ]);
    if (open.error || cat.error) return json(500, { erro: "Não foi possível carregar os cursos." });
    const cursos = (cat.data ?? []) as unknown[];
    return body.acao === "curso" ? json(200, { aberta: open.data === true, curso: cursos[0] ?? null }) : json(200, { aberta: open.data === true, cursos });
  }

  if (body.acao === "loja") {
    const { data, error } = await db.rpc("training_store_info");
    if (error) return json(500, { erro: "Não foi possível carregar os dados da loja." });
    return json(200, data ?? {});
  }

  if (body.acao === "pedido") {
    const id = String(body.pedido ?? "");
    const token = String(body.token ?? "");
    if (!uuidRe.test(id) || !/^[0-9a-f]{32}$/.test(token)) return json(200, { encontrado: false });
    const { data, error } = await db.rpc("training_order_public", { p_order_id: id, p_token: token });
    if (error) return json(500, { erro: "Não foi possível consultar o pedido." });
    return json(200, data ? { encontrado: true, ...(data as Record<string, unknown>) } : { encontrado: false });
  }

  if (body.acao === "comprar") {
    const created = await db.rpc("training_order_create", {
      p_code: String(body.codigo ?? ""),
      p_name: String(body.nome ?? ""),
      p_email: String(body.email ?? ""),
      p_cpf: body.cpf ? String(body.cpf) : null,
      p_phone: body.telefone ? String(body.telefone) : null,
      p_accept: body.aceite === true,
      p_marketing: body.novidades === true,
    });
    if (created.error || !created.data) return json(400, { erro: rule(created.error, "Não foi possível registrar o pedido.") });
    const o = created.data as { order_id: string; token: string; amount: number; code: string; title: string; email: string; name: string; cpf: string | null };
    const token = (await db.rpc("training_payment_secret", { p_kind: "mp_access_token" })).data as string | null;
    if (!token) return json(503, { erro: "Pagamento indisponível no momento. Tente mais tarde." });
    const back = `${PORTAL}/compra/${o.order_id}?t=${o.token}`;
    const [first, ...rest] = o.name.split(/\s+/);
    const pref = {
      items: [{ id: o.code, title: `${o.code} · ${o.title}`.slice(0, 250), quantity: 1, currency_id: "BRL", unit_price: Number(o.amount) }],
      payer: { name: first, surname: rest.join(" "), email: o.email, ...(o.cpf ? { identification: { type: "CPF", number: o.cpf } } : {}) },
      external_reference: o.order_id,
      notification_url: WEBHOOK,
      back_urls: { success: back, pending: back, failure: back },
      auto_return: "approved",
      statement_descriptor: "AUDITA",
    };
    let res: Response;
    try {
      res = await fetch(`${MP_API}/checkout/preferences`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Idempotency-Key": o.order_id },
        body: JSON.stringify(pref),
      });
    } catch {
      return json(502, { erro: "Não foi possível falar com o Mercado Pago. Tente de novo." });
    }
    if (!res.ok) return json(502, { erro: "O Mercado Pago recusou o pedido. Tente de novo mais tarde." });
    const p = (await res.json()) as { id?: string; init_point?: string };
    if (!p.id || !p.init_point) return json(502, { erro: "Resposta inesperada do Mercado Pago." });
    await db.rpc("training_order_set_preference", { p_order_id: o.order_id, p_preference: p.id });
    return json(200, { ir_para: p.init_point, pedido: o.order_id, token: o.token });
  }

  return json(400, { erro: "Ação desconhecida." });
});
