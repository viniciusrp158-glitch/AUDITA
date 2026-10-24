import { expect, test, type Page } from "@playwright/test";

/** Site institucional — Etapa 2 (estrutura): home, páginas de soluções e menus, no computador e no celular. */

const PROIBIDOS = [/zero multa/i, /todas as NRs/i, /certificação garantida/i, /acreditad[ao] pela AUDITA/i, /\blaudos?\b(?![^.]*não)/i];

async function semRolagemLateral(page: Page) {
  const larguras = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
  expect(larguras.doc).toBeLessThanOrEqual(larguras.janela);
}

test("home: textos aprovados, seções na ordem, fora dos buscadores", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gestão inteligente para ambientes mais seguros.");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const titulos = await page.getByRole("heading", { level: 2 }).allTextContents();
  const ordem = ["Quem somos", "Nossas soluções", "A AUDITA atende empresas de todos os segmentos.", "Por que a AUDITA", "Como trabalhamos", "Capacitação que gera cultura de segurança.", "Missão, visão e valores", "Vamos organizar a segurança da sua empresa?"];
  const posicoes = ordem.map((t) => titulos.findIndex((h) => h.replace(/\s+/g, " ").trim() === t));
  expect(posicoes.every((p) => p >= 0)).toBe(true);
  expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  // Curso livre: aviso obrigatório; só o L01 publicado aparece
  await expect(page.getByText("Não substituem capacitação obrigatória de NR")).toBeVisible();
  await expect(page.getByText("Segurança do Trabalho: Primeiros Passos para um Ambiente Seguro")).toBeVisible();
  await expect(page.getByText("Fundamentos de EPI e Proteção Coletiva")).toHaveCount(0);
  // Dados oficiais
  await expect(page.locator("footer")).toContainText("69.563.249/0001-01");
  await expect(page.locator("footer")).toContainText("CEP 18079-026");
  const texto = await page.locator("body").innerText();
  for (const p of PROIBIDOS) expect(texto).not.toMatch(p);
  await semRolagemLateral(page);
});

test("links de ação: WhatsApp com mensagem pronta, logins externos em nova aba, cursos na plataforma", async ({ page }) => {
  await page.goto("/");
  const proConhecer = page.locator('a[href*="wa.me/5515996891049"][href*="Audita%20PRO"]');
  await expect(proConhecer).toHaveCount(1);
  for (const login of ["https://auditapro.app.br", "https://auditahub.app.br"]) {
    const links = page.locator(`a[href="${login}"]`);
    expect(await links.count()).toBeGreaterThan(0);
    for (const l of await links.all()) await expect(l).toHaveAttribute("target", "_blank");
  }
  await expect(page.locator('a[href="/treinamentos/cursos/L01"]')).toHaveCount(1);
});

test("página de família: todos os serviços publicados, com limite e pedido de proposta", async ({ page }) => {
  await page.goto("/solucoes/gestao-recorrente-de-sst/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gestão recorrente de SST");
  const cards = page.locator("article.card");
  await expect(cards).toHaveCount(7);
  await expect(page.getByText("Não substitui SESMT dimensionado.")).toBeVisible();
  await expect(page.locator('a[href*="Inspe%C3%A7%C3%B5es%20peri%C3%B3dicas%20de%20SST"]')).toHaveCount(1);
  await page.goto("/solucoes/auditorias-internas-e-sgi/");
  await expect(page.getByText("Nenhuma oferta representa certificação acreditada.")).toBeVisible();
  for (const slug of ["documentos-e-procedimentos", "treinamentos-in-company", "meio-ambiente"]) {
    const r = await page.goto(`/solucoes/${slug}/`);
    expect(r?.status()).toBe(200);
    await semRolagemLateral(page);
  }
});

test("menu: dropdowns no computador e menu em tela cheia no celular", async ({ page, isMobile }) => {
  await page.goto("/");
  if (!isMobile) {
    const solucoes = page.getByRole("button", { name: "Soluções" });
    await solucoes.focus();
    await page.keyboard.press("Enter");
    await expect(solucoes).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Meio Ambiente" }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(solucoes).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Plataformas" }).click();
    await expect(page.getByRole("link", { name: "Conhecer o Audita HUB" })).toBeVisible();
    return;
  }
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: /Soluções/ }).click();
  await expect(menu.getByRole("link", { name: "Gestão recorrente de SST" })).toBeVisible();
  await expect(menu.getByRole("link", { name: /WhatsApp/ })).toBeVisible();
  await menu.getByRole("button", { name: "Fechar menu" }).click();
  await expect(menu).toHaveCount(0);
  await semRolagemLateral(page);
});

test("barra superior cabe numa linha (celular só com WhatsApp e Treinamentos)", async ({ page, isMobile }) => {
  await page.goto("/");
  const topo = page.locator(".topo__linha");
  const caixa = await topo.boundingBox();
  expect(caixa?.height).toBeLessThanOrEqual(40);
  await expect(page.locator(".topo__email")).toBeVisible({ visible: !isMobile });
  const vaza = await topo.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(vaza).toBe(false);
});

test("header fica branco e fixo ao rolar", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header.cab")).not.toHaveClass(/cab--rolado/);
  await page.mouse.wheel(0, 1500);
  await expect(page.locator("header.cab")).toHaveClass(/cab--rolado/);
});

test("Etapa 3: textos da faixa de destaques, logos oficiais e conteúdo que aparece ao rolar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Capacitação AUDITA: Cursos EAD")).toBeVisible();
  await expect(page.getByText("A melhor escolha para sua empresa")).toBeVisible();
  await expect(page.getByText("Atendimento no estado de São Paulo")).toHaveCount(0);
  await expect(page.getByText("Cursos EAD com certificado")).toHaveCount(0);
  // Logos oficiais carregados (largura mínima do manual: 180 px AUDITA, 320 px PRO/HUB no computador)
  for (const img of await page.locator("img.logo").all()) {
    await img.scrollIntoViewIfNeeded();
    const natural = await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth);
    expect(natural).toBeGreaterThan(0);
  }
  const larguraPro = await page.locator('.vidro img[alt="Audita PRO"]').evaluate((el) => el.getBoundingClientRect().width);
  expect(larguraPro).toBeGreaterThanOrEqual(318);
  // Tudo o que entra ao rolar fica visível depois de passar por ele
  const total = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < total; y += 600) await page.mouse.wheel(0, 600);
  await expect(page.locator(".revelar:not(.visivel)")).toHaveCount(0, { timeout: 5000 });
  await semRolagemLateral(page);
});
