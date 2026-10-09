/**
 * I3 — Catálogo de serviços no navegador: lista, filtros, ficha, decisão com fundamento, histórico,
 * verificação operacional; computador e celular. A decisão de teste é revertida ao final.
 */
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const SHOTS = "test-results/telas";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
}

test("catálogo: lista, filtros, decisão com fundamento e histórico (computador)", async ({ page }) => {
  const t = Date.now();
  await login(page);
  await page.getByRole("link", { name: "Configurações" }).first().click();
  await page.getByRole("link", { name: /Catálogo de serviços/ }).click();
  await expect(page.getByRole("heading", { name: "Catálogo de serviços" })).toBeVisible();
  await expect(page.getByText(/45 de 45 itens/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/30-catalogo.png`, fullPage: true });

  // Pesquisa por norma e filtro por família
  await page.getByPlaceholder(/Código, nome ou norma/).fill("NR-35");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByRole("link", { name: /Trabalho em altura/ })).toBeVisible();
  await expect(page.getByText(/1 de 45 itens/)).toBeVisible();
  await page.goto("/configuracoes/servicos?familia=Software");
  await expect(page.getByText(/2 de 45 itens/)).toBeVisible();
  await expect(page.getByText("sem cálculo por hora técnica").first()).toBeVisible();

  // Ficha de serviço e decisão
  await page.goto("/configuracoes/servicos?q=ESP-006");
  await page.getByRole("link", { name: /Laudos e projetos de engenharia/ }).click();
  await expect(page.getByText(/não gera proposta comercial final/)).toBeVisible();
  await page.getByRole("button", { name: "Registrar decisão" }).click();
  await expect(page.getByText("Selecione a nova situação.")).toBeVisible();

  await page.getByLabel(/Nova situação/).selectOption("expansao_futura");
  await expect(page.getByText(/Critério \(AUDDOC005 §14\)/)).toBeVisible();
  await page.getByLabel(/Fundamento da decisão/).fill(`[Teste automatizado ${t}] Depende de engenheiro habilitado e ART (AUDDOC005 §12).`);
  await page.getByLabel("Referência / evidência").fill("Teste e2e");
  await page.getByRole("button", { name: "Registrar decisão" }).click();
  await expect(page.getByText("Situação comercial atualizada e registrada no histórico.")).toBeVisible();
  await expect(page.locator("header").getByText("Expansão futura")).toBeVisible();
  await expect(page.getByText(`[Teste automatizado ${t}]`, { exact: false })).toBeVisible();
  await expect(page.getByText("Registro inicial:")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/31-servico-decisao.png`, fullPage: true });

  // Reverte para a situação da AUDDOC004 (fica registrado)
  await page.getByLabel(/Nova situação/).selectOption("nao_liberado");
  await page.getByLabel(/Fundamento da decisão/).fill("[Teste automatizado] Retorno à situação da AUDDOC004 Rev.00 após teste.");
  await page.getByRole("button", { name: "Registrar decisão" }).click();
  await expect(page.locator("header").getByText("Não liberado")).toBeVisible();

  // Verificação operacional (não altera a situação comercial)
  await page.getByLabel("Observações da AUDITA").fill(`PRETENDO OFERECER ESTE SERVIÇO`);
  await page.getByRole("button", { name: "Salvar verificação" }).click();
  await expect(page.getByText("Verificação salva.")).toBeVisible();
});

test("catálogo no celular: cartões, filtros e ficha sem rolagem horizontal", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page);
  await page.goto("/configuracoes/servicos");
  await expect(page.getByRole("heading", { name: "Catálogo de serviços" })).toBeVisible();
  await expect(page.getByRole("table")).toBeHidden();
  await expect(page.getByRole("link", { name: /TRN-NR35/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/32-catalogo-celular.png` });

  await page.getByRole("link", { name: /TRN-NR35/ }).click();
  await expect(page.getByRole("heading", { name: /Trabalho em altura/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar decisão" })).toBeVisible();
  const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow2).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/33-servico-celular.png` });
  await ctx.close();
});
