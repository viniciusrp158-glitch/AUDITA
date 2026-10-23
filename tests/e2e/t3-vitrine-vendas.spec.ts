/**
 * T3 — Vitrine e vendas de ponta a ponta, no ambiente de desenvolvimento, com o Mercado Pago SIMULADO (função mp-mock,
 * só do desenvolvimento, e a página de pagamento interceptada no navegador):
 *   gestão: vendedor, termos e privacidade fictícios "[TESTE]", credenciais de teste, abrir as vendas e pôr o L01 à venda;
 *   visitante: vitrine → página do curso → compra (dados e aceite) → "Mercado Pago" → aviso de pagamento assinado
 *   (assinatura errada recusada) → página do pedido aprovada → convite → senha → Meus cursos com o L01;
 *   segunda compra do mesmo e-mail recusada; gestão vê o pedido pago com a matrícula; celular sem rolagem horizontal.
 * Requer DEV_MAILPIT_URL e as variáveis do .env.local (URL e chave publicável do desenvolvimento).
 */
import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const MAILPIT = process.env.DEV_MAILPIT_URL;
const API = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const ALUNO = `http://127.0.0.1:${process.env.E2E_ALUNO_PORT ?? 3001}/treinamentos`;
const SHOTS = "test-results/telas";
const SECRET = "segredo-de-teste-e2e-assinatura-0001";
const stamp = Date.now().toString(36);
const BUYER = { nome: "[TESTE] Comprador da Vitrine", email: `compra.${stamp}@teste.audita`, senha: `Teste${stamp}9` };
const LEGAL = "[TESTE] Texto fictício do ambiente de desenvolvimento, usado apenas para verificar a vitrine e a compra.";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/empresa", { timeout: 15_000 });
}

async function inviteLink(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/messages?limit=50`)).json();
    const msg = (list.messages ?? []).find((m: { To?: { Address: string }[] }) => m.To?.some((t) => t.Address === email));
    if (msg) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      return /href="([^"]+)"/.exec(full.HTML)![1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Convite não chegou");
}

/**
 * Aviso de pagamento como o Mercado Pago envia (assinatura HMAC com a assinatura secreta cadastrada). Quem entrega é o
 * simulador, por dentro da rede do Supabase: o gateway do desenvolvimento troca o x-request-id, que entra na assinatura.
 */
async function webhook(dataId: string, secret = SECRET): Promise<{ status: number; body: string }> {
  const ts = String(Date.now());
  const rid = `req-${stamp}-${Math.random().toString(36).slice(2)}`;
  const v1 = createHmac("sha256", secret).update(`id:${dataId};request-id:${rid};ts:${ts};`).digest("hex");
  const res = await fetch(`${API}/functions/v1/mp-mock/notificar`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: "Bearer TEST-simulador", "Content-Type": "application/json" },
    body: JSON.stringify({ data_id: dataId, request_id: rid, ts, v1 }),
  });
  return (await res.json()) as { status: number; body: string };
}

test.describe.configure({ mode: "serial" });
test.skip(!MAILPIT, "Defina DEV_MAILPIT_URL (caixa de testes do ambiente de desenvolvimento)");

test("gestão: configura e abre as vendas; L01 à venda", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await page.goto("/treinamentos/vendas");
  const settings = page.getByTestId("sales-settings");
  await settings.getByLabel("Razão social do vendedor").fill("[TESTE] Vendedor Fictício Ltda");
  await settings.getByLabel("CNPJ").fill("11.222.333/0001-81");
  await settings.getByLabel("E-mail de suporte").fill("suporte@teste.audita");
  await settings.getByLabel("Termos de uso e de compra").fill(LEGAL);
  await settings.getByLabel("Política de privacidade (LGPD)").fill(LEGAL);
  await settings.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Configurações de venda salvas.")).toBeVisible({ timeout: 20_000 });

  const token = page.getByTestId("mp-token");
  await token.locator("input[name=value]").fill("chave-errada-sem-prefixo-123");
  await token.getByRole("button", { name: "Guardar" }).click();
  await expect(token.getByText(/começa com APP_USR-/)).toBeVisible({ timeout: 20_000 });
  await token.locator("input[name=value]").fill("TEST-0000000000000000-e2e-teste-0001");
  await token.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("mp-token")).toContainText("Cadastrado TESTE ••••0001", { timeout: 20_000 });
  const secret = page.getByTestId("mp-secret");
  await secret.locator("input[name=value]").fill(SECRET);
  await secret.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("mp-secret")).toContainText("Cadastrado ••••0001", { timeout: 20_000 });
  await expect(page.getByTestId("mp-token").locator("input[name=value]")).toHaveValue("");

  const sw = page.getByTestId("sales-switch");
  if ((await sw.textContent())?.includes("Abrir")) {
    await sw.click();
    await expect(page.getByText("Vendas abertas.")).toBeVisible({ timeout: 20_000 });
  }
  await expect(page.getByTestId("sales-status")).toContainText("Vendas abertas");
  await page.screenshot({ path: `${SHOTS}/t3-01-gestao-vendas.png`, fullPage: true });

  await page.goto("/treinamentos?q=L01");
  await page.getByTestId("training-list").getByRole("link").first().click();
  await page.getByRole("tab", { name: "Venda e preço" }).click();
  const form = page.getByTestId("commercial-form");
  await form.getByLabel("Preço (R$)").fill("197,00");
  await form.getByLabel("Prazo de acesso (dias)").fill("90");
  await form.getByLabel("Mostrar na vitrine e aceitar compras").check();
  await form.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Dados de venda salvos.")).toBeVisible({ timeout: 20_000 });
});

test("visitante compra pela vitrine, o pagamento é aprovado e o acesso é liberado", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext();
  const v = await ctx.newPage();
  // Página de pagamento do Mercado Pago (simulada)
  await ctx.route("https://mercadopago.simulado/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<html><body><h1>Mercado Pago (simulado)</h1></body></html>" }),
  );

  await v.goto(ALUNO);
  await expect(v).toHaveURL(/\/treinamentos\/cursos$/);
  await expect(v.getByTestId("store-list")).toContainText("L01");
  await v.getByTestId("store-list").getByRole("link", { name: "Ver o curso" }).first().click();
  await expect(v.getByTestId("store-course-title")).toContainText("Segurança do Trabalho");
  await expect(v.getByTestId("store-price")).toContainText("R$ 197,00");
  await expect(v.getByTestId("store-modules").locator("li")).toHaveCount(7);
  await v.screenshot({ path: `${SHOTS}/t3-02-pagina-do-curso.png`, fullPage: true });

  await v.getByTestId("buy-button").click();
  const form = v.getByTestId("buy-form");
  await form.getByLabel("Nome completo").fill(BUYER.nome);
  await form.getByLabel("E-mail", { exact: true }).fill(BUYER.email);
  await form.getByLabel("Repita o e-mail").fill(BUYER.email.toUpperCase());
  await form.getByLabel("CPF").fill("529.982.247-25");
  await form.getByRole("checkbox").check();
  await v.screenshot({ path: `${SHOTS}/t3-03-compra.png`, fullPage: true });
  await v.getByTestId("go-pay").click();
  await v.waitForURL(/mercadopago\.simulado\/pagar/, { timeout: 30_000 });
  const pay = new URL(v.url());
  const ref = pay.searchParams.get("ref")!;
  expect(pay.searchParams.get("centavos")).toBe("19700");
  const back = pay.searchParams.get("volta")!.replace(/^https?:\/\/[^/]+\/treinamentos/, ALUNO);

  // Antes do aviso: pedido aguardando
  await v.goto(back);
  await expect(v.getByTestId("order-status")).toContainText("Aguardando a confirmação do pagamento");

  // Assinatura errada é recusada; a certa libera o acesso (e repetir o aviso não duplica)
  expect((await webhook(`${ref}.19700.approved`, "assinatura-errada-0000000000")).status).toBe(401);
  expect(await webhook(`${ref}.19700.approved`)).toEqual({ status: 200, body: "aprovado" });
  expect((await webhook(`${ref}.19700.approved`)).status).toBe(200);

  await expect(v.getByTestId("order-status")).toContainText("Pagamento aprovado", { timeout: 20_000 });
  await v.screenshot({ path: `${SHOTS}/t3-04-pedido-aprovado.png` });

  const link = await inviteLink(BUYER.email);
  await v.goto(link.replace(/^https?:\/\/[^/]+\/treinamentos/, ALUNO));
  await v.getByLabel("Nova senha").fill(BUYER.senha);
  await v.getByLabel("Repita a senha").fill(BUYER.senha);
  await v.getByRole("button", { name: "Salvar senha e entrar" }).click();
  await expect(v.getByTestId("my-courses")).toContainText("Segurança do Trabalho", { timeout: 20_000 });

  // O mesmo e-mail não compra de novo enquanto tiver acesso
  await v.goto(`${ALUNO}/cursos/L01/comprar`);
  const again = v.getByTestId("buy-form");
  await again.getByLabel("Nome completo").fill(BUYER.nome);
  await again.getByLabel("E-mail", { exact: true }).fill(BUYER.email);
  await again.getByLabel("Repita o e-mail").fill(BUYER.email);
  await again.getByLabel("CPF").fill("52998224725");
  await again.getByRole("checkbox").check();
  await v.getByTestId("go-pay").click();
  await expect(v.getByText("Este e-mail já tem acesso a este curso.", { exact: false })).toBeVisible({ timeout: 20_000 });

  // Celular
  await v.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/cursos", "/cursos/L01", "/cursos/L01/comprar", "/termos"]) {
    await v.goto(`${ALUNO}${path}`);
    expect(await v.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBeLessThanOrEqual(1);
  }
  await v.goto(`${ALUNO}/cursos/L01`);
  await v.screenshot({ path: `${SHOTS}/t3-05-celular.png`, fullPage: true });
  await ctx.close();

  // Gestão: pedido pago com a matrícula liberada
  await login(page);
  await page.goto("/treinamentos/vendas");
  const row = page.getByTestId("orders").locator("li", { hasText: BUYER.email });
  await expect(row).toContainText("Pago");
  await expect(row).toContainText("matrícula liberada");
});
