// T3 — Vitrine dos treinamentos (audita.seg.br/treinamentos/cursos) e início da compra no Mercado Pago (Checkout Pro).
// Visitantes não acessam o banco (regra 4): a área do aluno chama esta função com a chave publicável, e ela usa a chave
// de serviço (que só existe aqui) para ler o catálogo e criar o pedido. O pagamento acontece na página do Mercado Pago;
// a liberação do acesso vem pelo aviso de pagamento (função "mercadopago").
// Ações (POST JSON):
//   "catalogo"            → { aberta, cursos: [...] }
//   "curso"   { codigo }  → { aberta, curso | null }
//   "loja"                → dados públicos do vendedor, termos e política de privacidade
//   "comprar" { codigo, nome, email, cpf?, telefone?, aceite, novidades? } → { ir_para: <URL do Mercado Pago> }
//             (limites por IP e por e-mail no banco → 429; pedido pendente do mesmo comprador é reaproveitado; o pedido
//             e o link do Mercado Pago vencem em 3 dias)
//   "pedido"  { pedido, token } → situação do pedido (página de retorno)
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PORTAL = (Deno.env.get("AUDITA_ALUNO_URL") ?? "https://audita.seg.br/treinamentos").replace(/\/$/, "");
const MP_API = (Deno.env.get("MP_API_URL") ?? "https://api.mercadopago.com").replace(/\/$/, "");
const WEBHOOK = Deno.env.get("MP_WEBHOOK_URL") ?? "https://audita.seg.br/pagamentos/mercadopago";
// Chave interna entre a área do aluno (servidor) e esta função: com ela, vale o IP do comprador que a área do aluno viu
// (x-audita-ip-cliente). Sem a chave configurada, o cabeçalho é aceito como está (o limite por e-mail continua valendo).
const CHAVE_INTERNA = Deno.env.get("VITRINE_CHAVE_INTERNA") ?? "";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

// Mensagens das regras do banco (em português) podem ir ao comprador; o resto vira mensagem genérica
function rule(error: { code?: string; message?: string } | null, fallback: string) {
  return error && ["23514", "23505", "P0002", "22023", "54000"].includes(error.code ?? "") && error.message ? error.message : fallback;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/**
 * IP do comprador para o limite de tentativas (auditoria de segurança, 25/10/2026). Pela área do aluno, vem no
 * cabeçalho x-audita-ip-cliente (validado pela chave interna, quando configurada); direto, vem do Cloudflare
 * (cf-connecting-ip) ou do primeiro endereço de x-forwarded-for.
 */
function clientIp(req: Request): string {
  const h = (n: string) => (req.headers.get(n) ?? "").trim();
  const viaPortal = h("x-audita-ip-cliente");
  if (viaPortal && (!CHAVE_INTERNA || safeEqual(h("x-audita-vitrine-chave"), CHAVE_INTERNA))) return viaPortal.slice(0, 100);
  return (h("cf-connecting-ip") || h("x-forwarded-for").split(",")[0].trim() || h("x-real-ip") || "desconhecido").slice(0, 100);
}

/** Hash do IP (HMAC-SHA256 com a chave de serviço): o banco nunca guarda o IP, e o hash não é revertido por força bruta. */
async function ipHash(ip: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`vitrine-ip:${ip.toLowerCase()}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Data no formato do Mercado Pago, no horário de Brasília (sem horário de verão desde 2019). */
function mpDate(iso: string): string {
  return new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().replace("Z", "-03:00");
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
      p_ip_hash: await ipHash(clientIp(req)),
    });
    if (created.error) return json(created.error.code === "54000" ? 429 : 400, { erro: rule(created.error, "Não foi possível registrar o pedido.") });
    const o = created.data as {
      order_id: string; token: string; amount: number; code: string; title: string; email: string; name: string; cpf: string | null;
      created_at: string; expires_at: string; init_point: string | null; reused: boolean; erro?: string;
    } | null;
    // "Este e-mail já tem acesso": aviso devolvido pelo banco sem desfazer o registro da tentativa (conta no limite)
    if (!o || o.erro) return json(400, { erro: o?.erro ?? "Não foi possível registrar o pedido." });
    // Mesmo comprador tentando de novo: o mesmo pedido e o mesmo link de pagamento, sem nova chamada ao Mercado Pago
    if (o.reused && o.init_point) return json(200, { ir_para: o.init_point, pedido: o.order_id, token: o.token });
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
      // O link vence junto com o pedido (training_order_validity no banco); Pix e boleto também
      expires: true,
      expiration_date_from: mpDate(o.created_at),
      expiration_date_to: mpDate(o.expires_at),
      date_of_expiration: mpDate(o.expires_at),
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
    await db.rpc("training_order_set_preference", { p_order_id: o.order_id, p_preference: p.id, p_init_point: p.init_point });
    return json(200, { ir_para: p.init_point, pedido: o.order_id, token: o.token });
  }

  return json(400, { erro: "Ação desconhecida." });
});
