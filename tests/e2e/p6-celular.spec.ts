/**
 * P6 — Prospecção no celular (pedido do Diretor, 17/11/2026: "a prospecção de clientes vai ser feita via mobile"):
 * funil em lista por etapa, ficha do lead com barra de ações rápidas (WhatsApp, Ligar, E-mail, Registrar) sempre à
 * mão, pesquisa com toque na linha e barra de envio acima dos atalhos. Ambiente de TESTES; nada é gravado.
 */
import { expect, test, type Page } from "@playwright/test";

const OPER = { email: process.env.TEST_OPERADOR_EMAIL!, password: process.env.TEST_OPERADOR_PASSWORD! };
const SHOTS = process.env.E2E_SHOTS_DIR;
const shot = async (page: Page, name: string) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

test.skip(!OPER.email, "Defina TEST_OPERADOR_* (ambiente de testes)");
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "pt-BR" });

test("celular: funil por etapa, ficha com ações rápidas e pesquisa com toque", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/empresa/login");
  await page.getByLabel("E-mail").fill(OPER.email);
  await page.getByLabel("Senha").fill(OPER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/empresa(\/clientes|\/?)$/, { timeout: 60_000 });

  // Funil: faixa de etapas + lista da etapa escolhida (sem o quadro largo)
  await page.goto("/empresa/prospeccao/funil");
  const etapas = page.getByRole("navigation", { name: "Etapas do funil" });
  await expect(etapas).toBeVisible();
  await expect(page.getByTestId("funil-quadro")).toBeHidden();
  const atual = etapas.locator('[aria-current="page"]');
  await expect(atual).toHaveCount(1);
  expect(await noOverflow(page)).toBe(true);
  await shot(page, "p6-funil");
  await etapas.getByRole("link", { name: /^Perdido ou desqualificado/ }).click();
  await expect(page).toHaveURL(/etapa=perdido/);
  await expect(page.getByRole("region", { name: "Leads em Perdido ou desqualificado" })).toBeVisible();
  await etapas.getByRole("link", { name: /^Lead importado/ }).click();
  await page.getByRole("region", { name: "Leads em Lead importado" }).getByRole("link").first().click();

  // Ficha: ações rápidas fixas acima da barra de atalhos, visíveis sem rolar
  const acoes = page.getByRole("group", { name: "Ações rápidas" });
  await expect(acoes).toBeVisible();
  const box = (await acoes.boundingBox())!;
  const nav = (await page.getByRole("navigation", { name: "Atalhos" }).boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(nav.y + 1);
  await expect(acoes.getByRole("link", { name: /WhatsApp/ }).or(acoes.getByText("Sem celular"))).toBeVisible();
  const ligar = acoes.getByRole("link", { name: "Ligar" });
  if (await ligar.count()) await expect(ligar).toHaveAttribute("href", /^tel:\+55\d{10,11}$/);
  const wa = acoes.getByRole("link", { name: /WhatsApp/ });
  if (await wa.count()) await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/55\d{10,11}\?text=/);
  await shot(page, "p6-lead");
  await acoes.getByRole("link", { name: "Registrar" }).click();
  await expect(page.getByLabel("Canal")).toBeInViewport();
  expect(await noOverflow(page)).toBe(true);

  // Pesquisa: tocar na linha marca a empresa; a barra de envio fica acima dos atalhos
  await page.goto("/empresa/prospeccao/pesquisar?nicho=construcao&raio=50");
  await expect(page.getByText(/empresas-alvo encontradas/)).toBeVisible({ timeout: 60_000 });
  const linha = page.locator("tbody tr").filter({ has: page.locator('input[name="cnpj"]') }).first();
  await linha.locator("td").nth(2).click();
  await expect(linha.locator('input[name="cnpj"]')).toBeChecked();
  const envio = page.getByRole("button", { name: "Enviar ao funil" });
  await expect(envio).toBeInViewport();
  const eb = (await envio.boundingBox())!;
  const nb = (await page.getByRole("navigation", { name: "Atalhos" }).boundingBox())!;
  expect(eb.y + eb.height).toBeLessThanOrEqual(nb.y);
  await shot(page, "p6-pesquisa");
});

test("celular: ficha do cliente e demanda com WhatsApp, ligação e e-mail à mão", async ({ page }) => {
  test.setTimeout(150_000);
  const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
  await page.goto("/empresa/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/empresa(\/clientes|\/?)$/, { timeout: 60_000 });
  // Demanda do teste I4 (contato "Responsável Fictício", com e-mail) e a ficha do cliente dela
  await page.goto(`/empresa/demandas?grupo=todas&q=${encodeURIComponent("Treinamento NR-35")}`);
  const dem = page.getByRole("listitem").getByRole("link", { name: /DEM-/ }).first();
  test.skip(!(await dem.count()), "Sem a demanda do teste I4 no ambiente de testes");
  await dem.click();
  let acoes = page.getByRole("group", { name: "Ações rápidas" });
  await expect(acoes.getByRole("link", { name: "E-mail para Responsável Fictício" })).toHaveAttribute("href", /^mailto:responsavel@exemplo\.test\?subject=.*DEM-/);
  expect(await noOverflow(page)).toBe(true);
  await shot(page, "p6-demanda");
  await page.locator("header").getByRole("link", { name: /CLI-/ }).click();
  acoes = page.getByRole("group", { name: "Ações rápidas" });
  await expect(acoes).toBeVisible();
  await expect(acoes.getByRole("link", { name: "E-mail para Responsável Fictício" })).toHaveAttribute("href", /^mailto:responsavel@exemplo\.test\?subject=/);
  await expect(acoes.getByRole("link", { name: "Demanda" })).toHaveAttribute("href", /\/demandas\/nova\?cliente=/);
  const nav = (await page.getByRole("navigation", { name: "Atalhos" }).boundingBox())!;
  const box = (await acoes.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(nav.y + 1);
  expect(await noOverflow(page)).toBe(true);
  await shot(page, "p6-cliente");
});

test("aplicativo na tela inicial: manifesto público, ícones e tela cheia", async ({ page, request }) => {
  await page.goto("/empresa/login");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/empresa/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/empresa/brand/apple-icon-180.png");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#031b35");
  // Sem login: o celular busca o manifesto antes de entrar
  const r = await request.get("/empresa/manifest.webmanifest", { maxRedirects: 0 });
  expect(r.status()).toBe(200);
  const m = await r.json();
  expect(m).toMatchObject({ short_name: "AUDITA", start_url: "/empresa/", scope: "/empresa/", display: "standalone" });
  for (const i of m.icons as { src: string }[]) expect((await request.get(i.src)).status()).toBe(200);
});

test("celular: caixa, registro de atividades e regiões em formato próprio", async ({ page }) => {
  test.setTimeout(150_000);
  const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
  await page.goto("/empresa/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/empresa(\/clientes|\/?)$/, { timeout: 60_000 });

  await page.goto("/empresa/caixa");
  await expect(page.getByTestId("cash-cards")).toBeVisible();
  await expect(page.getByTestId("cash-table")).toBeHidden();
  await expect(page.getByTestId("cash-cards").getByText(/^Saldo de \d{4}$/)).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  await shot(page, "p6-caixa");

  await page.goto("/empresa/configuracoes/atividades");
  const lista = page.getByRole("list", { name: "Atividades" });
  await expect(lista.getByRole("listitem").first()).toBeVisible();
  await expect(page.locator("table")).toBeHidden();
  expect(await noOverflow(page)).toBe(true);

  await page.goto("/empresa/prospeccao/regioes");
  // A coluna de empresas cabe na largura do celular (antes ficava cortada à direita)
  const th = page.getByRole("columnheader", { name: "Empresas" });
  await th.scrollIntoViewIfNeeded();
  const b = (await th.boundingBox())!;
  expect(b.x + b.width).toBeLessThanOrEqual(391);
  await expect(page.getByRole("columnheader", { name: "Distância" })).toBeHidden();
  expect(await noOverflow(page)).toBe(true);
  await shot(page, "p6-regioes");
});
