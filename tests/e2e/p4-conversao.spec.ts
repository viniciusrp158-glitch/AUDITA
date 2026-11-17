/**
 * P4 — Conversão do lead em cliente (AUDDOC020 RP-12): formulário preenchido pelo lead e pela Receita, verificação por
 * CNPJ, vínculo do lead e próximo passo (abrir a demanda). A mudança automática de etapa com a proposta é testada no
 * banco (tests/integration/prospect-p1.test.ts). Ambiente de TESTES: cria um cliente fictício a partir de um lead.
 */
import { expect, test, type Page } from "@playwright/test";

const OPER = { email: process.env.TEST_OPERADOR_EMAIL!, password: process.env.TEST_OPERADOR_PASSWORD! };
const SHOTS = process.env.E2E_SHOTS_DIR;

async function login(page: Page) {
  await page.goto("/empresa/login");
  await page.getByLabel("E-mail").fill(OPER.email);
  await page.getByLabel("Senha").fill(OPER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/empresa(\/clientes|\/?)$/, { timeout: 60_000 });
}
const shot = async (page: Page, name: string) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

test.skip(!OPER.email, "Defina TEST_OPERADOR_* (ambiente de testes)");

test("lead → cliente: formulário preenchido, vínculo e verificação por CNPJ", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  // Um lead do funil ainda sem cliente
  await page.goto("/empresa/prospeccao/funil");
  const hrefs = await page.locator("section li a").evaluateAll((as) => as.slice(0, 25).map((a) => a.getAttribute("href")!));
  let leadUrl = "";
  for (const h of hrefs) {
    await page.goto(h);
    if (await page.getByRole("link", { name: "Converter em cliente" }).count()) {
      leadUrl = page.url();
      break;
    }
  }
  test.skip(!leadUrl, "Nenhum lead sem cliente no funil do ambiente de testes");
  const leadName = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
  await shot(page, "p4-lead-converter");

  await page.getByRole("link", { name: "Converter em cliente" }).click();
  await expect(page.getByRole("heading", { name: "Converter lead em cliente" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Dados preenchidos pelo lead/)).toBeVisible();
  await expect(page.getByLabel("Razão social")).not.toHaveValue("");
  await expect(page.getByLabel("CNPJ")).toHaveValue(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
  await shot(page, "p4-formulario");
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  const aviso = page.getByLabel("Confirmo que é uma empresa/pessoa diferente e quero cadastrar mesmo assim.");
  const criado = page.getByText(/Cliente cadastrado com o código/);
  await expect(aviso.or(criado)).toBeVisible({ timeout: 30_000 });
  if (await aviso.isVisible()) {
    await aviso.check();
    await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  }
  await expect(criado).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/O lead da prospecção ficou vinculado a este cliente/)).toBeVisible();
  const clientUrl = page.url().replace(/\?.*$/, "");

  // Na ficha do lead: vinculado, com o próximo passo
  await page.goto(leadUrl);
  await expect(page.getByText(/Vinculado ao cliente/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir demanda" })).toHaveAttribute("href", /\/demandas\/nova\?cliente=[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: "Converter em cliente" })).toHaveCount(0);
  await shot(page, "p4-lead-vinculado");

  // Verificação por CNPJ: abrir de novo a conversão não deixa cadastrar em duplicidade
  await page.goto(`${leadUrl.replace(/.*\/prospeccao\/leads\//, "/empresa/clientes/novo?lead=")}`);
  await expect(page.getByText(/Este lead já está vinculado a um cliente/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cadastrar cliente" })).toHaveCount(0);

  // A ficha 360° do cliente mostra a prospecção
  await page.goto(`${clientUrl}?aba=linha`);
  await expect(page.getByRole("region", { name: "Linha do tempo" }).getByText("Entrou na prospecção")).toBeVisible();
  expect(leadName.length).toBeGreaterThan(0);
});
