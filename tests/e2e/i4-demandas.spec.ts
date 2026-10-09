/**
 * I4 — Fluxo FL-05 no navegador: registrar demanda a partir do cliente → análise → acompanhamento →
 * encerramento; filtros e pesquisa; celular.
 */
import { expect, test, type Page } from "@playwright/test";
import { uniqueSuffix } from "../helpers/br";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const SHOTS = "test-results/telas";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
}

async function createTestClient(page: Page, name: string) {
  await page.goto("/clientes/novo");
  await page.getByLabel("Razão social").fill(name);
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  const aviso = page.getByText("Possível cadastro duplicado");
  const criado = page.getByText(/Cliente cadastrado com o código/);
  await expect(aviso.or(criado)).toBeVisible();
  if (await aviso.isVisible()) {
    await page.getByLabel("Confirmo que é uma empresa/pessoa diferente e quero cadastrar mesmo assim.").check();
    await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  }
  await expect(criado).toBeVisible();
  // unidade e contato para o vínculo da demanda
  await page.getByRole("link", { name: /Unidades/ }).click();
  await page.getByRole("link", { name: "Nova unidade" }).click();
  await page.getByLabel("Nome da unidade").fill("Planta Votorantim");
  await page.getByRole("button", { name: "Adicionar unidade" }).click();
  await expect(page.getByText("Unidade salva.")).toBeVisible();
  await page.getByRole("link", { name: /Contatos/ }).click();
  await page.getByRole("link", { name: "Novo contato" }).click();
  await page.getByLabel("Nome").fill("Responsável Fictício");
  await page.getByLabel("E-mail").fill("responsavel@exemplo.test");
  await page.getByRole("button", { name: "Adicionar contato" }).click();
  await expect(page.getByText("Contato salvo.")).toBeVisible();
}

test("FL-05: demanda do registro ao encerramento", async ({ page }) => {
  const tag = uniqueSuffix();
  const cliente = `[Teste automatizado] Cliente Demanda ${tag} LTDA`;
  const resumo = `[Teste automatizado] Treinamento NR-35 para 12 colaboradores ${tag}`;
  await login(page);
  await createTestClient(page, cliente);

  // A partir da aba do cliente
  await page.getByRole("link", { name: "Demandas e propostas" }).click();
  await expect(page.getByText("Nenhuma demanda registrada para este cliente.")).toBeVisible();
  await page.getByRole("link", { name: "Nova demanda" }).click();
  await expect(page.getByLabel(/^Cliente/)).toHaveValue(/[0-9a-f-]{36}/);

  // Validação: resumo obrigatório
  await page.getByRole("button", { name: "Registrar demanda" }).click();
  await expect(page.getByText("Descreva a solicitação em poucas palavras.")).toBeVisible();

  await page.getByLabel("Resumo da solicitação").fill(resumo);
  await page.getByLabel("Unidade / local").selectOption({ label: "Planta Votorantim" });
  await page.getByLabel("Pessoa de contato").selectOption({ label: "Responsável Fictício" });
  const nr35 = await page.locator('select[name="service_id"] option', { hasText: "TRN-NR35" }).getAttribute("value");
  await page.getByLabel("Serviço do catálogo").selectOption(nr35!);
  await expect(page.getByText(/não gera proposta comercial final/)).toBeVisible();
  await page.getByLabel("Contrato recorrente").check();
  await page.getByLabel(/AUDDOC004 consultada/).check();
  await page.screenshot({ path: `${SHOTS}/40-nova-demanda.png`, fullPage: true });
  await page.getByRole("button", { name: "Registrar demanda" }).click();

  await expect(page.getByText(/Demanda registrada com o código DEM-\d{4}-\d{4,}/)).toBeVisible();
  const code = (await page.locator("header").getByText(/^DEM-\d{4}-\d{4,}$/).textContent())!.trim();
  await expect(page.getByText("Planta Votorantim")).toBeVisible();
  await expect(page.getByText(/Responsável Fictício/)).toBeVisible();
  await expect(page.locator("header").getByText("Recorrente")).toBeVisible();

  // Acompanhamento (visita) e mudanças de situação
  await page.getByLabel("Tipo").selectOption("visita");
  await page.getByLabel("Descrição", { exact: true }).fill("Visita técnica para levantamento do escopo (fictício).");
  await page.getByRole("button", { name: "Registrar acompanhamento" }).click();
  await expect(page.getByText("Acompanhamento registrado.")).toBeVisible();
  await expect(page.getByText("Visita técnica para levantamento do escopo (fictício).")).toBeVisible();

  await page.getByLabel(/Nova situação/).selectOption("em_analise");
  await page.getByRole("button", { name: "Atualizar situação" }).click();
  await expect(page.getByText("Situação atualizada.")).toBeVisible();
  await expect(page.locator("header").getByText("Em análise")).toBeVisible();

  await page.getByLabel(/Nova situação/).selectOption("cancelada");
  await page.getByRole("button", { name: "Atualizar situação" }).click();
  await expect(page.getByText("Informe o motivo.")).toBeVisible();
  await page.getByLabel(/Nova situação/).selectOption("encerrada");
  await page.getByLabel("Observação").fill("Encerrada no teste automatizado.");
  await page.getByRole("button", { name: "Atualizar situação" }).click();
  await expect(page.locator("header").getByText("Encerrada")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/41-demanda.png`, fullPage: true });

  // Lista: some de "Em aberto", aparece em "Encerradas" e na pesquisa por cliente
  await page.goto(`/demandas?q=${code}`);
  await expect(page.getByText("Nenhuma demanda encontrada.")).toBeVisible();
  await page.goto(`/demandas?grupo=encerradas&q=${code}`);
  await expect(page.getByRole("link", { name: resumo }).first()).toBeVisible();
  await page.goto(`/demandas?grupo=todas&q=${encodeURIComponent("cliente demanda " + tag.toLowerCase())}`);
  await expect(page.getByRole("link", { name: resumo }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/42-lista-demandas.png`, fullPage: true });

  // Aba do cliente mostra a demanda
  await page.goto(`/clientes?situacao=todos&q=${encodeURIComponent(tag)}`);
  await page.getByRole("link", { name: cliente }).click();
  await page.getByRole("link", { name: "Demandas e propostas" }).click();
  await expect(page.getByText(code)).toBeVisible();
});

test("demandas no celular: lista em cartões e ficha sem rolagem horizontal", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page);
  await page.goto("/demandas?grupo=todas");
  await expect(page.getByRole("heading", { name: "Demandas" })).toBeVisible();
  await expect(page.getByRole("table")).toBeHidden();
  await page.screenshot({ path: `${SHOTS}/43-demandas-celular.png` });
  await page.locator('a[href^="/demandas/"][href*="-"]').first().click();
  await expect(page.getByRole("button", { name: "Atualizar situação" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/44-demanda-celular.png`, fullPage: true });
  await page.goto("/demandas/nova");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await ctx.close();
});
