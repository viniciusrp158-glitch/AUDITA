/**
 * Falha momentânea de conexão (ex.: erro 526 do Cloudflare durante o conflito de IP de 10/2026): ao navegar entre telas
 * internas, a resposta do servidor falha e o sistema deve mostrar a tela de erro em português (não a tela branca
 * "Application error"), tentar de novo sozinho e voltar a funcionar. Só leitura: não cria dados.
 */
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/empresa");
}

for (const viewport of [
  { name: "computador", size: { width: 1280, height: 800 } },
  { name: "celular", size: { width: 390, height: 844 } },
]) {
  test(`erro de conexão numa navegação mostra a tela em português e se recupera (${viewport.name})`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport.size);
    await login(page);

    // A primeira resposta da navegação para Clientes falha como o Cloudflare responde quando não alcança o servidor
    let falhas = 0;
    await page.route(
      (url) => url.pathname.startsWith("/empresa/clientes"),
      async (route) => {
        if (falhas === 0 && route.request().headers()["rsc"] === "1") {
          falhas++;
          return route.fulfill({ status: 526, contentType: "text/plain", body: "error code: 526" });
        }
        return route.continue();
      },
    );

    await page.goto("/empresa/clientes");
    await expect(page.getByRole("heading", { name: "Clientes" }).first()).toBeVisible();
    // Navegação dentro do sistema (pedido RSC), a que falha no uso real
    await page.goto("/empresa");
    await page.getByRole("link", { name: "Clientes" }).first().click();

    await expect(page.getByText("Application error")).toHaveCount(0);
    // Ou a tentativa automática já recuperou a tela, ou a tela de erro aparece e o botão resolve
    const erro = page.getByTestId("load-error");
    if (await erro.isVisible().catch(() => false)) {
      await expect(erro).toContainText("Não foi possível carregar esta tela");
      await page.getByRole("button", { name: "Tentar de novo" }).click();
    }
    await expect(page.getByRole("heading", { name: "Clientes" }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("load-error")).toHaveCount(0);
  });
}
