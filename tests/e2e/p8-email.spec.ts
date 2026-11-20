/**
 * P8 — E-mail de apresentação pelo sistema (AUDDOC020 Rev.01, RP-09/RNF-P04). Ambiente de TESTES: nada é enviado de
 * verdade (envios "simulados"); a chave usada é fictícia. Configuração só do administrador com a chave nunca devolvida,
 * envio individual pelo cartão, lote bloqueado até a validação jurídica e depois liberado, descadastro público.
 */
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const OPER = { email: process.env.TEST_OPERADOR_EMAIL!, password: process.env.TEST_OPERADOR_PASSWORD! };
const SHOTS = process.env.E2E_SHOTS_DIR;
const shot = async (page: Page, name: string) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto("/empresa/login");
  await page.getByLabel("E-mail").fill(who.email);
  await page.getByLabel("Senha").fill(who.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/empresa(\/clientes|\/?)$/, { timeout: 60_000 });
}
async function setLegalDate(page: Page, value: string) {
  await page.goto("/empresa/configuracoes/email-prospeccao");
  await page.getByLabel("Data da validação jurídica").fill(value);
  await page.getByRole("button", { name: "Salvar configuração" }).click();
  await expect(page.getByText(/Configuração salva/)).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.email || !OPER.email, "Defina TEST_ADMIN_* e TEST_OPERADOR_* (ambiente de testes)");

test("administrador configura o e-mail; a chave é guardada cifrada e nunca volta à tela", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, ADMIN);
  await page.goto("/empresa/configuracoes");
  await page.getByRole("link", { name: /E-mail da prospecção/ }).click();
  await expect(page.getByText(/Ambiente de testes: nenhum e-mail é enviado de verdade/)).toBeVisible();
  await page.getByLabel("Nome do remetente").fill("[TESTE] Vinicius | AUDITA");
  await page.getByLabel("Chave do Brevo").fill("xkeysib-TESTE-chave-ficticia-0000000000");
  await page.getByLabel("Data da validação jurídica").fill("");
  await page.getByRole("button", { name: "Salvar configuração" }).click();
  await expect(page.getByText("Configuração salva. A chave foi guardada cifrada.")).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByLabel("Chave do Brevo")).toHaveValue("");
  await expect(page.getByLabel("Chave do Brevo")).toHaveAttribute("placeholder", /já configurada/);
  expect(await page.content()).not.toContain("chave-ficticia");
  const sit = page.getByRole("list", { name: "Situação do envio" });
  await expect(sit.getByText("Chave do Brevo guardada (cifrada)")).toBeVisible();
  await expect(sit.getByText("Validação jurídica (libera o envio em lote)")).toBeVisible();
  await shot(page, "p8-config");
  // Limite acima do decidido é recusado
  await page.getByLabel("Limite máximo por dia").fill("150");
  await page.getByRole("button", { name: "Salvar configuração" }).click();
  await expect(page.getByText("Máximo 100 por dia (decisão do Diretor).")).toBeVisible();
});

test("operador: envio pelo cartão; lote bloqueado sem a validação jurídica", async ({ page }) => {
  test.setTimeout(150_000);
  await login(page, OPER);
  await page.goto("/empresa/prospeccao/oportunidades?grupo=quente");
  const lote = page.getByRole("region", { name: "E-mail em lote" });
  await expect(lote.getByText(/bloqueado até o registro da validação jurídica/)).toBeVisible();
  // Procura uma empresa com e-mail entre as primeiras
  const card = page.getByRole("article", { name: "Empresa em análise" });
  for (let i = 0; i < 10 && !(await card.getByRole("button", { name: "Enviar e-mail" }).count()); i++) await page.goto(`/empresa/prospeccao/oportunidades?grupo=quente&i=${i + 1}`);
  const cnpj = await card.getByTestId("cnpj").innerText();
  await card.getByRole("button", { name: "Enviar e-mail" }).click();
  await expect(page.getByText(/E-mail simulado \(ambiente de testes: nada foi enviado\)/)).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => card.getByTestId("cnpj").innerText(), { timeout: 30_000 }).not.toBe(cnpj);
});

test("com a validação jurídica registrada, o lote envia (simulado) até o limite", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await login(page, ADMIN);
  await setLegalDate(page, "2026-11-19");
  await expect(page.getByRole("list", { name: "Situação do envio" }).getByText(/Validação jurídica em 19\/11\/2026 — lote liberado/)).toBeVisible();

  const ctx = await browser.newContext();
  const op = await ctx.newPage();
  await login(op, OPER);
  await op.goto("/empresa/prospeccao/oportunidades?grupo=morno");
  const lote = op.getByRole("region", { name: "E-mail em lote" });
  await lote.getByLabel("Quantidade de e-mails").fill("2");
  await lote.getByRole("button", { name: "Enviar 2" }).click();
  await expect(lote.getByText(/2 e-mail\(s\) simulado\(s\)/)).toBeVisible({ timeout: 60_000 });
  await shot(op, "p8-lote");
  await ctx.close();

  // Volta ao estado inicial (lote bloqueado) para as próximas execuções
  await setLegalDate(page, "");
});

test("descadastro público: confirmação com um toque, sem revelar se o código existe", async ({ page }) => {
  await page.goto(`/empresa/descadastro?t=${"0".repeat(48)}`);
  await expect(page.getByRole("button", { name: "Não quero receber mais contatos" })).toBeVisible();
  await page.getByRole("button", { name: "Não quero receber mais contatos" }).click();
  await expect(page.getByText("Pronto. Não vamos mais entrar em contato com a sua empresa.")).toBeVisible({ timeout: 30_000 });
});
