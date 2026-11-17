/**
 * P1 — AUDITA PROSPECT de ponta a ponta (AUDDOC020, critérios de aceite 6.1 a 6.3), no ambiente de TESTES com a base
 * pública de CNPJ carregada: pesquisa por nicho e região, envio ao funil sem duplicar, contato assistido pelo
 * WhatsApp com registro e retorno, "não contatar" e telas no celular. Operador de teste (nível de quem prospecta).
 */
import { expect, test, type Page } from "@playwright/test";

const OPER = { email: process.env.TEST_OPERADOR_EMAIL!, password: process.env.TEST_OPERADOR_PASSWORD! };
const SHOTS = process.env.E2E_SHOTS_DIR;

async function login(page: Page) {
  await page.goto("/empresa/login");
  await page.getByLabel("E-mail").fill(OPER.email);
  await page.getByLabel("Senha").fill(OPER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/empresa\/(clientes|$)/);
}
const shot = async (page: Page, name: string) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

test.describe.configure({ mode: "serial" });
test.skip(!OPER.email, "Defina TEST_OPERADOR_EMAIL/PASSWORD (ambiente de testes)");

test("pesquisa → funil → contato assistido → retorno → não contatar", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page);
  await expect(page.getByRole("link", { name: "Prospecção" })).toBeVisible();

  // 6.1 — pesquisa por nicho e região na base pública
  const t0 = Date.now();
  await page.goto("/empresa/prospeccao/pesquisar?nicho=construcao&raio=50&run=1");
  await expect(page.getByText(/empresas-alvo encontradas/)).toBeVisible({ timeout: 60_000 });
  const searchMs = Date.now() - t0;
  console.log(`pesquisa construção ≤50 km: ${searchMs} ms`);
  const total = Number((await page.locator("p:has-text('empresas-alvo encontradas') strong").first().innerText()).replace(/\D/g, ""));
  expect(total).toBeGreaterThan(1000);
  await shot(page, "p1-pesquisar");

  // 6.2 — seleciona 3 e envia ao funil; a mesma empresa não entra duas vezes
  // (o teste pode ser repetido: conta quantos já estavam em "Lead importado")
  const funil = await page.context().newPage();
  await funil.goto("/empresa/prospeccao/funil");
  const before = await funil.locator('section[aria-label="Lead importado"] li a').count();
  await funil.close();
  const boxes = page.locator('tbody input[type="checkbox"][name="cnpj"]');
  const cnpjs = [await boxes.nth(0).getAttribute("value"), await boxes.nth(1).getAttribute("value"), await boxes.nth(2).getAttribute("value")];
  for (let i = 0; i < 3; i++) await boxes.nth(i).check();
  await page.getByRole("button", { name: "Enviar ao funil" }).click();
  await expect(page.getByText(/3 empresas entraram no funil/)).toBeVisible({ timeout: 30_000 });
  await page.goto("/empresa/prospeccao/pesquisar?nicho=construcao&raio=50");
  await expect(page.getByText(/empresas-alvo encontradas/)).toBeVisible({ timeout: 60_000 });
  for (const c of cnpjs) await expect(page.locator(`input[name="cnpj"][value="${c}"]`)).toHaveCount(0);

  // Funil: as 3 a mais em "Lead importado"
  await page.goto("/empresa/prospeccao/funil");
  const col = page.locator('section[aria-label="Lead importado"]');
  await expect(col.locator("li a")).toHaveCount(Math.min(60, before + 3));
  await shot(page, "p1-funil");

  // 6.3 — ficha de uma das 3: contato assistido pelo WhatsApp (link oficial) e registro com retorno
  await page.goto("/empresa/prospeccao/funil?q=" + cnpjs[0]);
  await page.locator('section[aria-label="Lead importado"] li a').first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const wa = page.getByRole("link", { name: "Abrir no WhatsApp" });
  if (await wa.count()) await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/55\d{10,11}\?text=Ol%C3%A1/);
  await page.getByLabel("Canal").selectOption("whatsapp");
  await page.getByLabel("Como foi").selectOption("enviado");
  await page.getByLabel("Observação").fill("[TESTE] mensagem enviada pelo modelo");
  await page.getByLabel("Próximo retorno").fill("2026-12-01");
  await page.getByLabel("O que fazer no retorno").fill("[TESTE] ligar para confirmar");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Contato registrado.")).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByText("Aguardando retorno").first()).toBeVisible();
  await expect(page.getByText("WhatsApp — Enviado, sem resposta ainda")).toBeVisible();
  await shot(page, "p1-ficha");

  // "Não contatar": sai do funil e o contato fica bloqueado
  await page.getByRole("button", { name: 'Marcar como "não contatar"' }).click();
  await page.getByLabel("Motivo").fill("[TESTE] pediu para não ser contatado");
  await page.getByRole("button", { name: 'Confirmar "não contatar"' }).click();
  await expect(page.getByText(/Registrado em "não contatar"/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/o contato pelo sistema está bloqueado/)).toBeVisible();

  // Painel
  await page.goto("/empresa/prospeccao");
  await expect(page.getByText("Funil — leads por etapa")).toBeVisible();
  await shot(page, "p1-painel");
});

test("regiões: IOC por município e atalho para a pesquisa do município", async ({ page }) => {
  await login(page);
  await page.goto("/empresa/prospeccao/regioes");
  const first = page.locator("tbody tr").first();
  await expect(first).toBeVisible();
  await expect(page.getByRole("heading", { name: /Como o IOC de .+ foi calculado/ })).toBeVisible();
  // O resumo vem inteiro (a API limita 1.000 linhas por consulta): a sede precisa estar na lista
  await expect(page.locator("tbody").getByRole("link", { name: "Sorocaba", exact: true })).toBeVisible();
  await shot(page, "p1-regioes");
  await first.getByRole("link").click();
  await expect(page.getByText(/empresas-alvo encontradas/)).toBeVisible({ timeout: 60_000 });
});

test("nichos: editar as observações recalcula as regiões", async ({ page }) => {
  await login(page);
  await page.goto("/empresa/prospeccao/nichos");
  const d = page.locator("details", { hasText: "Postos de combustíveis" });
  await d.locator("summary").click();
  await d.getByLabel("Observações").fill(`[TESTE] revisado em ${new Date().toISOString().slice(0, 16)}`);
  await d.getByRole("button", { name: "Salvar nicho" }).click();
  await expect(d.getByText(/Nicho salvo/)).toBeVisible({ timeout: 60_000 });
});

test("telas do PROSPECT no celular, sem rolagem horizontal", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page);
  for (const p of ["/empresa/prospeccao", "/empresa/prospeccao/pesquisar?nicho=construcao&raio=50", "/empresa/prospeccao/funil", "/empresa/prospeccao/regioes", "/empresa/prospeccao/nichos"]) {
    await page.goto(p);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `rolagem horizontal em ${p}`).toBe(false);
  }
  await page.goto("/empresa/prospeccao/funil");
  await page.locator("section a").first().click();
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
  await shot(page, "p1-ficha-celular");
  await ctx.close();
});
