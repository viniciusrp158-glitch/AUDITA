/**
 * I1 — Fluxo de acesso no navegador (AUDDOC017 CA-01).
 * Usuários fictícios do ambiente de desenvolvimento (variáveis TEST_*).
 */
import { expect, test } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const INTRUSO = { email: process.env.TEST_INTRUSO_EMAIL!, password: process.env.TEST_INTRUSO_PASSWORD! };
const SHOTS = "test-results/telas";

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("sem sessão, qualquer página interna redireciona para o login", async ({ page }) => {
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/login\?motivo=sessao/);
  await expect(page.getByText("Sua sessão expirou ou não foi iniciada")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/01-login.png`, fullPage: true });
});

test("senha incorreta mostra mensagem genérica", async ({ page }) => {
  await login(page, ADMIN.email, "senha-incorreta-000");
  await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
});

test("usuário autenticado sem autorização é bloqueado", async ({ page }) => {
  await login(page, INTRUSO.email, INTRUSO.password);
  await expect(page).toHaveURL(/\/sem-acesso/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.screenshot({ path: `${SHOTS}/02-sem-acesso-retorno.png`, fullPage: true });
});

test("administrador entra, navega, vê a trilha e sai", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: /Olá, Administrador/ })).toBeVisible();

  const menu = page.getByRole("complementary", { name: "Menu principal" });
  for (const item of ["Início", "Clientes", "Demandas", "Orçamentos", "Biblioteca", "Comunicação", "Configurações"]) {
    await expect(menu.getByRole("link", { name: item })).toBeVisible();
  }
  await page.screenshot({ path: `${SHOTS}/03-inicio.png`, fullPage: true });

  await menu.getByRole("link", { name: "Clientes" }).click();
  await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Clientes" })).toHaveAttribute("aria-current", "page");

  await page.goto("/configuracoes/atividades");
  await expect(page.getByRole("cell", { name: "Entrada no sistema" }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/04-atividades.png`, fullPage: true });

  await menu.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login\?motivo=saida/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("layout responsivo no celular", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL("/");
  await page.screenshot({ path: `${SHOTS}/05-celular-inicio.png` });
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("link", { name: "Orçamentos" })).toBeVisible();
  await page.waitForTimeout(400); // aguarda a animação do menu
  await page.screenshot({ path: `${SHOTS}/06-celular-menu.png` });
  await ctx.close();
});
