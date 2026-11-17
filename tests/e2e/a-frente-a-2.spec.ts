/**
 * Frente A — 2ª entrega (docs/PLANEJAMENTO_MELHORIAS_E_PROSPECT.md §2): ficha 360° do cliente com linha do tempo (A6),
 * quadro em colunas em Demandas e Orçamentos (A7), exportação CSV das listas (A2/A11) e clientes em cartões no
 * celular (A10). Ambiente de TESTES; nada é gravado pelo teste.
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

/** Ambiente de testes vazio: cadastra um cliente e uma demanda fictícios (só no ambiente de testes, marcados). */
async function ensureDemand(page: Page) {
  await page.goto("/empresa/demandas?grupo=todas");
  await expect(page.getByText(/\d+ demandas? · página/)).toBeVisible();
  if ((await page.locator("table tbody tr").count()) > 0) return;
  const tag = Date.now().toString(36);
  await page.goto("/empresa/clientes/novo");
  await page.getByLabel("Razão social").fill(`[Teste automatizado] Cliente Ficha 360 ${tag} LTDA`);
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  const aviso = page.getByText("Possível cadastro duplicado");
  const criado = page.getByText(/Cliente cadastrado com o código/);
  await expect(aviso.or(criado)).toBeVisible({ timeout: 30_000 });
  if (await aviso.isVisible()) {
    await page.getByLabel("Confirmo que é uma empresa/pessoa diferente e quero cadastrar mesmo assim.").check();
    await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  }
  await expect(criado).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Demandas e propostas" }).click();
  await page.getByRole("link", { name: "Nova demanda" }).click();
  await page.getByLabel("Resumo da solicitação").fill(`[Teste automatizado] PGR da unidade ${tag}`);
  await page.getByRole("button", { name: "Registrar demanda" }).click();
  await expect(page.getByText(/Demanda registrada com o código DEM-/)).toBeVisible({ timeout: 30_000 });
  await page.goto("/empresa/demandas?grupo=todas");
}

/** Abre a ficha de um cliente que tenha demanda (para a linha do tempo ter conteúdo). */
async function openClientWithDemand(page: Page) {
  await ensureDemand(page);
  const first = page.locator("table tbody tr").first();
  const code = (await first.locator("td").nth(2).locator("span.font-mono").innerText()).trim();
  await page.goto(`/empresa/clientes?q=${encodeURIComponent(code)}&situacao=todos`);
  await page.locator("table tbody a").first().click();
  await expect(page.getByRole("navigation", { name: "Seções do cliente" })).toBeVisible();
}

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.email || !OPER.email, "Defina TEST_ADMIN_* e TEST_OPERADOR_* (ambiente de testes)");

test("ficha 360°: resumo e linha do tempo do cliente (administrador)", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, ADMIN);
  await openClientWithDemand(page);
  const resumo = page.getByLabel("Resumo do cliente");
  for (const k of ["Demandas em aberto", "Orçamentos", "Serviços ativos", "Último contato"]) await expect(resumo.getByText(k)).toBeVisible();
  await page.getByRole("link", { name: "Linha do tempo" }).click();
  const linha = page.getByRole("region", { name: "Linha do tempo" });
  await expect(linha).toBeVisible();
  await expect(linha.getByRole("link", { name: /^Tudo \(\d+\)$/ })).toHaveAttribute("aria-current", "page");
  await expect(linha.getByText(/Demanda recebida — DEM-/).first()).toBeVisible();
  await shot(page, "a2-linha-do-tempo");
  // Filtro por tipo
  await linha.getByRole("link", { name: /^Demandas \(\d+\)$/ }).click();
  await expect(page).toHaveURL(/tipo=demanda/, { timeout: 30_000 });
  await expect(linha.getByText(/Proposta emitida/)).toHaveCount(0);
  // Aba de relacionamento agora lista também os orçamentos
  await page.getByRole("link", { name: "Demandas e propostas" }).click();
  await expect(page.getByRole("heading", { name: "Orçamentos e propostas" })).toBeVisible();
});

test("quadro em colunas e exportação CSV (Demandas e Orçamentos)", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, ADMIN);
  await page.goto("/empresa/demandas");
  await page.getByRole("link", { name: "Quadro" }).click();
  await expect(page).toHaveURL(/visao=quadro/, { timeout: 30_000 });
  const quadro = page.getByTestId("quadro");
  await expect(quadro.getByRole("region", { name: "Recebida" })).toBeVisible();
  await expect(quadro.getByRole("region", { name: "Encerrada" })).toHaveCount(0); // grupo "Em aberto"
  await shot(page, "a2-quadro-demandas");
  // O filtro de grupo mantém o quadro
  await page.getByRole("link", { name: "Todas" }).click();
  await expect(page).toHaveURL(/grupo=todas.*visao=quadro|visao=quadro.*grupo=todas/, { timeout: 30_000 });
  await expect(quadro.getByRole("region", { name: "Encerrada" })).toBeVisible();
  await page.getByRole("link", { name: "Lista" }).click();
  await expect(page.locator("table")).toBeVisible();

  const csv = await page.request.get("/empresa/demandas/exportar?grupo=todas");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(csv.headers()["content-disposition"]).toMatch(/demandas_\d{4}-\d{2}-\d{2}\.csv/);
  const text = await csv.text();
  expect(text.split("\r\n")[0]).toBe("﻿Código;Solicitação;Cliente (código);Cliente;Serviço;Recebida;Prazo;Situação;Recorrente;Teste");
  expect(text).toMatch(/\r\nDEM-/);

  await page.goto("/empresa/orcamentos?visao=quadro");
  for (const s of ["Rascunho", "Emitida", "Aceita"]) await expect(page.getByTestId("quadro").getByRole("region", { name: s })).toBeVisible();
  await shot(page, "a2-quadro-orcamentos");
  await page.getByRole("combobox", { name: "Situação" }).selectOption("rascunho");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/situacao=rascunho/, { timeout: 30_000 });
  await expect(page.getByTestId("quadro").getByRole("region")).toHaveCount(1);
  const q = await page.request.get("/empresa/orcamentos/exportar?situacao=rascunho");
  expect(q.status()).toBe(200);
  expect((await q.text()).split("\r\n")[0]).toContain("Código;Demanda;Solicitação");

  const c = await page.request.get("/empresa/clientes/exportar?situacao=todos");
  expect(c.status()).toBe(200);
  expect(await c.text()).toMatch(/\r\nCLI-\d+;/);
});

test("operador: ficha sem serviços/caixa e exportação permitida; sem login a exportação não abre", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await login(page, OPER);
  await openClientWithDemand(page);
  await expect(page.getByLabel("Resumo do cliente").getByText("Serviços ativos")).toHaveCount(0);
  await page.getByRole("link", { name: "Linha do tempo" }).click();
  const linha = page.getByRole("region", { name: "Linha do tempo" });
  await expect(linha.getByRole("link", { name: /^Serviços/ })).toHaveCount(0);
  await expect(linha.getByRole("link", { name: /^Caixa/ })).toHaveCount(0);
  expect((await page.request.get("/empresa/clientes/exportar")).status()).toBe(200);

  const anon = await browser.newContext();
  const r = await anon.request.get("/empresa/demandas/exportar", { maxRedirects: 0 });
  expect(r.status()).toBeGreaterThanOrEqual(300);
  expect(r.headers()["content-type"] ?? "").not.toContain("text/csv");
  await anon.close();
});

test("celular: clientes em cartões, ficha e quadros sem rolagem lateral da página", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page, ADMIN);
  await page.goto("/empresa/clientes");
  await expect(page.getByRole("list", { name: "Clientes" }).getByRole("listitem").first()).toBeVisible();
  await expect(page.locator("table")).toBeHidden();
  await shot(page, "a2-celular-clientes");
  await page.getByRole("list", { name: "Clientes" }).getByRole("link").first().click();
  await expect(page.getByLabel("Resumo do cliente")).toBeVisible();
  const clientUrl = page.url().replace(/\?.*$/, "");
  for (const p of [`${clientUrl}?aba=linha`, "/empresa/demandas?visao=quadro", "/empresa/orcamentos?visao=quadro", "/empresa/clientes"]) {
    await page.goto(p);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `rolagem horizontal em ${p}`).toBe(false);
  }
  await page.goto(`${clientUrl}?aba=linha`);
  await shot(page, "a2-celular-linha");
  await ctx.close();
});
