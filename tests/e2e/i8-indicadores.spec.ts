/**
 * I8 — Painel do Início (AUDDOC017 RF-29, RF-30, §14, CA-11): indicadores, período, dados de teste, alertas e celular.
 */
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const SHOTS = "test-results/telas";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
}

test("painel: indicadores do mês com dados de teste, troca de período, exclusão de testes e alertas", async ({ page }) => {
  await login(page);
  // Desenvolvimento: dados de teste incluídos por padrão, com aviso
  await expect(page.getByTestId("period-label")).toContainText("Inclui dados de TESTE");
  for (const id of ["kpi-clients", "kpi-open", "kpi-quoted", "kpi-accepted", "kpi-conversion", "kpi-ticket", "kpi-demands", "kpi-received"])
    await expect(page.getByTestId(id)).toBeVisible();
  expect(Number(await page.getByTestId("kpi-clients").textContent())).toBeGreaterThan(0);
  await expect(page.getByTestId("kpi-quoted")).toContainText("R$");
  await expect(page.getByText(/não dinheiro recebido/)).toBeVisible();
  await expect(page.getByTestId("stages")).toBeVisible();
  // Gráficos (pedido do Diretor): evolução de 6 meses, etapas, conversão e prazos, cada um com "Como ler"
  await expect(page.getByTestId("chart-monthly").getByTestId("month-group")).toHaveCount(6);
  for (const id of ["chart-monthly", "stages", "chart-conversion", "chart-demands"])
    await expect(page.getByTestId(id).getByText("Como ler:")).toBeVisible();
  await expect(page.getByTestId("split-decisions")).toContainText("Aceitas:");
  // Alertas em vermelho-claro, acima dos indicadores
  const alert = page.getByTestId("alert").first();
  await expect(alert).toBeVisible();
  expect(await alert.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(253, 236, 235)");
  await page.screenshot({ path: `${SHOTS}/80-painel.png`, fullPage: true });

  // Sem dados de teste: no desenvolvimento tudo é fictício, então os números zeram e a conversão fica "sem dados"
  await page.getByTestId("toggle-test").click();
  await expect(page.getByTestId("period-label")).toContainText("Sem dados de teste");
  await expect(page.getByTestId("kpi-clients")).toHaveText("0");
  await expect(page.getByTestId("kpi-quoted")).toHaveText("R$ 0,00");
  await expect(page.getByTestId("kpi-conversion")).toHaveText("sem dados");
  await expect(page.getByTestId("split-decisions")).toContainText("Nenhuma resposta de cliente no período");

  // Período personalizado sem movimento
  await page.goto("/?periodo=personalizado&de=2000-01-01&ate=2000-01-31&teste=1");
  await expect(page.getByTestId("period-label")).toContainText("01/01/2000 a 31/01/2000");
  await expect(page.getByTestId("kpi-quoted")).toHaveText("R$ 0,00");
  await expect(page.getByTestId("kpi-received")).toHaveText("0");
  await expect(page.getByTestId("kpi-ticket")).toHaveText("sem dados");

  // Mês anterior pelo seletor
  await page.goto("/");
  await page.locator('select[name="periodo"]').selectOption("mes_anterior");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/periodo=mes_anterior/);
  await expect(page.getByTestId("period-label")).toContainText("01/09/2026 a 30/09/2026");

  // Andamento do desenvolvimento continua acessível (recolhido)
  await page.getByText("Andamento do desenvolvimento").click();
  await expect(page.getByText("Indicadores gerenciais")).toBeVisible();
});

test("painel no celular sem rolagem horizontal", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page);
  await expect(page.getByTestId("kpi-clients")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/81-painel-celular.png`, fullPage: true });
  await ctx.close();
});
