/**
 * T2f — Troca do link da videoaula com o curso publicado, no ambiente de desenvolvimento (L01 publicado, M02 com vídeo):
 * link inválido recusado, troca aceita e o link original restaurado no fim.
 */
import { expect, test } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const NEW = "https://youtu.be/aqz-KE-bpKQ";

test("troca o link da videoaula do M02 com a versão publicada", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/empresa", { timeout: 15_000 });
  await page.goto("/treinamentos?q=L01");
  await page.getByTestId("training-list").getByRole("link").first().click();
  await expect(page.getByText(/publicada: somente consulta/)).toBeVisible();
  await page.getByRole("link", { name: /Abrir módulo/ }).nth(1).click();
  const form = page.getByTestId("replace-video");
  const input = form.getByLabel("Trocar o link");
  const original = await input.inputValue();
  expect(original).toMatch(/youtu/);

  await input.fill("https://vimeo.com/123");
  await form.getByRole("button", { name: "Trocar link" }).click();
  await expect(form.getByText(/Cole o link do YouTube/)).toBeVisible();

  await input.fill(NEW);
  await form.getByRole("button", { name: "Trocar link" }).click();
  await expect(form.getByText("Link da videoaula trocado.", { exact: false })).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(page.getByTestId("replace-video").getByLabel("Trocar o link")).toHaveValue(NEW);
  await page.getByTestId("replace-video").screenshot({ path: "test-results/telas/t2f-01-trocar-link.png" });

  // Volta o link original (dados do ambiente de teste)
  await page.getByTestId("replace-video").getByLabel("Trocar o link").fill(original);
  await page.getByTestId("replace-video").getByRole("button", { name: "Trocar link" }).click();
  await expect(page.getByTestId("replace-video").getByText("Link da videoaula trocado.", { exact: false })).toBeVisible({ timeout: 20_000 });
});
