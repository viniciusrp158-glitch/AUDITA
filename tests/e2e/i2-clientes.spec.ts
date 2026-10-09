/**
 * I2 — Fluxo FL-01 no navegador: pesquisar → verificar duplicidade → cadastrar → código →
 * unidade/contato → histórico; edição e inativação. Dados fictícios (ambiente de desenvolvimento).
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

test("FL-01: cadastro completo de cliente com unidade, contato, histórico e inativação", async ({ page }) => {
  const tag = uniqueSuffix();
  const nome = `[Teste automatizado] Indústria Exemplo ${tag} LTDA`;
  const cnpj = randomCnpj();

  await login(page);
  await page.getByRole("link", { name: "Clientes" }).first().click();
  await page.getByRole("link", { name: "Novo cliente" }).click();
  await expect(page.getByText("o cadastro será marcado como")).toBeVisible();

  // Validação no servidor: CNPJ inválido
  await page.getByLabel("Razão social").fill(nome);
  await page.getByLabel("CNPJ").fill("11.222.333/0001-80");
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  await expect(page.getByText("CNPJ inválido.")).toBeVisible();

  await page.getByLabel("CNPJ").fill(cnpj);
  await page.getByLabel("Nome fantasia").fill(`Exemplo ${tag}`);
  await page.getByLabel("Ramo de atividade / segmento").fill("Metalurgia (fictício)");
  await page.getByLabel("Município").fill("Sorocaba");
  await page.getByLabel("UF").selectOption("SP");
  await page.screenshot({ path: `${SHOTS}/10-novo-cliente.png`, fullPage: true });
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();

  // Execuções anteriores deixam clientes de teste com nomes parecidos: o sistema deve pedir confirmação.
  const aviso = page.getByText("Possível cadastro duplicado");
  const criado = page.getByText(/Cliente cadastrado com o código CLI-\d{4,}/);
  await expect(aviso.or(criado)).toBeVisible();
  if (await aviso.isVisible()) {
    await page.getByLabel("Confirmo que é uma empresa/pessoa diferente e quero cadastrar mesmo assim.").check();
    await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  }

  await expect(page.getByText(/Cliente cadastrado com o código CLI-\d{4,}/)).toBeVisible();
  const code = (await page.locator("header").getByText(/^CLI-\d{4,}$/).textContent())!.trim();
  await page.screenshot({ path: `${SHOTS}/11-cliente-criado.png`, fullPage: true });

  // Unidade
  await page.getByRole("link", { name: /Unidades/ }).click();
  await page.getByRole("link", { name: "Nova unidade" }).click();
  await page.getByLabel("Nome da unidade").fill("Matriz Sorocaba");
  await page.getByRole("button", { name: "Adicionar unidade" }).click();
  await expect(page.getByText("Unidade salva.")).toBeVisible();
  await expect(page.getByText("Matriz Sorocaba")).toBeVisible();

  // Contato (exige e-mail ou telefone)
  await page.getByRole("link", { name: /Contatos/ }).click();
  await page.getByRole("link", { name: "Novo contato" }).click();
  await page.getByLabel("Nome").fill("Pessoa Fictícia");
  await page.getByRole("button", { name: "Adicionar contato" }).click();
  await expect(page.getByText("Informe ao menos um e-mail ou telefone.")).toBeVisible();
  await page.getByLabel("E-mail").fill("pessoa.ficticia@exemplo.test");
  await page.getByLabel("Vínculo").selectOption({ label: "Matriz Sorocaba" });
  await page.getByLabel("Contato principal do cliente").check();
  await page.getByRole("button", { name: "Adicionar contato" }).click();
  await expect(page.getByText("Contato salvo.")).toBeVisible();
  await expect(page.getByText("Principal")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/12-contatos.png`, fullPage: true });

  // Pesquisa por código e por CNPJ formatado
  await page.goto(`/clientes?q=${code}`);
  await expect(page.getByRole("link", { name: nome })).toBeVisible();
  await page.goto(`/clientes?q=${encodeURIComponent(cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"))}`);
  await expect(page.getByRole("link", { name: nome })).toBeVisible();
  await page.goto(`/clientes?q=${encodeURIComponent("industria exemplo " + tag.toLowerCase())}`);
  await expect(page.getByRole("link", { name: nome })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/13-lista-pesquisa.png`, fullPage: true });

  // Duplicidade: mesmo CNPJ bloqueia; nome semelhante pede confirmação
  await page.goto("/clientes/novo");
  await page.getByLabel("Razão social").fill(nome.replace("LTDA", "Ltda."));
  await page.getByLabel("CNPJ").fill(cnpj);
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  await expect(page.getByText("Já existe um cliente com este CNPJ/CPF.")).toBeVisible();
  await page.getByLabel("CNPJ").fill("");
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  await expect(page.getByText("Possível cadastro duplicado")).toBeVisible();
  await expect(page.getByText(code).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/14-duplicidade.png`, fullPage: true });

  // Edição e inativação do cliente original
  await page.goto(`/clientes?q=${code}`);
  await page.getByRole("link", { name: nome }).click();
  await page.getByRole("link", { name: "Editar" }).first().click();
  await page.getByLabel("Ramo de atividade / segmento").fill("Metalurgia e usinagem (fictício)");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas.")).toBeVisible();
  await expect(page.getByText("Metalurgia e usinagem (fictício)")).toBeVisible();

  await page.getByLabel("Motivo da inativação").fill("Teste automatizado de inativação");
  await page.getByRole("button", { name: "Inativar cliente" }).click();
  await expect(page.getByText(/Cliente inativo desde/)).toBeVisible();
  await expect(page.locator("header").getByText(code)).toBeVisible();

  // Histórico
  await page.getByRole("link", { name: "Histórico" }).click();
  await expect(page.getByText(/Segmento: Metalurgia \(fictício\) → Metalurgia e usinagem \(fictício\)/)).toBeVisible();
  await expect(page.getByText("Inclusão · Unidade")).toBeVisible();
  await expect(page.getByText("Inclusão · Contato")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/15-historico.png`, fullPage: true });

  // Inativo não aparece no filtro padrão
  await page.goto(`/clientes?q=${code}`);
  await expect(page.getByText("Nenhum cliente encontrado")).toBeVisible();
  await page.goto(`/clientes?q=${code}&situacao=inativos`);
  await expect(page.getByRole("link", { name: nome })).toBeVisible();
});
