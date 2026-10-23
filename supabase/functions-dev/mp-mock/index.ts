// SOMENTE AMBIENTE DE DESENVOLVIMENTO — simulador da API do Mercado Pago para testar a compra sem credenciais reais.
// Nunca copiar para a produção (fica fora de supabase/functions de propósito). No desenvolvimento, as funções "vitrine"
// e "mercadopago" apontam para cá com MP_API_URL=http://functions:9000/mp-mock.
//   POST /mp-mock/checkout/preferences → { id, init_point } (página fictícia do Mercado Pago, interceptada no teste)
//   GET  /mp-mock/v1/payments/<pedido>.<centavos>.<situação> → pagamento fictício com essa situação e valor
//   POST /mp-mock/notificar { data_id, request_id, ts, v1 } → envia o aviso de pagamento à função "mercadopago" por
//        dentro da rede (como o Mercado Pago faz na produção, sem o gateway, que trocaria o x-request-id)
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const path = new URL(req.url).pathname.replace(/^\/mp-mock/, "");
  if (!(req.headers.get("Authorization") ?? "").startsWith("Bearer TEST-")) return json(401, { message: "token de teste ausente" });
  if (req.method === "POST" && path === "/checkout/preferences") {
    const p = (await req.json()) as { external_reference: string; items: { unit_price: number }[]; back_urls: { success: string } };
    const cents = Math.round(p.items[0].unit_price * 100);
    const q = new URLSearchParams({ ref: p.external_reference, centavos: String(cents), volta: p.back_urls.success });
    return json(201, { id: `pref-${p.external_reference}`, init_point: `https://mercadopago.simulado/pagar?${q}` });
  }
  if (req.method === "POST" && path === "/notificar") {
    const n = (await req.json()) as { data_id: string; request_id: string; ts: string; v1: string };
    const res = await fetch(`${Deno.env.get("MP_WEBHOOK_URL")}?type=payment&data.id=${encodeURIComponent(n.data_id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-signature": `ts=${n.ts},v1=${n.v1}`, "x-request-id": n.request_id },
      body: JSON.stringify({ type: "payment", action: "payment.updated", data: { id: n.data_id } }),
    });
    return json(200, { status: res.status, body: await res.text() });
  }
  const m = /^\/v1\/payments\/([0-9a-f-]{36})\.(\d+)\.([a-z_]+)$/.exec(path);
  if (req.method === "GET" && m) {
    return json(200, {
      id: `${m[1]}.${m[2]}.${m[3]}`,
      status: m[3],
      status_detail: m[3] === "approved" ? "accredited" : m[3],
      external_reference: m[1],
      transaction_amount: Number(m[2]) / 100,
      currency_id: "BRL",
      payment_method_id: "pix",
    });
  }
  return json(404, { message: "rota do simulador não encontrada" });
});
