/**
 * P5 — Resultados da prospecção (AUDDOC020 RP-13): indicadores por período, conversão por etapa, nicho e canal e
 * exportação CSV; computador e celular. Ambiente de TESTES; nada é gravado.
 */
import { expect, test, type Page } from "@playwright/test";

const OPER = { email: process.env.TEST_OPERADOR_EMAIL!, password: process.env.TEST_OPERADOR_PASSWORD! };
const SHOTS = process.env.E2E_SHOTS_DIR;

async function login(page: Page) {
  await page.goto("/empresa/login");
  await page.getByLabel("E-mail").fill(OPER.email);
  await page.getByLabel("Senha").fill(OPER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/empresa(\/clientes|\/?)$/, { timeout: 60_000 });
}
const shot = async (page: Page, name: string) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

test.skip(!OPER.email, "Defina TEST_OPERADOR_* (ambiente de testes)");

test("resultados: período, conversão, nicho, canal e CSV", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await page.goto("/empresa/prospeccao");
  await page.getByRole("navigation", { name: "Seções da prospecção" }).getByRole("link", { name: "Resultados" }).click();
  await expect(page.getByRole("heading", { name: "Resultados da prospecção" })).toBeVisible();
  const periodo = page.getByRole("navigation", { name: "Período" });
  await expect(periodo.getByRole("link", { name: "30 dias" })).toHaveAttribute("aria-current", "page");
  await periodo.getByRole("link", { name: "Desde o início" }).click();
  await expect(page).toHaveURL(/periodo=tudo/);
  const kpis = page.getByRole("region", { name: "Indicadores" });
  for (const k of ["Pesquisas feitas", "Leads no funil", "Qualificados", "Prioritários", "Contatos", "Respostas", "Reuniões marcadas", "Propostas", "Clientes"])
    await expect(kpis.getByText(k, { exact: true })).toBeVisible();
  // O ambiente de testes já tem leads e contatos (P1/P4): as tabelas aparecem
  await expect(page.getByRole("list", { name: "Conversão por etapa" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Resultados por nicho" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Resultados por canal" })).toBeVisible();
  await shot(page, "p5-resultados");

  const csv = await page.request.get("/empresa/prospeccao/resultados/exportar?periodo=tudo");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-disposition"]).toMatch(/prospeccao_tudo_\d{4}-\d{2}-\d{2}\.csv/);
  const text = await csv.text();
  expect(text.split("\r\n")[0]).toBe("﻿Empresa;Nome fantasia;CNPJ;Município;Nicho;Etapa;Nota;Faixa;Entrou no funil;Contatos no período;Respostas no período;Último contato;Virou cliente");
  expect(text.split("\r\n").length).toBeGreaterThan(3);
});

test("resultados no celular, sem rolagem lateral", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page);
  await page.goto("/empresa/prospeccao/resultados?periodo=tudo");
  await expect(page.getByRole("region", { name: "Indicadores" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow, "rolagem horizontal").toBe(false);
  await shot(page, "p5-celular");
  await ctx.close();
});
