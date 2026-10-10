/**
 * I6 — Revisão, emissão e decisão no navegador (AUDDOC017 RF-14 a RF-17, RF-22, RF-24, CA-08; AUDDOC010 M01/M02).
 * Usa serviço com liberação FICTÍCIA no ambiente de desenvolvimento (TRN-001) e parâmetros de teste.
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

const CONTENT: [string, string][] = [
  ["Objetivo e necessidade do cliente", "[Teste] Capacitar novos colaboradores nas orientações introdutórias de SST."],
  ["Escopo incluído (atividades e limites)", "[Teste] Duas turmas de integração de até 15 participantes."],
  ["Exclusões / depende de contratação", "[Teste] Treinamentos por NR específicos, laudos e ART."],
  ["Local / modalidade", "[Teste] Presencial na unidade do cliente — Sorocaba/SP."],
  ["Prazo / vigência", "[Teste] Execução em até 15 dias após o aceite."],
  ["Metodologia", "[Teste] Aula expositiva com exemplos do ambiente do cliente."],
  ["Entregáveis", "[Teste] Lista de presença e registro da atividade."],
  ["Critério de conclusão", "[Teste] Realização das turmas e entrega dos registros."],
  ["Pagamento", "[Teste] À vista, 10 dias após a realização."],
  ["Despesas adicionais", "[Teste] Não se aplica."],
  ["Reagendamento e cancelamento", "[Teste] Reagendamento sem custo com 48 h de antecedência."],
];

/** Cliente com CNPJ e contato, demanda com serviço liberado (teste) e cotação criada. */
async function prepareQuote(page: Page, tag: string, serviceCode = "TRN-001") {
  await page.goto("/clientes/novo");
  await page.getByLabel("Razão social").fill(`[Teste automatizado] Cliente Emissão ${tag} LTDA`);
  await page.getByLabel("CNPJ").fill(randomCnpj());
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  const aviso = page.getByText("Possível cadastro duplicado");
  const criado = page.getByText(/Cliente cadastrado com o código/);
  await expect(aviso.or(criado)).toBeVisible();
  if (await aviso.isVisible()) {
    await page.getByLabel("Confirmo que é uma empresa/pessoa diferente e quero cadastrar mesmo assim.").check();
    await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  }
  await expect(criado).toBeVisible();
  await page.getByRole("link", { name: /Contatos/ }).click();
  await page.getByRole("link", { name: "Novo contato" }).click();
  await page.getByLabel("Nome").fill("Responsável Fictício");
  await page.getByLabel("E-mail").fill("responsavel@exemplo.test");
  await page.getByRole("button", { name: "Adicionar contato" }).click();
  await expect(page.getByText("Contato salvo.")).toBeVisible();

  await page.getByRole("link", { name: "Demandas e propostas" }).click();
  await page.getByRole("link", { name: "Nova demanda" }).click();
  await page.getByLabel("Resumo da solicitação").fill(`[Teste automatizado] Integração de SST ${tag}`);
  await page.getByLabel("Pessoa de contato").selectOption({ label: "Responsável Fictício" });
  const svc = await page.locator('select[name="service_id"] option', { hasText: serviceCode }).first().getAttribute("value");
  await page.getByLabel("Serviço do catálogo").selectOption(svc!);
  await page.getByRole("button", { name: "Registrar demanda" }).click();
  await expect(page.getByText(/Demanda registrada com o código/)).toBeVisible();
  await page.getByRole("button", { name: "Criar cotação" }).click();
  await expect(page.getByText(/Cotação criada com o código PROP-\d{4}-\d{4,}/)).toBeVisible();
}

async function priceFirstItem(page: Page) {
  await page.getByTestId("quote-item").first().getByRole("link", { name: "Editar item" }).click();
  await page.getByLabel("Execução", { exact: true }).fill("19");
  await page.getByLabel("Demais custos diretos", { exact: true }).fill("250");
  await expect(page.getByTestId("item-final-price")).toHaveText("R$ 4.237,59");
  await page.getByRole("button", { name: "Salvar item" }).click();
  await expect(page.getByText("Item salvo.")).toBeVisible();
}

test("FL-02: revisão congelada → emissão DOCX/PDF com marca d'água → download → aceite → nova revisão", async ({ page }) => {
  test.setTimeout(170_000);
  const tag = uniqueSuffix();
  await login(page);
  await prepareQuote(page, tag);

  // Pendências listadas antes da revisão
  const blockers = page.getByTestId("review-blockers");
  await expect(blockers).toContainText("Validade (dias) não informada");
  await expect(blockers).toContainText("Objetivo e necessidade do cliente não preenchido");
  await expect(blockers).toContainText("não estão PRONTO");

  await priceFirstItem(page);

  // Conteúdo do M01 (campos do catálogo já vêm pré-preenchidos e são substituídos)
  await page.getByLabel("Validade (dias)").fill("15");
  for (const [label, value] of CONTENT) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Salvar conteúdo" }).click();
  await expect(page.getByText("Conteúdo da proposta salvo.")).toBeVisible();
  await expect(page.getByTestId("review-blockers")).toBeHidden();
  await page.screenshot({ path: `${SHOTS}/60-orcamento-pronto-revisao.png`, fullPage: true });

  // Concluir Rev.00 → itens travados
  await page.getByRole("button", { name: "Concluir revisão Rev.00" }).click();
  await expect(page.getByText("Revisão concluída e congelada.")).toBeVisible();
  await expect(page.locator("header").getByText("Rev.00")).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar item" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Adicionar item" })).toHaveCount(0);

  // Emitir: aviso de marca d'água no ambiente de teste
  await expect(page.getByText(/sairão com a marca “DOCUMENTO DE TESTE — SEM VALIDADE COMERCIAL”/)).toBeVisible();
  await page.getByRole("button", { name: "Emitir proposta" }).click();
  await expect(page.getByText("Proposta emitida: documentos DOCX e PDF gerados e arquivados.")).toBeVisible({ timeout: 30_000 });
  const flow = page.getByTestId("flow");
  await expect(flow).toContainText(/Rev\.00 emitida em \d{2}\/\d{2}\/\d{4}/);
  await page.screenshot({ path: `${SHOTS}/61-proposta-emitida.png`, fullPage: true });

  // Download: link interno → URL assinada de curta duração do bucket privado
  const pdfHref = await flow.getByRole("link", { name: /PDF/ }).getAttribute("href");
  const res = await page.request.get(pdfHref!, { maxRedirects: 0 });
  expect(res.status()).toBe(303);
  const signed = res.headers()["location"];
  expect(signed).toContain("/storage/v1/object/sign/audita-documentos/");
  const file = await page.request.get(signed);
  expect((await file.body()).subarray(0, 5).toString()).toBe("%PDF-");
  const docx = await page.request.get((await flow.getByRole("link", { name: /DOCX/ }).getAttribute("href"))!);
  expect((await docx.body()).subarray(0, 2).toString()).toBe("PK");

  // Sem sessão o link não funciona
  const anon = await page.context().browser()!.newContext();
  const denied = await anon.request.get(new URL(pdfHref!, page.url()).toString(), { maxRedirects: 0 });
  expect(denied.status()).not.toBe(303);
  await anon.close();

  // Aceite: campos obrigatórios
  await page.getByLabel("Quem aceitou (nome e cargo)").fill("");
  await page.getByRole("button", { name: "Registrar aceite" }).click();
  await expect(page.getByText("Informe quem aceitou.")).toBeVisible();
  await page.getByLabel("Quem aceitou (nome e cargo)").fill("Responsável Fictício — Gerente");
  await page.getByLabel("Referência do aceite").fill("[Teste] E-mail de aceite");
  await page.getByRole("button", { name: "Registrar aceite" }).click();
  await expect(page.getByText("Aceite registrado.")).toBeVisible();
  await expect(page.locator("header").getByText("Aceita")).toBeVisible();
  await expect(page.getByTestId("revision").first()).toContainText("Aceita em");

  // Demanda acompanha a proposta
  await page.locator("header").getByRole("link", { name: /^DEM-/ }).click();
  await expect(page.locator("header").getByText("Aceita")).toBeVisible();
  await expect(page.getByText(/Proposta PROP-\d{4}-\d{4,} Rev\.00 aceita em/).first()).toBeVisible();
  await page.getByRole("link", { name: "Abrir orçamento" }).click();

  // Nova revisão (alteração de escopo aceito): Rev.00 preservada; Rev.01 exige motivo
  await page.locator("summary", { hasText: "Nova revisão (alteração de escopo aceito)" }).click();
  await page.getByLabel("Motivo da nova revisão").fill("[Teste] Inclusão de uma terceira turma.");
  await page.getByRole("button", { name: "Abrir nova revisão" }).click();
  await expect(page.getByText(/Cotação reaberta para nova revisão/)).toBeVisible();
  await expect(page.getByTestId("revision")).toHaveCount(1);
  await expect(page.getByTestId("revision").first()).toContainText("Aceita");
  await expect(page.getByRole("link", { name: "Editar item" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Concluir revisão Rev.01" })).toBeVisible();
  await page.getByLabel("Motivo da nova revisão").fill("[Teste] Inclusão de uma terceira turma.");
  await page.getByRole("button", { name: "Concluir revisão Rev.01" }).click();
  await expect(page.getByText("Revisão concluída e congelada.")).toBeVisible();
  await expect(page.getByTestId("revision")).toHaveCount(2);
  await expect(page.locator("header").getByText("Rev.01")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/62-revisoes.png`, fullPage: true });
});

test("RF-17: serviço não liberado — revisão permitida, emissão bloqueada com o motivo", async ({ page }) => {
  test.setTimeout(150_000);
  const tag = uniqueSuffix();
  await login(page);
  await prepareQuote(page, tag, "TRN-NR35");
  await priceFirstItem(page);
  await page.getByLabel("Validade (dias)").fill("10");
  for (const [label, value] of CONTENT) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Salvar conteúdo" }).click();
  await expect(page.getByText("Conteúdo da proposta salvo.")).toBeVisible();
  await page.getByRole("button", { name: "Concluir revisão Rev.00" }).click();
  await expect(page.getByText("Revisão concluída e congelada.")).toBeVisible();
  const blocked = page.getByTestId("emission-blockers");
  await expect(blocked).toContainText("Emissão bloqueada");
  await expect(blocked).toContainText("TRN-NR35");
  await expect(page.getByRole("button", { name: "Emitir proposta" })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/63-emissao-bloqueada.png`, fullPage: true });

  // Cancelamento exige motivo
  await page.locator("summary", { hasText: "Cancelar cotação" }).click();
  await page.getByRole("button", { name: "Cancelar cotação" }).click();
  await expect(page.getByText("Informe o motivo.")).toBeVisible();
  await page.getByLabel("Motivo do cancelamento").fill("[Teste] Serviço ainda não liberado.");
  await page.getByRole("button", { name: "Cancelar cotação" }).click();
  await expect(page.getByText("Cotação cancelada.").first()).toBeVisible();
});

test("orçamento emitido no celular: fluxo, revisões e downloads sem rolagem horizontal", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page);
  await page.goto("/orcamentos?q=emissao");
  await page.locator('ul a[href^="/orcamentos/"]').first().click();
  await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/);
  await expect(page.getByTestId("flow")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/64-orcamento-emitido-celular.png`, fullPage: true });
  await ctx.close();
});
