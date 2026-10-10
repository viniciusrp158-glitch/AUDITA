/**
 * I7 — Biblioteca no navegador (AUDDOC017 RF-19 a RF-22, FL-03, CA-09): acervo oficial importado, novo documento,
 * envio de revisões direto ao bucket privado, publicação com confirmação, histórico preservado, download e celular.
 */
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const SHOTS = "test-results/telas";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
}

async function uploadRevision(page: Page, revision: string, content: string) {
  const form = page.getByTestId("upload-form");
  await form.locator('input[type="file"]').setInputFiles({ name: `Teste ${revision}.docx`, mimeType: DOCX, buffer: Buffer.from(content) });
  await form.getByLabel(/^Revisão/).fill(revision);
  await form.getByRole("button", { name: "Enviar revisão" }).click();
  await expect(page.getByText(`${revision} registrada como rascunho.`)).toBeVisible({ timeout: 20_000 });
}

async function publishDraft(page: Page) {
  const draft = page.getByTestId("draft").first();
  await draft.getByLabel("Aprovado por").fill("[TESTE] Diretor");
  await draft.getByLabel("Data de aprovação").fill("2026-10-10");
  await draft.getByRole("button", { name: "Publicar como vigente" }).click();
}

test("acervo oficial: AUDDOC010-ANX01 vigente, ligado ao modelo técnico; AUDDOC001 (minuta) sem vigente", async ({ page }) => {
  await login(page);
  await page.goto("/biblioteca?q=AUDDOC010");
  await expect(page.getByRole("link", { name: /M01 — Proposta comercial integrada/ }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/70-biblioteca.png`, fullPage: true });
  await page.getByRole("link", { name: /M01 — Proposta comercial integrada/ }).first().click();
  const vig = page.getByTestId("vigente");
  await expect(vig).toContainText("Rev.00");
  await expect(vig).toContainText("a3ee2196337de041f1fb42123ddea8153cd63ae93ca90252e83b38159ea551ab");
  await expect(vig).toContainText("Base dos modelos técnicos do sistema: AUDDOC010-ANX01 v1");
  const href = await vig.getByRole("link", { name: /Baixar Rev\.00/ }).getAttribute("href");
  const res = await page.request.get(href!, { maxRedirects: 0 });
  expect(res.status()).toBe(303);
  expect(res.headers()["location"]).toContain("/storage/v1/object/sign/audita-biblioteca/");
  const file = await page.request.get(res.headers()["location"]);
  expect((await file.body()).subarray(0, 2).toString()).toBe("PK");
  await page.screenshot({ path: `${SHOTS}/71-documento-oficial.png`, fullPage: true });

  await page.goto("/biblioteca?q=AUDDOC001");
  await page.getByRole("link", { name: /Padrão de Documentos AUDITA/ }).first().click();
  await expect(page.getByText("Sem revisão vigente")).toBeVisible();
  await expect(page.getByText(/ARQUIVO DO DOSSIÊ É MINUTA/).first()).toBeVisible();
});

test("FL-03 / CA-09: novo documento, Rev.00 → vigente, Rev.01 substitui e a anterior continua acessível", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  // Anexo de teste AUDDOC9NN-ANXMM sob um documento principal de teste (códigos são permanentes)
  await page.goto("/biblioteca/novo");
  const parentOpt = page.locator('select[name="parent_id"] option', { hasText: /^AUDDOC9\d\d — \[TESTE\]/ }).first();
  const parentLabel = (await parentOpt.textContent())!;
  const parentCode = parentLabel.slice(0, 9);
  let created = false;
  for (let i = 0; i < 15 && !created; i++) {
    const code = `${parentCode}-ANX${String(1 + Math.floor(Math.random() * 99)).padStart(2, "0")}`;
    await page.getByLabel("Código").fill(code);
    await page.getByLabel("Título").fill(`[TESTE] Anexo e2e ${code}`);
    await page.getByLabel("Família").fill("Teste");
    await page.getByLabel("Fase").selectOption("fase3");
    await page.getByLabel("Documento principal (somente anexos)").selectOption({ label: parentLabel });
    await page.getByRole("button", { name: "Cadastrar documento" }).click();
    created = await page
      .getByText("Documento cadastrado. Envie o arquivo da primeira revisão.")
      .waitFor({ timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
  }
  expect(created).toBe(true);
  await expect(page.getByText("Nenhuma revisão vigente")).toBeVisible();

  // Rev.00: envio direto ao bucket privado; publicação exige confirmação
  await uploadRevision(page, "Rev.00", `[TESTE] conteúdo Rev.00 ${Date.now()}`);
  await publishDraft(page);
  await expect(page.getByText("Confirme que o arquivo é a versão aprovada.")).toBeVisible();
  await page.getByTestId("draft").first().getByLabel(/Confirmo que este arquivo é a versão aprovada/).check();
  await page.getByTestId("draft").first().getByRole("button", { name: "Publicar como vigente" }).click();
  await expect(page.getByText(/Revisão publicada como vigente/)).toBeVisible();
  await expect(page.getByTestId("vigente")).toContainText("Rev.00");

  // Rev.01 substitui; Rev.00 continua no histórico e para download
  await uploadRevision(page, "Rev.01", `[TESTE] conteúdo Rev.01 ${Date.now()}`);
  await publishDraft(page);
  await page.getByTestId("draft").first().getByLabel(/Confirmo que este arquivo é a versão aprovada/).check();
  await page.getByTestId("draft").first().getByRole("button", { name: "Publicar como vigente" }).click();
  await expect(page.getByTestId("vigente")).toContainText("Rev.01");
  const history = page.getByTestId("revisions");
  await expect(history.locator("li")).toHaveCount(2);
  await expect(history.locator("li").nth(1)).toContainText("Substituída");
  await expect(history.locator("li").nth(1)).toContainText("Substituída pela Rev.01");
  const oldHref = await history.locator("li").nth(1).getByRole("link", { name: /Baixar/ }).getAttribute("href");
  const old = await page.request.get(oldHref!);
  expect((await old.body()).toString()).toContain("[TESTE] conteúdo Rev.00");

  // Mesma revisão não pode ser enviada de novo
  const form = page.getByTestId("upload-form");
  await form.locator('input[type="file"]').setInputFiles({ name: "x.docx", mimeType: DOCX, buffer: Buffer.from("x") });
  await form.getByLabel(/^Revisão/).fill("Rev.01");
  await form.getByRole("button", { name: "Enviar revisão" }).click();
  await expect(page.getByText(/A Rev\.01 já existe/)).toBeVisible();
  // Tipo não aceito
  await form.locator('input[type="file"]').setInputFiles({ name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
  await form.getByRole("button", { name: "Enviar revisão" }).click();
  await expect(page.getByText(/Tipo de arquivo não aceito/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/72-revisoes-biblioteca.png`, fullPage: true });
});

test("biblioteca no celular: cartões e documento sem rolagem horizontal", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page);
  await page.goto("/biblioteca");
  await expect(page.getByRole("table")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/73-biblioteca-celular.png` });
  await page.goto("/biblioteca?q=AUDDOC011");
  await page.locator('ul a[href^="/biblioteca/"]').first().click();
  await page.waitForURL(/\/biblioteca\/[0-9a-f-]{36}/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/74-documento-celular.png`, fullPage: true });
  await ctx.close();
});
