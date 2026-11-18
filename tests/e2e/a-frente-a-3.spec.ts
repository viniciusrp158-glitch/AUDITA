/**
 * Frente A — formulários (A9) e filtros salvos (A11): máscaras de digitação, rascunho automático no aparelho, foco no
 * primeiro campo com erro e filtros salvos nas listas. Ambiente de TESTES; nada é gravado no banco pelo teste.
 */
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const SHOTS = process.env.E2E_SHOTS_DIR;

async function login(page: Page) {
  await page.goto("/empresa/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/empresa(\/clientes|\/?)$/, { timeout: 60_000 });
}
const shot = async (page: Page, name: string) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.email, "Defina TEST_ADMIN_* (ambiente de testes)");

test("formulário de cliente: máscaras, rascunho e foco no primeiro erro", async ({ page }) => {
  test.setTimeout(150_000);
  await login(page);
  await page.goto("/empresa/clientes/novo");
  // Começa sem rascunho anterior
  await page.evaluate(() => localStorage.removeItem("audita:rascunho:cliente-novo"));
  await page.reload();

  const cnpj = page.getByLabel("CNPJ");
  await cnpj.pressSequentially("11222333000181");
  await expect(cnpj).toHaveValue("11.222.333/0001-81");
  const fone = page.getByLabel("Telefone");
  await fone.pressSequentially("15991234567");
  await expect(fone).toHaveValue("(15) 99123-4567");
  const cep = page.getByLabel("CEP");
  await cep.pressSequentially("18035000");
  await expect(cep).toHaveValue("18035-000");
  const cnae = page.getByLabel("CNAE principal");
  await cnae.pressSequentially("4120400");
  await expect(cnae).toHaveValue("4120-4/00");

  // Rascunho: some ao recarregar e volta com "Recuperar rascunho"
  await page.getByLabel("Razão social").fill("[TESTE] Rascunho automático LTDA");
  await expect(page.getByText(/Rascunho guardado neste aparelho/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Razão social")).toHaveValue("");
  await expect(page.getByText(/Há um rascunho não enviado deste formulário/)).toBeVisible();
  await shot(page, "a3-rascunho");
  await page.getByRole("button", { name: "Recuperar rascunho" }).click();
  await expect(page.getByLabel("Razão social")).toHaveValue("[TESTE] Rascunho automático LTDA");
  await expect(page.getByLabel("Telefone")).toHaveValue("(15) 99123-4567");
  // Descartar apaga
  await page.reload();
  await page.getByRole("button", { name: "Descartar" }).click();
  await page.reload();
  await expect(page.getByText(/Há um rascunho não enviado/)).toHaveCount(0);

  // Erro de validação: o cursor vai para o campo com problema (CNPJ com dígito verificador errado)
  await page.getByLabel("Razão social").fill("[TESTE] Validação LTDA");
  await page.getByLabel("CNPJ").pressSequentially("11222333000199");
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  await expect(page.getByLabel("CNPJ")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("CNPJ")).toBeFocused();
  await shot(page, "a3-primeiro-erro");
});

test("filtros salvos nas listas", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await page.goto("/empresa/demandas");
  await page.evaluate(() => localStorage.removeItem("audita:filtros:demandas"));
  await page.goto("/empresa/demandas?grupo=todas&situacao=recebida");
  const grupo = page.getByRole("group", { name: "Filtros salvos" });
  await grupo.getByRole("button", { name: "+ Salvar este filtro" }).click();
  await grupo.getByLabel("Nome do filtro").fill("Recebidas");
  await grupo.getByRole("button", { name: "Salvar" }).click();
  await expect(grupo.getByRole("link", { name: "Recebidas" })).toHaveAttribute("aria-current", "true");
  // Em outra visita, o filtro salvo reabre a lista filtrada
  await page.goto("/empresa/demandas");
  await page.getByRole("group", { name: "Filtros salvos" }).getByRole("link", { name: "Recebidas" }).click();
  await expect(page).toHaveURL(/grupo=todas/);
  await expect(page).toHaveURL(/situacao=recebida/);
  await shot(page, "a3-filtros-salvos");
  await page.getByRole("button", { name: "Remover o filtro salvo Recebidas" }).click();
  await expect(page.getByRole("link", { name: "Recebidas" })).toHaveCount(0);
});
