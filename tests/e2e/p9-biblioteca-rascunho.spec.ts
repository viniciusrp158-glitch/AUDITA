/**
 * P9 — Rascunhos da Biblioteca visíveis (pedido do Diretor em 20/11/2026): o alerta do painel "documento em rascunho"
 * levava a uma Biblioteca onde nada indicava o rascunho. Agora a Biblioteca lista "Aguardando sua aprovação", filtra por
 * rascunho e o alerta leva ao documento (um só rascunho) ou à lista filtrada (vários). Ambiente de TESTES: cria um
 * documento fictício "[TESTE]" na faixa AUDDOC9NN.
 */
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp("/empresa/?$"), { timeout: 30_000 });
}

test.skip(!ADMIN.email, "Defina TEST_ADMIN_* (ambiente de testes)");

test("rascunho aparece na Biblioteca e o alerta do painel leva até ele", async ({ page }) => {
  test.setTimeout(150_000);
  await login(page);

  // Documento fictício com a Rev.00 em rascunho
  await page.goto("/biblioteca/novo");
  let code = "";
  let created = false;
  for (let i = 0; i < 15 && !created; i++) {
    code = `AUDDOC9${String(10 + Math.floor(Math.random() * 90))}`;
    await page.locator('input[name="doc_code"]').fill(code);
    await page.locator('input[name="title"]').fill(`[TESTE] Rascunho e2e ${code}`);
    await page.locator("#family").fill("Teste");
    await page.locator('select[name="phase"]').selectOption("fase3");
    await page.getByRole("button", { name: "Cadastrar documento" }).click();
    created = await page
      .getByText("Documento cadastrado. Envie o arquivo da primeira revisão.")
      .waitFor({ timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
  }
  expect(created).toBe(true);
  const docUrl = page.url();
  const form = page.getByTestId("upload-form");
  await form.locator('input[type="file"]').setInputFiles({ name: "Teste Rev.00.docx", mimeType: DOCX, buffer: Buffer.from(`[TESTE] ${Date.now()}`) });
  await form.getByLabel(/^Revisão/).fill("Rev.00");
  await form.getByRole("button", { name: "Enviar revisão" }).click();
  await expect(page.getByText("Rev.00 registrada como rascunho.")).toBeVisible({ timeout: 20_000 });

  // Biblioteca: bloco "Aguardando sua aprovação" com link direto ao documento
  await page.goto("/biblioteca");
  const waiting = page.getByRole("region", { name: "Aguardando sua aprovação" });
  const link = waiting.getByRole("link", { name: `${code} Rev.00 — [TESTE] Rascunho e2e ${code}` });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(docUrl);
  await expect(page.getByText("Rascunho Rev.00 — aguardando aprovação")).toBeVisible();

  // Filtro só de rascunhos
  await page.goto("/biblioteca?rascunho=1");
  await expect(page.getByText("Mostrando só documentos com revisão em rascunho.")).toBeVisible();
  await expect(page.getByRole("link", { name: `[TESTE] Rascunho e2e ${code}` }).first()).toBeVisible();

  // Painel: o alerta leva ao documento (um rascunho) ou à lista filtrada (vários) — nunca à Biblioteca sem indicação
  await page.goto("/");
  const alert = page.getByTestId("alerts").getByRole("link", { name: /revisão\(ões\) de documento da biblioteca em rascunho/ });
  await expect(alert).toBeVisible();
  expect(await alert.getAttribute("href")).toMatch(/\/empresa\/biblioteca(\/[0-9a-f-]{36}|\?rascunho=1)$/);
  await alert.click();
  await expect(page.getByText(/Rascunho Rev\.\d\d — aguardando aprovação|Mostrando só documentos com revisão em rascunho\./).first()).toBeVisible();

  // Celular: o bloco cabe sem rolagem horizontal
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/biblioteca");
  await expect(page.getByRole("region", { name: "Aguardando sua aprovação" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
