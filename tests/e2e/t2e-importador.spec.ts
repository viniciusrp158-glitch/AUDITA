/**
 * T2e — Importador do pacote .zip, no ambiente de desenvolvimento, com o pacote real do L01 (E2E_PACKAGE_ZIP):
 * conferência (7 módulos, 141 arquivos, 45 questões, ficha lida), bloqueio da versão que já existe, importação com
 * outro código e título "[TESTE]", e o treinamento criado em rascunho com arquivos, questões e a nota mínima da final.
 * Requer PDFTOTEXT_PATH no .env.local.
 */
import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const ZIP = process.env.E2E_PACKAGE_ZIP;
const SHOTS = "test-results/telas";
const CODE = `TZ${String(Date.now() % 1000).padStart(3, "0")}`;

test.skip(!ZIP || !existsSync(ZIP), "Defina E2E_PACKAGE_ZIP com o caminho do pacote .zip do L01");

test("importa o pacote do L01 com conferência e cria o rascunho completo", async ({ page }) => {
  test.setTimeout(900_000);
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/empresa");

  await page.goto("/treinamentos");
  await page.getByRole("link", { name: /Importar pacote/ }).click();
  await page.getByTestId("package-input").setInputFiles(ZIP!);
  const review = page.getByTestId("package-review");
  await expect(review).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("package-summary")).toContainText("7 módulos · 141 arquivos");
  await expect(page.getByTestId("package-summary")).toContainText("45 questões");
  await expect(review).toContainText("Perigos e riscos no ambiente de trabalho");
  await expect(review).toContainText("10 objetivas, 1 abertas · nota mínima 7");
  await expect(page.getByTestId("package-target")).toContainText("Carga horária 4 h · instrutor Vinicius Rocha Pereira");
  await expect(page.getByTestId("package-warnings")).toHaveCount(0);
  // O L01 v1.2 já existe: a importação fica bloqueada até mudar a versão (ou o código)
  await expect(page.getByText(/A versão 1\.2 do L01 já existe/)).toBeVisible();
  await expect(page.getByTestId("package-import")).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/t2e-01-conferencia-pacote.png`, fullPage: true });

  await review.getByLabel("Código").fill(CODE);
  await review.getByLabel("Título").fill("[TESTE] Importação do pacote L01");
  await expect(page.getByTestId("package-target")).toContainText("Treinamento novo.");
  await page.getByTestId("package-import").click();
  await expect(page.getByTestId("import-progress")).toBeVisible();
  const done = page.getByTestId("import-done");
  await expect(done).toBeVisible({ timeout: 780_000 });
  await expect(done).toContainText("7 módulos e 141 arquivos");
  await expect(done).toContainText("45 questões gravadas em 7 módulos.");
  await page.screenshot({ path: `${SHOTS}/t2e-02-importado.png` });

  await done.getByRole("link", { name: "Abrir o treinamento" }).click();
  const list = page.getByTestId("module-list");
  await expect(list).toContainText("Perigos e riscos no ambiente de trabalho");
  await expect(list).toContainText("3 · Avaliação 11 questões · nota 7");
  await expect(page.getByText("Apostilas: 7 de 7")).toBeVisible();
  await expect(page.getByText("Avaliações com questões: 7 de 7")).toBeVisible();
  await expect(page.getByText("Carga horária: 4 h")).toBeVisible();
  await expect(list.locator("li").first()).toContainText("Equipe: roteiro · gabarito · slides · 12 imagens");
  await page.screenshot({ path: `${SHOTS}/t2e-03-treinamento-criado.png`, fullPage: true });
});
