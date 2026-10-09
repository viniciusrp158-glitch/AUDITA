/**
 * I5 — Parâmetros financeiros e orçamento no navegador (AUDDOC017 RF-09 a RF-14, CA-05/06/07).
 * Parâmetros fictícios de teste: pró-labore 8.000, despesas 2.000, 100 h, tributos 11,2%, taxas 2,99%,
 * comissão 5%, contingência 10%, margem 25%, desconto máx. 10% ⇒ custo/hora R$ 100,00.
 */
import { expect, test, type Page } from "@playwright/test";
import { uniqueSuffix } from "../helpers/br";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const SHOTS = "test-results/telas";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
}

const PARAMS: [string, string][] = [
  ["Pró-labore mensal (R$)", "8.000,00"],
  ["Despesas fixas mensais (R$)", "2.000"],
  ["Horas faturáveis por mês (h)", "100"],
  ["Tributos estimados sobre o preço (%)", "11,2"],
  ["Taxas de recebimento (%)", "2,99"],
  ["Comissão comercial (%)", "5"],
  ["Contingência padrão (%)", "10"],
  ["Margem-alvo (%)", "25"],
  ["Desconto máximo sem aprovação (%)", "10"],
];

test("parâmetros: rascunho com prévia, validação e publicação da versão vigente", async ({ page }) => {
  test.setTimeout(90_000);
  const tag = uniqueSuffix();
  await login(page);
  await page.goto("/configuracoes");
  await page.getByRole("link", { name: /Parâmetros financeiros/ }).click();
  await expect(page.getByRole("heading", { name: "Parâmetros financeiros" })).toBeVisible();

  const cont = page.getByRole("link", { name: /Continuar rascunho/ });
  if (await cont.isVisible()) await cont.click();
  else await page.getByRole("button", { name: "Nova versão" }).click();
  await expect(page.getByRole("button", { name: "Salvar rascunho" })).toBeVisible();

  await page.getByLabel("Nome da versão").fill(`[TESTE] Parâmetros fictícios e2e ${tag}`);
  for (const [label, value] of PARAMS) await page.getByLabel(label).fill(value);
  await expect(page.getByText("Custo/hora técnico:")).toContainText("R$ 100,00");
  await expect(page.getByText("Tributos + taxas + comissão + margem:")).toContainText("44,19%");

  // vazio ⇒ PENDENTE; valor inválido ⇒ erro de campo
  await page.getByLabel("Horas faturáveis por mês (h)").fill("");
  await expect(page.getByText("Custo/hora técnico:")).toContainText("PENDENTE");
  await expect(page.getByText(/Campos sem valor \(1\)/)).toBeVisible();
  await page.getByLabel("Horas faturáveis por mês (h)").fill("cem");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Use números (ex.: 1.234,56).")).toBeVisible();
  await page.getByLabel("Horas faturáveis por mês (h)").fill("100");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Rascunho salvo.")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/50-parametros-rascunho.png`, fullPage: true });

  await page.getByRole("button", { name: "Publicar como vigente" }).click();
  await expect(page.getByText("Confirme a validação dos valores.")).toBeVisible();
  await page.getByLabel(/Confirmo que os valores foram validados/).check();
  await page.getByRole("button", { name: "Publicar como vigente" }).click();
  await expect(page.getByText("Versão publicada: passa a valer para os novos orçamentos.")).toBeVisible();
  await expect(page.getByText("Vigente", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar rascunho" })).toBeHidden(); // imutável
  await page.screenshot({ path: `${SHOTS}/51-parametros-vigente.png`, fullPage: true });
});

test("FL-06: cotação a partir da demanda, itens com prévia, totais único × mensal e alertas", async ({ page }) => {
  test.setTimeout(120_000);
  const tag = uniqueSuffix();
  await login(page);

  // Cliente e demanda fictícios
  await page.goto("/clientes/novo");
  await page.getByLabel("Razão social").fill(`[Teste automatizado] Cliente Orçamento ${tag} LTDA`);
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  const aviso = page.getByText("Possível cadastro duplicado");
  const criado = page.getByText(/Cliente cadastrado com o código/);
  await expect(aviso.or(criado)).toBeVisible();
  if (await aviso.isVisible()) {
    await page.getByLabel("Confirmo que é uma empresa/pessoa diferente e quero cadastrar mesmo assim.").check();
    await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  }
  await expect(criado).toBeVisible();
  await page.getByRole("link", { name: "Demandas e propostas" }).click();
  await page.getByRole("link", { name: "Nova demanda" }).click();
  await page.getByLabel("Resumo da solicitação").fill(`[Teste automatizado] Orçamento NR-35 ${tag}`);
  const nr35 = await page.locator('select[name="service_id"] option', { hasText: "TRN-NR35" }).getAttribute("value");
  await page.getByLabel("Serviço do catálogo").selectOption(nr35!);
  await page.getByRole("button", { name: "Registrar demanda" }).click();
  await expect(page.getByText(/Demanda registrada com o código/)).toBeVisible();

  // Criar cotação (serviço da demanda entra como item 1, ainda PENDENTE sem horas)
  await page.getByRole("button", { name: "Criar cotação" }).click();
  await expect(page.getByText(/Cotação criada com o código PROP-\d{4}-\d{4,}/)).toBeVisible();
  const item1 = page.getByTestId("quote-item").first();
  await expect(item1).toContainText("PENDENTE: CUSTOS / PARÂMETROS");
  await expect(page.getByText(/serviço não liberado comercialmente/i).first()).toBeVisible();
  await expect(page.getByTestId("total-unica")).toContainText("PENDENTE");

  // Editar item 1: prévia ao vivo chega a PRONTO e ao preço do simulador (R$ 4.237,59)
  await item1.getByRole("link", { name: "Editar item" }).click();
  const fills: [string, string][] = [
    ["Preparação", "4"], ["Execução", "10"], ["Entrega / relatório", "3"], ["Acompanhamento", "2"], ["Deslocamento técnico", "0"],
    ["Deslocamentos / pedágios", "150"], ["Materiais", "80"], ["Profissionais externos", "0"], ["Demais custos diretos", "20"],
  ];
  for (const [label, v] of fills) await page.getByLabel(label, { exact: true }).fill(v);
  await expect(page.getByTestId("item-status")).toContainText("PRONTO PARA ANÁLISE INTERNA");
  await expect(page.getByTestId("item-final-price")).toHaveText("R$ 4.237,59");
  await page.screenshot({ path: `${SHOTS}/52-item-previa.png`, fullPage: true });
  await page.getByRole("button", { name: "Salvar item" }).click();
  await expect(page.getByText("Item salvo.")).toBeVisible();
  await expect(page.getByTestId("total-unica")).toHaveText("R$ 4.237,59");

  // Item mensal com desconto acima do máximo: exige justificativa e fica em REVER DESCONTO
  await page.getByRole("link", { name: "Adicionar item" }).click();
  await page.getByLabel("Descrição do item").fill("[Teste] Acompanhamento mensal de SST");
  await page.getByLabel("Periodicidade").selectOption("mensal");
  await page.getByLabel("Execução", { exact: true }).fill("6");
  await page.getByLabel("Demais custos diretos", { exact: true }).fill("0");
  await page.getByLabel("Desconto aplicado").fill("15");
  await expect(page.getByTestId("item-status")).toContainText("REVER DESCONTO");
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await expect(page.getByText("Justifique o desconto (AUDDOC011 §6).")).toBeVisible();
  await page.getByLabel("Justificativa do desconto").fill("Teste automatizado de alerta de desconto");
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await expect(page.getByText("Item salvo.")).toBeVisible();
  await expect(page.getByTestId("quote-item").nth(1)).toContainText("REVER DESCONTO");
  await expect(page.getByTestId("total-unica")).toHaveText("R$ 4.237,59"); // não soma o mensal
  await expect(page.getByTestId("total-mensal")).toContainText("PENDENTE");

  // Condições
  await page.getByLabel("Validade (dias)").fill("400");
  await page.getByRole("button", { name: "Salvar condições" }).click();
  await expect(page.getByText("Informe de 1 a 365 dias.")).toBeVisible();
  await page.getByLabel("Validade (dias)").fill("15");
  await page.getByRole("button", { name: "Salvar condições" }).click();
  await expect(page.getByText("Condições salvas.")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/53-orcamento.png`, fullPage: true });

  // Remoção do item exige confirmação
  await page.getByTestId("quote-item").nth(1).getByRole("link", { name: "Editar item" }).click();
  await page.getByRole("button", { name: "Remover item" }).click();
  await expect(page.getByText("Marque a confirmação para remover.")).toBeVisible();
  await page.getByLabel(/Confirmo a remoção deste item/).check();
  await page.getByRole("button", { name: "Remover item" }).click();
  await expect(page.getByText("Item removido.")).toBeVisible();
  await expect(page.getByTestId("quote-item")).toHaveCount(1);

  // Demanda mostra o orçamento; lista de orçamentos encontra pelo cliente
  const code = (await page.locator("header").getByText(/^PROP-\d{4}-\d{4,}$/).textContent())!.trim();
  await page.getByRole("link", { name: /^DEM-/ }).click();
  await expect(page.getByRole("link", { name: code })).toBeVisible();
  await page.goto(`/orcamentos?q=${encodeURIComponent("cliente orcamento " + tag.toLowerCase())}`);
  await expect(page.getByRole("link", { name: code }).first()).toBeVisible();
});

test("orçamento no celular: cartões, prévia abaixo do formulário e sem rolagem horizontal", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page);
  await page.goto("/orcamentos");
  await expect(page.getByRole("table")).toBeHidden();
  await page.screenshot({ path: `${SHOTS}/54-orcamentos-celular.png` });
  await page.locator('ul a[href^="/orcamentos/"]').first().click();
  await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/55-orcamento-celular.png`, fullPage: true });
  await page.goto(`${page.url().split("?")[0]}/itens/novo`);
  await expect(page.getByTestId("item-status")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/56-item-celular.png`, fullPage: true });
  await page.goto("/configuracoes/parametros");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await ctx.close();
});
