/**
 * T1 — Treinamentos no navegador: novo treinamento (Módulo 01 automático), módulos, envio de materiais direto ao
 * bucket privado (apostila e slides em imagem), ficha técnica, publicação com confirmação, versão congelada,
 * abertura do arquivo por link assinado e tela de celular. Ambiente de DESENVOLVIMENTO; dados "[TESTE]".
 */
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const SHOTS = "test-results/telas";
const PDF = (label: string) => Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/empresa");
}

async function upload(page: Page, slot: string, files: { name: string; mimeType: string; buffer: Buffer }[]) {
  const box = page.getByTestId(`slot-${slot}`);
  await box.locator('input[type="file"]').setInputFiles(files);
  for (const f of files) await expect(box.getByRole("link", { name: f.name })).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ mode: "serial" });

test("cadastro, materiais, publicação e versão congelada", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  const code = `TST${String(Math.floor(Math.random() * 900) + 100)}`;

  await page.goto("/treinamentos/novo");
  await page.getByLabel("Código").fill(code);
  await page.getByLabel("Versão do material").fill("1.0");
  await page.getByLabel("Título").fill("[TESTE] Treinamento fictício de verificação");
  await page.getByRole("button", { name: "Cadastrar treinamento" }).click();
  await expect(page.getByText("Treinamento cadastrado.")).toBeVisible({ timeout: 20_000 });
  const courseUrl = page.url();
  await expect(page.getByTestId("module-list")).toContainText("Ambientação");

  // Novo módulo vai para o fim
  await page.getByLabel("Novo módulo").fill("[TESTE] Fundamentos fictícios");
  await page.getByRole("button", { name: "Incluir módulo" }).click();
  await expect(page.getByTestId("module-list")).toContainText("[TESTE] Fundamentos fictícios", { timeout: 20_000 });
  await page.screenshot({ path: `${SHOTS}/t1-01-treinamento.png`, fullPage: true });

  // Módulo 02: apostila, link do YouTube e slides em imagem (ordem pelo número do nome)
  await page.getByRole("link", { name: /Abrir módulo/ }).nth(1).click();
  await expect(page.getByRole("heading", { name: "[TESTE] Fundamentos fictícios" })).toBeVisible();
  await upload(page, "apostila", [{ name: "TST_M02_Apostila.pdf", mimeType: "application/pdf", buffer: PDF("apostila M02") }]);
  await upload(page, "slide_imagem", [
    { name: "TST_M02_Slide_02.png", mimeType: "image/png", buffer: PNG },
    { name: "TST_M02_Slide_01.png", mimeType: "image/png", buffer: PNG },
  ]);
  const slides = await page.getByTestId("slot-slide_imagem").getByRole("link").allTextContents();
  expect(slides).toEqual(["TST_M02_Slide_01.png", "TST_M02_Slide_02.png"]);
  await page.getByLabel("Link da videoaula no YouTube").fill("https://vimeo.com/123");
  await page.getByRole("button", { name: "Salvar módulo" }).click();
  await expect(page.getByText(/Cole o link do YouTube/)).toBeVisible();
  await page.getByLabel("Link da videoaula no YouTube").fill("https://youtu.be/abcdefghijk");
  await page.getByLabel("Videoaula (min)").fill("15");
  await page.getByRole("button", { name: "Salvar módulo" }).click();
  await expect(page.getByText("Módulo salvo.")).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${SHOTS}/t1-02-modulo.png`, fullPage: true });

  // Abrir o arquivo: link assinado e temporário do bucket privado
  const href = await page.getByTestId("slot-apostila").getByRole("link", { name: "TST_M02_Apostila.pdf" }).getAttribute("href");
  const res = await page.request.get(href!, { maxRedirects: 0 });
  expect(res.status()).toBe(303);
  expect(res.headers()["location"]).toContain("/storage/v1/object/sign/audita-treinamentos/");

  // Ambientação também precisa da apostila para publicar
  await page.getByRole("link", { name: /M01 · Ambientação/ }).click();
  await expect(page.getByRole("heading", { name: "Ambientação", level: 1 })).toBeVisible();
  await upload(page, "apostila", [{ name: "TST_M01_Apostila.pdf", mimeType: "application/pdf", buffer: PDF("apostila M01") }]);

  // Ficha técnica: carga horária
  await page.goto(`${courseUrl.replace(/^.*\/empresa/, "")}?aba=ficha`);
  await page.getByLabel("Carga horária (minutos)").fill("60");
  await page.getByRole("button", { name: "Salvar ficha técnica" }).click();
  await expect(page.getByText("Ficha técnica salva.")).toBeVisible({ timeout: 20_000 });

  // Publicar exige confirmação; depois a versão fica só para consulta
  await page.getByRole("tab", { name: "Versões" }).click();
  await page.getByRole("button", { name: "Publicar versão" }).click();
  await expect(page.getByText("Confirme antes de publicar.")).toBeVisible();
  await page.getByLabel(/Revisei a ficha técnica/).check();
  await page.getByRole("button", { name: "Publicar versão" }).click();
  await expect(page.getByText("Versão publicada.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("version-list")).toContainText("Publicada");
  await page.getByRole("tab", { name: "Módulos e materiais" }).click();
  await expect(page.getByText(/somente consulta/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Incluir módulo" })).toHaveCount(0);
  await page.getByRole("link", { name: /Abrir módulo/ }).nth(1).click();
  await expect(page.getByRole("button", { name: /Enviar|Substituir/ })).toHaveCount(0);

  // Nova versão copia módulos e arquivos
  await page.goto(`${courseUrl.replace(/^.*\/empresa/, "")}?aba=versoes`);
  await page.getByRole("button", { name: "Criar nova versão" }).click();
  await expect(page.getByText("Nova versão criada")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("module-list")).toContainText("Apostila ✓");
});

test("celular: lista e treinamento sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/treinamentos");
  await page.getByTestId("training-list").getByRole("link").first().click();
  await expect(page.getByTestId("module-list")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/t1-03-celular.png`, fullPage: true });
});
