/**
 * I9.1 — Minha conta, tema claro/escuro, usuário mestre e níveis de acesso no navegador (AUDDOC017 §10).
 * Modo mais restritivo (decisão do Diretor, 10/10/2026). Usuários fictícios de teste.
 */
import { expect, test, type Page } from "@playwright/test";
import { uniqueSuffix } from "../helpers/br";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const OPERADOR = { email: process.env.TEST_OPERADOR_EMAIL!, password: process.env.TEST_OPERADOR_PASSWORD! };
const MARKETING = { email: process.env.TEST_MARKETING_EMAIL!, password: process.env.TEST_MARKETING_PASSWORD! };
const SHOTS = "test-results/telas";

async function login(page: Page, who: { email: string; password: string }, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(who.email);
  await page.getByLabel("Senha").fill(who.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(landing);
}
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

test("mestre: menu com Minha conta e tema; troca para escuro, mantém ao recarregar e volta ao claro", async ({ page }) => {
  await login(page, ADMIN, /\/$/);
  const box = page.getByTestId("user-box");
  await expect(box).toContainText("Usuário mestre");
  await expect(box.getByRole("link", { name: "Minha conta" })).toBeVisible();
  await expect(box.getByText("Alterar senha")).toHaveCount(0);

  const toggle = page.getByTestId("theme-toggle");
  if ((await theme(page)) === "escuro") await toggle.click();
  await expect.poll(() => theme(page)).toBe("claro");
  await toggle.click();
  await expect.poll(() => theme(page)).toBe("escuro");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  // fundo realmente escuro
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(8, 23, 42)");
  await page.waitForTimeout(500);
  await page.reload();
  await expect.poll(() => theme(page)).toBe("escuro");
  await page.screenshot({ path: `${SHOTS}/93-inicio-escuro.png`, fullPage: true });
  await page.goto("/orcamentos");
  await page.locator('a[href^="/orcamentos/"]').first().click();
  await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/);
  await page.screenshot({ path: `${SHOTS}/94-orcamento-escuro.png`, fullPage: true });
  await page.getByTestId("theme-toggle").click();
  await expect.poll(() => theme(page)).toBe("claro");
});

test("mestre cria usuário operador; primeiro acesso exige troca de senha; operador vê só o seu escopo e sem preços", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const tag = uniqueSuffix();
  const email = `e2e.${tag.toLowerCase()}@audita.test`;
  await login(page, ADMIN, /\/$/);
  await page.getByTestId("user-box").getByRole("link", { name: "Minha conta" }).click();
  await expect(page).toHaveURL("/conta");
  await expect(page.getByTestId("master-badge")).toBeVisible();

  // Dados da própria conta
  const profile = page.getByTestId("profile-form");
  await profile.getByLabel(/^Cargo/).fill("Administrador de teste");
  await profile.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.getByText("Dados da conta salvos.")).toBeVisible();

  // Novo usuário: validação e criação
  const form = page.getByTestId("create-user-form");
  await form.getByRole("button", { name: "Criar usuário" }).click();
  await expect(form.getByText("Informe o nome completo.")).toBeVisible();
  await form.getByLabel(/^Nome completo/).fill(`[TESTE] Operador e2e ${tag}`);
  await form.getByLabel(/^E-mail de acesso/).fill(email);
  await form.getByLabel(/^Cargo/).fill("Assistente (fictício)");
  await form.locator('select[name="nivel"]').selectOption("operador");
  await expect(form.getByTestId("role-hint")).toContainText("sem ver preços");
  await form.getByRole("button", { name: "Gerar senha" }).click();
  const provisoria = await form.locator('input[name="senha"]').inputValue();
  expect(provisoria).toMatch(/^[A-Za-z0-9]{16}$/);
  await page.screenshot({ path: `${SHOTS}/95-minha-conta-mestre.png`, fullPage: true });
  await form.getByRole("button", { name: "Criar usuário" }).click();
  await expect(page.getByText(/Usuário criado\./)).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(page.getByTestId("users-list")).toContainText(email);

  // Primeiro acesso do novo usuário
  const ctx = await browser.newContext({ locale: "pt-BR" });
  const op = await ctx.newPage();
  await login(op, { email, password: provisoria }, /\/atualizar-senha\?primeiro=1/);
  await expect(op.getByText(/Primeiro acesso com senha provisória/)).toBeVisible();
  await op.goto("/clientes"); // não escapa da troca
  await expect(op).toHaveURL(/\/atualizar-senha\?primeiro=1/);
  const nova = `Pessoal${tag}2026`;
  await op.getByLabel("Nova senha", { exact: true }).fill(nova);
  await op.getByLabel("Confirmar nova senha").fill(nova);
  await op.getByRole("button", { name: "Salvar senha" }).click();
  await expect(op).toHaveURL(/\/clientes/);

  // Menu e telas do operador
  const nav = op.locator('aside[aria-label="Menu principal"] nav');
  await expect(nav.getByRole("link", { name: "Clientes" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Orçamentos" })).toBeVisible();
  for (const hidden of ["Início", "Biblioteca", "Configurações", "Comunicação"]) await expect(nav.getByRole("link", { name: hidden })).toHaveCount(0);
  await expect(op.getByRole("link", { name: "Link de cadastro" })).toHaveCount(0);
  for (const path of ["/", "/configuracoes/parametros", "/biblioteca", "/clientes/convites"]) {
    await op.goto(path);
    await expect(op).toHaveURL(/\/clientes\?sem_permissao=1/);
    await expect(op.getByTestId("no-permission")).toBeVisible();
  }
  await op.goto("/orcamentos");
  await op.locator('a[href^="/orcamentos/"]').first().click();
  await op.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/);
  await expect(op.getByTestId("operator-flow")).toBeVisible();
  await expect(op.getByTestId("total-unica")).toHaveCount(0);
  await expect(op.getByText("Preço final")).toHaveCount(0);
  await op.screenshot({ path: `${SHOTS}/96-orcamento-operador.png`, fullPage: true });
  await op.goto("/conta");
  await expect(op.getByTestId("users-section")).toHaveCount(0);
  await ctx.close();

  // O mestre inativa o usuário: o acesso cai
  const row = page.getByTestId("user-row").filter({ hasText: email });
  await row.locator('select[name="situacao"]').selectOption("inactive");
  await row.getByRole("button", { name: "Salvar acesso" }).click();
  await expect(row.getByText("Acesso atualizado.")).toBeVisible();
  const ctx2 = await browser.newContext({ locale: "pt-BR" });
  const off = await ctx2.newPage();
  await login(off, { email, password: nova }, /\/sem-acesso/);
  await ctx2.close();
});

test("operador de teste: item do orçamento sem preço, margem ou desconto", async ({ page }) => {
  await login(page, OPERADOR, /\/clientes/);
  await page.goto("/orcamentos");
  // primeira cotação em rascunho com item editável
  const links = page.locator('a[href^="/orcamentos/"]');
  const n = await links.count();
  let opened = false;
  for (let i = 0; i < Math.min(n, 15) && !opened; i++) {
    await page.goto("/orcamentos");
    await links.nth(i).click();
    await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/);
    const edit = page.getByRole("link", { name: "Editar item" }).first();
    if (await edit.count()) {
      await edit.click();
      opened = true;
    }
  }
  expect(opened).toBe(true);
  await expect(page.getByTestId("price-restricted")).toBeVisible();
  await expect(page.getByLabel("Desconto aplicado")).toHaveCount(0);
  await expect(page.getByTestId("item-final-price")).toHaveCount(0);
});

test("marketing: só a própria conta até o I10; celular sem rolagem horizontal", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page, MARKETING, /\/conta/);
  await expect(page.getByTestId("users-section")).toHaveCount(0);
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/conta\?sem_permissao=1/);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const nav = page.locator('aside[aria-label="Menu principal"] nav');
  await expect(nav.getByRole("link")).toHaveCount(0);
  await expect(page.getByTestId("theme-toggle")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/97-conta-marketing-celular.png`, fullPage: true });
  await ctx.close();
});
