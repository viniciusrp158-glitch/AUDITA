// T3 — Aviso de pagamento do Mercado Pago (webhook), publicado em https://audita.seg.br/pagamentos/mercadopago.
// 1) confere a assinatura (x-signature, HMAC-SHA256 com a "assinatura secreta" cadastrada na gestão) e registra no log
//    quando ela não confere;
// 2) busca o pagamento na API do Mercado Pago (a fonte da verdade, nunca o corpo do aviso);
// 3) atualiza o pedido (valor e moeda conferidos no banco) e, se aprovado, cria a conta do aluno (convite por e-mail)
//    e a matrícula. Repetições do mesmo aviso não duplicam nada.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PORTAL = (Deno.env.get("AUDITA_ALUNO_URL") ?? "https://audita.seg.br/treinamentos").replace(/\/$/, "");
const MP_API = (Deno.env.get("MP_API_URL") ?? "https://api.mercadopago.com").replace(/\/$/, "");
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ok = (msg = "ok") => new Response(msg, { status: 200 });

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método não permitido.", { status: 405 });
  const url = new URL(req.url);
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = await req.json();
  } catch {
    /* alguns avisos vêm só com a query string */
  }
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.type ?? "";
  const dataId = String(url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? body.data?.id ?? "");
  if (type !== "payment" || !/^[A-Za-z0-9._-]{1,64}$/.test(dataId)) return ok("ignorado");

  const db = createClient(SUPABASE_URL, SERVICE, { db: { schema: "audita" }, auth: { persistSession: false, autoRefreshToken: false } });
  const [secretRes, tokenRes] = await Promise.all([
    db.rpc("training_payment_secret", { p_kind: "mp_webhook_secret" }),
    db.rpc("training_payment_secret", { p_kind: "mp_access_token" }),
  ]);
  const secret = secretRes.data as string | null;
  const token = tokenRes.data as string | null;
  if (!secret || !token) return new Response("Credenciais ausentes.", { status: 503 });

  // Assinatura: "ts=<...>,v1=<hmac>" sobre "id:<data.id>;request-id:<x-request-id>;ts:<ts>;". Ela é uma proteção a
  // mais: o aviso é só um gatilho, e a situação vem sempre da API do Mercado Pago com a credencial da conta (valor, moeda
  // e pedido conferidos no banco). Por isso, sem assinatura válida (ex.: avisos "Feed" do topic=payment, que não são
  // assinados) o pagamento é consultado do mesmo jeito, e o motivo fica no log para conferência.
  const sig = req.headers.get("x-signature") ?? "";
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const requestId = req.headers.get("x-request-id") ?? "";
  let signed = false;
  if (parts.ts && parts.v1) {
    const manifest = `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};request-id:${requestId};ts:${parts.ts};`;
    signed = safeEqual(await hmacHex(secret, manifest), parts.v1);
    if (!signed) console.warn("mercadopago: assinatura não conferida", JSON.stringify({ dataId, requestId, ts: parts.ts, v1: parts.v1.slice(0, 12) }));
  } else {
    console.warn("mercadopago: aviso sem assinatura", JSON.stringify({ dataId, type, ua: req.headers.get("user-agent") }));
  }

  const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(dataId)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return new Response("Pagamento não encontrado no Mercado Pago.", { status: 502 });
  const payment = (await res.json()) as Record<string, unknown>;
  const orderId = String(payment.external_reference ?? "");
  if (!uuidRe.test(orderId)) return ok("sem pedido");

  const applied = await db.rpc("training_order_apply_payment", { p_order_id: orderId, p_payment: payment });
  if (applied.error) {
    console.error("apply_payment", applied.error.message);
    return new Response("Pedido não conferido.", { status: applied.error.code === "P0002" ? 200 : 422 });
  }
  const r = applied.data as { status: string; fulfill: boolean; manual_refund?: boolean; email: string; name: string };
  // Pago, mas sem liberação automática (pedido vencido, venda fechada, preço mudou ou e-mail com matrícula em aberto):
  // o pedido fica marcado para reembolso manual na tela de vendas; nenhuma conta é criada
  if (r.manual_refund) {
    console.warn("mercadopago: pedido pago marcado para reembolso manual", JSON.stringify({ orderId }));
    return ok("reembolso manual");
  }
  if (!r.fulfill) return ok(r.status);

  // Conta do aluno: convite para criar a senha; se a conta já existe, só pega o id
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  let userId: string | null = null;
  const inv = await admin.auth.admin.inviteUserByEmail(r.email, { data: { full_name: r.name }, redirectTo: `${PORTAL}/auth/confirm` });
  if (inv.data?.user?.id) userId = inv.data.user.id;
  else {
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: r.email });
    userId = link.data?.user?.id ?? null;
  }
  if (!userId) return new Response("Não foi possível criar a conta do aluno.", { status: 500 });
  const done = await db.rpc("training_order_fulfill", { p_order_id: orderId, p_user_id: userId });
  if (done.error) {
    console.error("fulfill", done.error.message);
    return new Response("Não foi possível liberar o acesso.", { status: 500 });
  }
  if ((done.data as { manual_refund?: boolean } | null)?.manual_refund) {
    console.warn("mercadopago: liberação recusada, pedido marcado para reembolso manual", JSON.stringify({ orderId }));
    return ok("reembolso manual");
  }
  return ok("aprovado");
});
