/**
 * I2.1 — Fluxo completo do autocadastro: gerar link → cliente preenche no celular (sem login) →
 * termo recolhido + aceite → envio único → solicitação pendente → aprovação → cliente com código CLI.
 */
import { expect, test, type Page } from "@playwright/test";
import { randomCnpj, uniqueSuffix } from "../helpers/br";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const SHOTS = "test-results/telas";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
}

test("autocadastro por link individual com aprovação", async ({ page, browser }) => {
  const tag = uniqueSuffix();
  const empresa = `[Teste automatizado] Autocadastro Web ${tag} LTDA`;
  const cnpj = randomCnpj();

  // 1. Administrador gera o link
  await login(page);
  await page.goto("/clientes");
  await page.getByRole("link", { name: "Link de cadastro" }).click();
  await page.getByLabel("Enviar para").fill(`Contato fictício ${tag}`);
  await page.getByRole("button", { name: "Gerar link" }).click();
  const link = (await page.getByTestId("invite-link").textContent())!.trim();
  expect(link).toMatch(/\/cadastro\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByRole("button", { name: "Compartilhar" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/20-link-gerado.png`, fullPage: true });
  await expect(page.getByText(`Contato fictício ${tag}`).first()).toBeVisible();
  const path = new URL(link).pathname;

  // 2. Cliente abre no celular, sem login
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  const c = await mobile.newPage();
  await c.goto(path);
  await expect(c.getByRole("heading", { name: "Cadastro de cliente" })).toBeVisible();
  await c.screenshot({ path: `${SHOTS}/21-formulario-celular.png` });

  await c.getByLabel("Razão social").fill(empresa);
  await c.locator('input[name="tax_id"]').fill(cnpj);
  await c.getByLabel("Município").fill("Sorocaba");
  await c.getByLabel("UF").first().selectOption("SP");
  await c.getByRole("button", { name: "Adicionar unidade" }).click();
  await c.getByLabel("Nome da unidade").fill("Filial Votorantim");
  await c.locator('input[name="contacts.0.full_name"]').fill("Pessoa Fictícia");
  await c.locator('input[name="contacts.0.email"]').fill("pessoa@exemplo.test");

  // Sem aceite do termo: bloqueia
  await c.getByRole("button", { name: "Enviar cadastro" }).click();
  await expect(c.getByText("Para enviar, confirme a leitura e o aceite do termo.")).toBeVisible();
  // Os dados digitados permanecem após o erro (inclusive listas de seleção)
  await expect(c.locator('select[name="address_state"]')).toHaveValue("SP");
  await expect(c.locator('input[name="units.0.name"]')).toHaveValue("Filial Votorantim");
  await expect(c.locator('input[name="tax_id"]')).toHaveValue(cnpj);

  // Termo recolhido, expansível
  await expect(c.getByText("O envio deste formulário não constitui contratação")).toBeHidden();
  await c.getByText("Ler termo completo").click();
  await expect(c.getByText("O envio deste formulário não constitui contratação")).toBeVisible();
  await c.getByLabel(/Li e aceito a declaração/).check();
  await c.screenshot({ path: `${SHOTS}/22-termo-aceite.png`, fullPage: true });
  await c.getByRole("button", { name: "Enviar cadastro" }).click();
  await expect(c.getByRole("heading", { name: "Cadastro enviado" })).toBeVisible();
  await c.screenshot({ path: `${SHOTS}/23-enviado.png` });

  // Link de uso único
  await c.goto(path);
  await expect(c.getByRole("heading", { name: "Cadastro já enviado" })).toBeVisible();
  await mobile.close();

  // 3. Administrador vê "Preenchido", analisa e aprova
  await page.goto("/clientes/convites");
  const row = page.getByRole("listitem").filter({ hasText: `Contato fictício ${tag}` });
  await expect(row.getByText("Preenchido", { exact: true })).toBeVisible();
  await row.getByRole("link", { name: "Analisar solicitação" }).click();
  await expect(page.getByRole("heading", { name: empresa })).toBeVisible();
  await expect(page.getByText("Unidade 1: Filial Votorantim")).toBeVisible();
  await page.getByLabel("Ramo de atividade / segmento").fill("Metalurgia (fictício)");
  await page.screenshot({ path: `${SHOTS}/24-analise.png`, fullPage: true });
  await page.getByRole("button", { name: "Aprovar e cadastrar cliente" }).click();

  const aviso = page.getByText("Possível cadastro duplicado");
  const criado = page.getByText(/Cliente cadastrado com o código CLI-\d{4,}/);
  await expect(aviso.or(criado)).toBeVisible();
  if (await aviso.isVisible()) {
    await page.getByLabel("Confirmo que é uma empresa/pessoa diferente e quero cadastrar mesmo assim.").check();
    await page.getByRole("button", { name: "Aprovar e cadastrar cliente" }).click();
  }
  await expect(criado).toBeVisible();
  await page.getByRole("link", { name: /Unidades/ }).click();
  await expect(page.getByText("Filial Votorantim")).toBeVisible();
  await page.getByRole("link", { name: /Contatos/ }).click();
  await expect(page.getByText("Pessoa Fictícia")).toBeVisible();
  await expect(page.getByText("Principal")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/25-cliente-aprovado.png`, fullPage: true });
});
