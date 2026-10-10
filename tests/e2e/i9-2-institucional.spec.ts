/**
 * I9.2 — Tela de dados institucionais (AUDDOC013 §3–§4; AUDDOC010-ANX01 "Empresa proponente"; caderno C1/D6).
 * Não publica nada: publicar deixaria uma versão de TESTE vigente no banco de desenvolvimento (a publicação é coberta
 * no teste de integração com PGlite). Reaproveita o rascunho de teste se já existir. Dados fictícios.
 */
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const OPERADOR = { email: process.env.TEST_OPERADOR_EMAIL!, password: process.env.TEST_OPERADOR_PASSWORD! };
const SHOTS = "test-results/telas";

async function login(page: Page, who: { email: string; password: string }, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(who.email);
  await page.getByLabel("Senha").fill(who.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(landing);
}

test("administrador: Configurações → Dados institucionais, prévia com PENDENTE e validação do rascunho", async ({ page }) => {
  await login(page, ADMIN, /\/$/);
  await page.goto("/configuracoes");
  await page.getByRole("link", { name: /Dados institucionais/ }).click();
  await expect(page).toHaveURL(/\/configuracoes\/institucional$/);
  await expect(page.getByRole("heading", { name: "Dados institucionais" })).toBeVisible();
  await expect(page.getByTestId("institutional-status")).toContainText(/PENDENTE|Nenhuma versão publicada|todos os dados essenciais/);
  await expect(page.getByTestId("proposal-preview")).toContainText("Empresa proponente");
  await page.screenshot({ path: `${SHOTS}/i9-2-institucional.png`, fullPage: true });

  const cont = page.getByRole("link", { name: /Continuar rascunho/ });
  if (await cont.count()) await cont.click();
  else await page.getByRole("button", { name: /Preencher dados|Nova versão/ }).click();
  await expect(page).toHaveURL(/\/configuracoes\/institucional\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Rascunho", { exact: true })).toBeVisible();
  await expect(page.getByText("TESTE", { exact: true }).first()).toBeVisible();

  const form = page.getByTestId("institutional-form");
  await form.locator('input[name="cnpj"]').fill("11.444.777/0001-62");
  await form.locator('input[name="address_zip"]').fill("123");
  await form.locator('input[name="email"]').fill("contato@");
  await form.locator('input[name="phone"]').fill("1234");
  await form.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(form.getByRole("alert")).toContainText("Revise os campos destacados.");
  await expect(form).toContainText("CNPJ inválido (dígitos verificadores).");
  await expect(form).toContainText("O CEP precisa ter 8 dígitos.");
  await expect(form).toContainText("E-mail inválido.");
  await expect(form).toContainText("Informe DDD + número (10 ou 11 dígitos).");
  // nada foi gravado: o valor inválido continua só no formulário
  await page.reload();
  await expect(form.locator('input[name="cnpj"]')).not.toHaveValue("11.444.777/0001-62");
  await expect(page.getByTestId("proposal-preview")).toContainText("Rodapé dos documentos");
  await page.screenshot({ path: `${SHOTS}/i9-2-rascunho.png`, fullPage: true });
});

test("operador não acessa os dados institucionais (modo mais restritivo)", async ({ page }) => {
  await login(page, OPERADOR, /\/clientes/);
  await page.goto("/configuracoes/institucional");
  await expect(page).toHaveURL(/sem_permissao=1/);
});

test.describe("celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("tela de dados institucionais sem rolagem horizontal", async ({ page }) => {
    await login(page, ADMIN, /\/$/);
    await page.goto("/configuracoes/institucional");
    await expect(page.getByRole("heading", { name: "Dados institucionais" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/i9-2-institucional-celular.png`, fullPage: true });
  });
});
