/**
 * Responsividade (decisão do Diretor, 09/10/2026): todas as telas devem funcionar em celular e computador.
 * Percorre as telas internas em larguras de celular e tablet e falha se a página tiver rolagem horizontal.
 */
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };

const PAGES = [
  "/",
  "/clientes",
  "/clientes/novo",
  "/clientes/convites",
  "/clientes/solicitacoes",
  "/demandas",
  "/demandas/nova",
  "/orcamentos",
  "/biblioteca",
  "/biblioteca/novo",
  "/comunicacao",
  "/comunicacao/campanhas",
  "/comunicacao/marca",
  "/comunicacao/pecas/nova",
  "/configuracoes",
  "/configuracoes/atividades",
  "/configuracoes/servicos",
  "/configuracoes/parametros",
  "/configuracoes/modelos",
  "/conta",
  "/caixa",
  "/demandas/servicos",
  "/configuracoes/institucional",
];

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
}

for (const vp of [
  { name: "celular 360px", width: 360, height: 780 },
  { name: "tablet 768px", width: 768, height: 1024 },
]) {
  test(`sem rolagem horizontal — ${vp.name}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: "pt-BR" });
    const page = await ctx.newPage();
    await login(page);

    // Inclui a ficha de um cliente e de um serviço existentes
    await page.goto("/clientes?situacao=todos");
    const clientHref = await page.locator('a[href^="/clientes/"][href*="-"]').first().getAttribute("href");
    await page.goto("/configuracoes/servicos");
    const serviceHref = await page.locator('a[href^="/configuracoes/servicos/"]').first().getAttribute("href");
    await page.goto("/demandas?grupo=todas");
    const demandHref = await page.locator('ul a[href^="/demandas/"]:not([href^="/demandas/servicos"])').first().getAttribute("href");
    await page.goto("/configuracoes/parametros");
    const paramHref = await page.locator('a[href^="/configuracoes/parametros/"]').first().getAttribute("href");
    await page.goto("/orcamentos");
    const quoteHref = await page.locator('ul a[href^="/orcamentos/"]').first().getAttribute("href");
    const quoteItemPages = quoteHref ? [`${quoteHref}/itens/novo`] : [];
    await page.goto("/biblioteca?q=AUDDOC010");
    const libHref = await page.locator('ul a[href^="/biblioteca/"]').first().getAttribute("href");

    const problems: string[] = [];
    for (const path of [...PAGES, clientHref, serviceHref, demandHref, paramHref, quoteHref, ...quoteItemPages, libHref].filter(Boolean) as string[]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) problems.push(`${path}: ${overflow}px`);
    }
    expect(problems, `Telas com rolagem horizontal em ${vp.name}`).toEqual([]);
    await ctx.close();
  });
}
