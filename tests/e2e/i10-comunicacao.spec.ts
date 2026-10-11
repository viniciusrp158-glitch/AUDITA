/**
 * I10 — Comunicação sem IA no navegador (FL-04): logo oficial aprovado → marketing cria peça (briefing + texto) → prévia →
 * envia para revisão → administrador revisa marca e texto e aprova → exportação registrada. Operador sem acesso; celular.
 * Dados fictícios marcados TESTE. O logo de teste usa o arquivo do próprio sistema (public/brand/audita-logo.png).
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { uniqueSuffix } from "../helpers/br";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const MARKETING = { email: process.env.TEST_MARKETING_EMAIL!, password: process.env.TEST_MARKETING_PASSWORD! };
const OPERADOR = { email: process.env.TEST_OPERADOR_EMAIL!, password: process.env.TEST_OPERADOR_PASSWORD! };
const SHOTS = "test-results/telas";
const LOGO_TITLE = "[TESTE] Logo AUDITA (arquivo do sistema)";

async function login(page: Page, who: { email: string; password: string }, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(who.email);
  await page.getByLabel("Senha").fill(who.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(landing);
}
async function as(browser: Browser, who: { email: string; password: string }, landing: RegExp, mobile = false) {
  const ctx = await browser.newContext({ locale: "pt-BR", ...(mobile ? { viewport: { width: 390, height: 844 } } : {}) });
  const page = await ctx.newPage();
  await login(page, who, landing);
  return { ctx, page };
}

test("FL-04: logo aprovado → peça do marketing → revisão do administrador → exportação registrada", async ({ browser }) => {
  test.setTimeout(180_000);
  const tag = uniqueSuffix();
  const admin = await as(browser, ADMIN, /\/$/);

  // 1) Biblioteca de marca: garante um PNG aprovado da AUDITA (reaproveita o de teste se já existir)
  await admin.page.goto("/comunicacao/marca");
  const existing = admin.page.getByRole("link", { name: new RegExp(LOGO_TITLE.replace(/[[\]()]/g, "\\$&")) });
  if (await existing.count()) {
    await existing.first().click();
  } else {
    await admin.page.locator("summary", { hasText: "Cadastrar ativo de marca" }).click();
    const f = admin.page.getByTestId("asset-form");
    await f.locator('select[name="brand"]').selectOption("audita");
    await f.locator('select[name="variant"]').selectOption("original_png");
    await f.locator('input[name="title"]').fill(LOGO_TITLE);
    await f.getByRole("button", { name: "Cadastrar ativo" }).click();
    await expect(admin.page.getByText("Ativo cadastrado.")).toBeVisible();
  }
  if ((await admin.page.getByText("Aprovado", { exact: true }).count()) === 0) {
    const up = admin.page.getByTestId("brand-upload");
    await up.locator('input[type="file"]').setInputFiles("public/brand/audita-logo.png");
    await up.locator('input[name="source_note"]').fill("[TESTE] Arquivo do logo usado pelo sistema, sem alteração");
    await up.getByRole("button", { name: "Enviar nova versão" }).click();
    await expect(up.getByText(/Versão registrada/)).toBeVisible({ timeout: 30_000 });
    const versions = admin.page.getByTestId("asset-versions");
    await versions.getByRole("button", { name: "Aprovar versão" }).first().click();
    await expect(admin.page.getByText("Confirme a conferência com o arquivo oficial.")).toBeVisible();
    await versions.getByLabel(/Conferi com o arquivo oficial/).first().check();
    await versions.getByRole("button", { name: "Aprovar versão" }).first().click();
    await expect(admin.page.getByText(/Versão aprovada\./)).toBeVisible();
  }

  // 2) Marketing: briefing → texto → prévia → envio
  const mkt = await as(browser, MARKETING, /\/comunicacao/);
  await mkt.page.getByRole("link", { name: "Nova peça" }).click();
  const nf = mkt.page.getByTestId("new-piece-form");
  await nf.locator('select[name="template"]').selectOption("post_quadrado");
  await nf.locator('input[name="theme"]').fill(`[TESTE] Integração de SST ${tag}`);
  await nf.locator('select[name="channel"]').selectOption("linkedin");
  await nf.getByRole("button", { name: /Criar peça/ }).click();
  await expect(mkt.page).toHaveURL(/\/comunicacao\/pecas\/[0-9a-f-]{36}/);
  await expect(mkt.page.getByText(/Peça criada\./)).toBeVisible();
  const pieceUrl = mkt.page.url().split("?")[0];

  const pf = mkt.page.getByTestId("piece-form");
  await pf.locator('input[name="title"]').fill(`[TESTE] Integração de novos colaboradores ${tag}`);
  await pf.locator('input[name="subtitle"]').fill("Orientações iniciais claras e registradas.");
  await pf.locator('textarea[name="body"]').fill("Com a AUDITA, zero multas.");
  await expect(pf.getByText(/zero multa/)).toBeVisible(); // aviso de tom de voz (AUDDOC003 §11)
  await pf.locator('textarea[name="body"]').fill("Texto fictício: riscos do ambiente, regras de conduta e canais de comunicação.");
  await pf.locator('input[name="cta"]').fill("Fale com a AUDITA");
  await pf.locator('textarea[name="caption"]').fill("[TESTE] Legenda fictícia da publicação.");
  await pf.getByRole("button", { name: "Salvar e atualizar a prévia" }).click();
  await expect(pf.getByText("Rascunho salvo.")).toBeVisible();
  const preview = mkt.page.getByTestId("piece-preview");
  await expect.poll(async () => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth), { timeout: 20_000 }).toBe(1080);
  await mkt.page.screenshot({ path: `${SHOTS}/i10-peca-rascunho.png`, fullPage: true });
  await mkt.page.getByRole("button", { name: "Enviar para revisão" }).click();
  await expect(mkt.page.getByText("Peça enviada para revisão do administrador.")).toBeVisible();
  await expect(mkt.page.getByText("Aguardando a revisão do administrador.")).toBeVisible();
  await expect(mkt.page.getByTestId("review-form")).toHaveCount(0);

  // 3) Administrador: revisão com checklist obrigatório → aprovação → exportação PNG registrada
  await admin.page.goto(pieceUrl);
  const rf = admin.page.getByTestId("review-form");
  await rf.getByRole("button", { name: "Aprovar e autorizar exportação" }).click();
  await expect(rf.getByRole("alert")).toContainText("Confirme todos os itens da revisão");
  for (const box of await rf.locator('input[type="checkbox"]').all()) await box.check();
  await rf.getByRole("button", { name: "Aprovar e autorizar exportação" }).click();
  await expect(admin.page.getByText("Peça aprovada: exportação liberada e registrada.")).toBeVisible();
  const download = admin.page.waitForEvent("download");
  await admin.page.getByTestId("export-buttons").getByRole("link", { name: "Exportar PNG" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^TESTE_COM-\d{4}-\d{4}_v1\.png$/);
  await admin.page.reload();
  await expect(admin.page.getByTestId("exports")).toContainText("PNG · versão 1");
  await expect(admin.page.getByText("[TESTE] Legenda fictícia da publicação.")).toBeVisible();
  await admin.page.screenshot({ path: `${SHOTS}/i10-peca-aprovada.png`, fullPage: true });

  // 4) Marketing também exporta (PDF) a versão aprovada
  await mkt.page.goto(pieceUrl);
  const pdf = mkt.page.waitForEvent("download");
  await mkt.page.getByTestId("export-buttons").getByRole("link", { name: "Exportar PDF" }).click();
  expect((await pdf).suggestedFilename()).toMatch(/_v1\.pdf$/);

  // 5) Limpeza: o administrador cancela a peça de teste (inativação lógica)
  await admin.page.locator("summary", { hasText: "Cancelar peça" }).click();
  await admin.page.getByLabel("Motivo do cancelamento").fill("[TESTE] fim do teste automatizado");
  await admin.page.getByRole("button", { name: "Cancelar peça" }).click();
  await expect(admin.page.getByText("Peça cancelada.")).toBeVisible();
  await admin.ctx.close();
  await mkt.ctx.close();
});

test("operador não acessa Comunicação; marketing no celular sem rolagem horizontal", async ({ browser }) => {
  const op = await as(browser, OPERADOR, /\/clientes/);
  await op.page.goto("/comunicacao");
  await expect(op.page).toHaveURL(/sem_permissao=1/);
  await op.ctx.close();

  const mkt = await as(browser, MARKETING, /\/comunicacao/, true);
  for (const path of ["/comunicacao", "/comunicacao/pecas/nova", "/comunicacao/campanhas", "/comunicacao/marca"]) {
    await mkt.page.goto(path);
    expect(await mkt.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(1);
  }
  await mkt.page.goto("/comunicacao/marca");
  await expect(mkt.page.getByText("Você vê somente as versões aprovadas.")).toBeVisible();
  await expect(mkt.page.getByTestId("new-asset")).toHaveCount(0);
  await mkt.page.goto("/comunicacao");
  await mkt.page.screenshot({ path: `${SHOTS}/i10-comunicacao-celular.png`, fullPage: true });
  await mkt.ctx.close();
});
