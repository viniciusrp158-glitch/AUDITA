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
  if ((await theme(page)) === "escuro") {
    const reset = page.waitForResponse((r) => r.request().method() === "POST" && r.status() === 200);
    await toggle.click();
    await reset;
  }
  await expect.poll(() => theme(page)).toBe("claro");
  // a escolha é gravada por uma ação do servidor (conta + cookie): espera a resposta antes de recarregar
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.status() === 200);
  await toggle.click();
  await saved;
  await expect.poll(() => theme(page)).toBe("escuro");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  // fundo realmente escuro
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(8, 23, 42)");
  await page.reload();
  await expect.poll(() => theme(page)).toBe("escuro");
  await page.screenshot({ path: `${SHOTS}/93-inicio-escuro.png`, fullPage: true });
  await page.goto("/orcamentos");
  await page.locator('a[href^="/orcamentos/"]').first().click();
  await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/);
  await page.screenshot({ path: `${SHOTS}/94-orcamento-escuro.png`, fullPage: true });
  const back = page.waitForResponse((r) => r.request().method() === "POST" && r.status() === 200);
  await page.getByTestId("theme-toggle").click();
  await back;
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
  // Blocos fechados ao abrir a página (pedido do Diretor): só os títulos
  for (const t of ["Informações da conta", "Aparência", "Segurança", "Gerenciamento de usuários"])
    await expect(page.locator("summary", { hasText: t })).toBeVisible();
  await expect(page.getByTestId("profile-form")).toBeHidden();
  await page.screenshot({ path: `${SHOTS}/99-minha-conta-fechada.png`, fullPage: true });
  await page.locator("summary", { hasText: "Informações da conta" }).click();
  const profile = page.getByTestId("profile-form");
  await profile.getByLabel(/^Cargo/).fill("Administrador de teste");
  await profile.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.getByText("Dados da conta salvos.")).toBeVisible();

  // Novo usuário: validação e criação
  await page.locator("summary", { hasText: "Gerenciamento de usuários" }).click();
  await page.locator("summary", { hasText: "Novo usuário" }).click();
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
  await expect(page.getByTestId("users-list").first()).toContainText(email);

  // Primeiro acesso do novo usuário
  const ctx = await browser.newContext({ locale: "pt-BR" });
  const op = await ctx.newPage();
  await login(op, { email, password: provisoria }, /\/atualizar-senha\?primeiro=1/);
  await expect(op.getByText(/Primeiro acesso com senha provisória/)).toBeVisible();
  await op.goto("/clientes"); // não escapa da troca
  await expect(op).toHaveURL(/\/atualizar-senha\?primeiro=1/);
  const nova = `Pessoal${tag}2026`;
  await op.locator('input[name="password"]').fill(nova);
  await op.locator('input[name="confirm"]').fill(nova);
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
  await page.locator("summary", { hasText: "Gerenciamento de usuários" }).click();
  const row = page.getByTestId("user-row").filter({ hasText: email });
  await row.locator("summary", { hasText: "Gerenciar acesso e senha" }).click();
  await row.locator('select[name="situacao"]').selectOption("inactive");
  await row.getByRole("button", { name: "Salvar acesso" }).click();
  await expect(page.getByTestId("inactive-users")).toContainText(email); // inativo vai para a lista recolhida
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

test("marketing: só Comunicação (I10) e a própria conta; celular sem rolagem horizontal", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page, MARKETING, /\/comunicacao/);
  await page.goto("/conta");
  await expect(page.getByTestId("users-section")).toHaveCount(0);
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/comunicacao\?sem_permissao=1/);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const nav = page.locator('aside[aria-label="Menu principal"] nav');
  await expect(nav.getByRole("link")).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Comunicação" })).toBeVisible();
  await expect(page.getByTestId("theme-toggle")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/97-conta-marketing-celular.png`, fullPage: true });
  await ctx.close();
});

test("mestre cria outro usuário mestre: mesmas permissões, login próprio, não altera o próprio nível", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const tag = uniqueSuffix();
  const email = `mestre.${tag.toLowerCase()}@audita.test`;
  await login(page, ADMIN, /\/$/);
  await page.goto("/conta");
  await page.locator("summary", { hasText: "Gerenciamento de usuários" }).click();
  await page.locator("summary", { hasText: "Novo usuário" }).click();
  const form = page.getByTestId("create-user-form");
  await form.getByLabel(/^Nome completo/).fill(`[TESTE] Mestre adicional ${tag}`);
  await form.getByLabel(/^E-mail de acesso/).fill(email);
  await form.locator('select[name="nivel"]').selectOption("mestre");
  await expect(form.getByTestId("role-hint")).toContainText("Mesmas permissões e acessos do usuário mestre");
  await form.getByRole("button", { name: "Gerar senha" }).click();
  const provisoria = await form.locator('input[name="senha"]').inputValue();
  await form.getByRole("button", { name: "Criar usuário" }).click();
  await expect(page.getByText(/Usuário criado\./)).toBeVisible({ timeout: 20_000 });

  const ctx = await browser.newContext({ locale: "pt-BR" });
  const m = await ctx.newPage();
  await login(m, { email, password: provisoria }, /\/atualizar-senha\?primeiro=1/);
  const nova = `Mestre${tag}2026`;
  await m.locator('input[name="password"]').fill(nova);
  await m.locator('input[name="confirm"]').fill(nova);
  await m.getByRole("button", { name: "Salvar senha" }).click();
  await expect(m).toHaveURL(/\/$/);
  // mesmo menu do mestre e gestão de usuários disponível
  await expect(m.getByTestId("user-box")).toContainText("Usuário mestre");
  for (const item of ["Início", "Biblioteca", "Configurações"]) await expect(m.locator('aside[aria-label="Menu principal"] nav').getByRole("link", { name: item })).toBeVisible();
  await m.goto("/conta");
  await expect(m.getByTestId("master-badge")).toBeVisible();
  await m.locator("summary", { hasText: "Gerenciamento de usuários" }).click();
  const self = m.getByTestId("user-row").filter({ hasText: email });
  await expect(self).toContainText("você");
  await expect(self.locator("summary", { hasText: "Gerenciar acesso e senha" })).toHaveCount(0);
  const titular = m.getByTestId("user-row").filter({ hasText: ADMIN.email });
  await expect(titular).toContainText("Usuário mestre (titular)");
  await expect(titular.locator("summary", { hasText: "Gerenciar acesso e senha" })).toHaveCount(0);
  await m.screenshot({ path: `${SHOTS}/98-mestre-adicional.png`, fullPage: true });
  await ctx.close();

  // o titular retira o acesso de teste ao final (inativa)
  await page.reload();
  await page.locator("summary", { hasText: "Gerenciamento de usuários" }).click();
  const row = page.getByTestId("user-row").filter({ hasText: email });
  await expect(row).toContainText("Usuário mestre");
  await row.locator("summary", { hasText: "Gerenciar acesso e senha" }).click();
  await row.locator('select[name="situacao"]').selectOption("inactive");
  await row.getByRole("button", { name: "Salvar acesso" }).click();
  await expect(page.getByTestId("inactive-users")).toContainText(email); // inativo vai para a lista recolhida
});
