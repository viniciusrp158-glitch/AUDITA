/**
 * Frente A — melhoria geral do sistema (docs/PLANEJAMENTO_MELHORIAS_E_PROSPECT.md §2): menu por área (A3), "Meu dia" no
 * Início (A5), busca global (A4), cadastro de cliente pelo CNPJ (A8) e barra inferior no celular (A10).
 * Ambiente de TESTES (dados [TESTE] e base pública de CNPJ); nada é salvo pelo teste.
 */
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const OPER = { email: process.env.TEST_OPERADOR_EMAIL!, password: process.env.TEST_OPERADOR_PASSWORD! };
const SHOTS = process.env.E2E_SHOTS_DIR;

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto("/empresa/login");
  await page.getByLabel("E-mail").fill(who.email);
  await page.getByLabel("Senha").fill(who.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/empresa(\/clientes|\/?)$/, { timeout: 60_000 });
}
const shot = async (page: Page, name: string) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.email || !OPER.email, "Defina TEST_ADMIN_* e TEST_OPERADOR_* (ambiente de testes)");

test("menu por área e Meu dia no Início (administrador)", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, ADMIN);
  const menu = page.getByRole("complementary", { name: "Menu principal" });
  for (const area of ["Comercial", "Operação", "Gestão"]) await expect(menu.getByText(area, { exact: true })).toBeVisible();
  for (const item of ["Início", "Prospecção", "Clientes", "Demandas", "Orçamentos", "Serviços em execução", "Audita Academy", "Caixa", "Biblioteca", "Configurações"])
    await expect(menu.getByRole("link", { name: item, exact: true })).toBeVisible();
  // Notebook comum (1366×768): o menu inteiro cabe na tela, sem rolar (antes, Gestão ficava escondida)
  await page.setViewportSize({ width: 1366, height: 768 });
  const cfg = await menu.getByRole("link", { name: "Configurações" }).boundingBox();
  expect(cfg!.y + cfg!.height, "Configurações fora da tela").toBeLessThanOrEqual(768);
  await page.goto("/empresa/");
  await expect(page.getByRole("region", { name: "Meu dia" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Retornos da prospecção" }).or(page.getByText("Nada pendente para hoje"))).toBeVisible();
  await shot(page, "a-inicio");
  // O item ativo é o mais específico: Serviços em execução, não Demandas
  await menu.getByRole("link", { name: "Serviços em execução" }).click();
  await expect(menu.getByRole("link", { name: "Serviços em execução" })).toHaveAttribute("aria-current", "page");
  await expect(menu.getByRole("link", { name: "Demandas", exact: true })).not.toHaveAttribute("aria-current", "page");
  await menu.getByRole("link", { name: "Caixa" }).click();
  await expect(page).toHaveURL(/\/empresa\/caixa/);
  await expect(menu.getByRole("link", { name: "Caixa" })).toHaveAttribute("aria-current", "page");
});

test("operador vê só a área Comercial; busca global e cadastro pelo CNPJ", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, OPER);
  const menu = page.getByRole("complementary", { name: "Menu principal" });
  await expect(menu.getByText("Comercial", { exact: true })).toBeVisible();
  await expect(menu.getByText("Gestão", { exact: true })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Caixa" })).toHaveCount(0);

  // Um lead do funil para procurar pela busca global
  await page.goto("/empresa/prospeccao/funil");
  const lead = page.locator("section li a").first();
  const leadName = (await lead.locator("span.font-semibold").first().innerText()).trim();
  const term = leadName.replace(/^\[TESTE\]\s*/, "").split(/\s+/).slice(0, 2).join(" ");

  await page.keyboard.press("Control+k");
  const dlg = page.getByRole("dialog", { name: "Busca global" });
  await expect(dlg).toBeVisible();
  await dlg.getByLabel("Termo da busca").fill(term);
  await expect(dlg.getByText("Leads da prospecção")).toBeVisible({ timeout: 30_000 });
  await shot(page, "a-busca");
  await dlg.getByLabel("Termo da busca").press("Enter");
  await expect(page).toHaveURL(/\/empresa\/(prospeccao\/leads|clientes|demandas|orcamentos)\//, { timeout: 30_000 });
  await page.keyboard.press("Control+k");
  await dlg.getByLabel("Termo da busca").fill("zzqqxx");
  await expect(dlg.getByText(/Nada encontrado/)).toBeVisible({ timeout: 30_000 });
  await dlg.getByLabel("Termo da busca").press("Escape");
  await expect(dlg).toHaveCount(0);

  // Cadastro pelo CNPJ: um CNPJ real da base pública (nada é salvo)
  await page.goto("/empresa/prospeccao/pesquisar?nicho=construcao&raio=50&todas=1");
  await expect(page.getByText(/empresas-alvo encontradas/)).toBeVisible({ timeout: 60_000 });
  const cnpj = await page.locator('tbody input[name="cnpj"]').first().getAttribute("value");
  await page.goto("/empresa/clientes/novo");
  await page.getByLabel("CNPJ").fill(cnpj!);
  await page.getByRole("button", { name: "Preencher pelo CNPJ" }).click();
  await expect(page.getByText(/campo\(s\) preenchido\(s\) pela base pública/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Razão social")).not.toHaveValue("");
  await expect(page.getByLabel("Município")).not.toHaveValue("");
  await shot(page, "a-cnpj");
  await page.getByLabel("CNPJ").fill("11.222.333/0001-81");
  await page.getByRole("button", { name: "Preencher pelo CNPJ" }).click();
  await expect(page.getByText(/não encontrado na base pública/)).toBeVisible({ timeout: 30_000 });
});

test("celular: barra inferior, menu completo pelo Mais e telas sem rolagem lateral", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page, ADMIN);
  const bar = page.getByRole("navigation", { name: "Atalhos" });
  await expect(bar).toBeVisible();
  for (const item of ["Início", "Prospecção", "Clientes", "Demandas"]) await expect(bar.getByRole("link", { name: item })).toBeVisible();
  await bar.getByRole("link", { name: "Clientes" }).click();
  await expect(page).toHaveURL(/\/empresa\/clientes/);
  await expect(bar.getByRole("link", { name: "Clientes" })).toHaveAttribute("aria-current", "page");
  await bar.getByRole("button", { name: "Mais" }).click();
  await expect(page.getByRole("complementary", { name: "Menu principal" }).getByRole("link", { name: "Caixa" })).toBeVisible();
  await shot(page, "a-celular-menu");
  for (const p of ["/empresa/", "/empresa/clientes", "/empresa/demandas", "/empresa/orcamentos", "/empresa/caixa", "/empresa/clientes/novo"]) {
    await page.goto(p);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `rolagem horizontal em ${p}`).toBe(false);
  }
  await page.goto("/empresa/");
  await shot(page, "a-celular-inicio");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("dialog", { name: "Busca global" })).toBeVisible();
  await ctx.close();
});
