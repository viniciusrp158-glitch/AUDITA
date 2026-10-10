/**
 * I9 — Homologação do MVP: jornada contínua, como o Diretor usaria o sistema (AUDDOC017 §13 e §16).
 * FL-01 Cliente → FL-05 Demanda → FL-02 Orçamento → FL-05 (entrega e encerramento) → FL-03 Biblioteca → CA-11 Painel → CA-01 Saída.
 * FL-04 (Marketing) é do I10 / V1.2 (AUDDOC017 §2) e não faz parte do MVP.
 * Executar este arquivo SOZINHO (as variações do painel supõem que nada mais está gravando ao mesmo tempo).
 * Serviço TRN-001 com liberação FICTÍCIA somente no ambiente de desenvolvimento; parâmetros de teste.
 */
import { expect, test, type Page } from "@playwright/test";
import { randomCnpj, uniqueSuffix } from "../helpers/br";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const SHOTS = "test-results/telas";
const startsWith = (label: string) => new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`);

/** "R$ 1.234,56" → 123456 (centavos, inteiro: sem erro de ponto flutuante). */
const cents = (s: string | null) => Number((s ?? "").replace(/[^\d,]/g, "").replace(",", "") || "0");

async function kpis(page: Page) {
  await page.goto("/?periodo=mes&teste=1");
  const t = async (id: string) => (await page.getByTestId(id).textContent())!.trim();
  return {
    clients: Number(await t("kpi-clients")),
    received: Number(await t("kpi-received")),
    quoted: cents(await t("kpi-quoted")),
    accepted: cents(await t("kpi-accepted")),
  };
}

const CONTENT: [string, string][] = [
  ["Objetivo e necessidade do cliente", "[Homologação] Integrar novos colaboradores às orientações de SST."],
  ["Escopo incluído (atividades e limites)", "[Homologação] Duas turmas de integração de até 15 participantes."],
  ["Exclusões / depende de contratação", "[Homologação] Treinamentos por NR específicos, laudos e ART."],
  ["Local / modalidade", "[Homologação] Presencial na unidade do cliente."],
  ["Prazo / vigência", "[Homologação] Execução em até 15 dias após o aceite."],
  ["Metodologia", "[Homologação] Aula expositiva com exemplos do ambiente do cliente."],
  ["Entregáveis", "[Homologação] Lista de presença e registro da atividade."],
  ["Critério de conclusão", "[Homologação] Realização das turmas e entrega dos registros."],
  ["Pagamento", "[Homologação] À vista, 10 dias após a realização."],
  ["Despesas adicionais", "[Homologação] Não se aplica."],
  ["Reagendamento e cancelamento", "[Homologação] Sem custo com 48 h de antecedência."],
];

test("homologação: jornada completa FL-01 → FL-05 → FL-02 → FL-03 com conferência do painel (CA-01 a CA-11)", async ({ page }) => {
  test.setTimeout(240_000);
  const tag = uniqueSuffix();
  const nome = `[Homologação] Metalúrgica Jornada ${tag} LTDA`;

  // CA-01 — sem sessão, nenhuma tela interna abre
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/(clientes)?$/);

  const before = await kpis(page);

  // ---------- FL-01 Cliente: pesquisar → duplicidade → cadastrar → código → unidade/contato → histórico
  await page.goto(`/clientes?q=${encodeURIComponent(`Jornada ${tag}`)}`);
  await expect(page.getByText("Nenhum cliente encontrado")).toBeVisible();
  await page.goto("/clientes/novo");
  await page.getByLabel("Razão social").fill(nome);
  await page.getByLabel("CNPJ").fill(randomCnpj());
  await page.getByLabel("Município").fill("Sorocaba");
  await page.getByLabel("UF").selectOption("SP");
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  const aviso = page.getByText("Possível cadastro duplicado");
  const criado = page.getByText(/Cliente cadastrado com o código CLI-\d{4,}/);
  await expect(aviso.or(criado)).toBeVisible();
  if (await aviso.isVisible()) {
    await page.getByLabel("Confirmo que é uma empresa/pessoa diferente e quero cadastrar mesmo assim.").check();
    await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  }
  await expect(criado).toBeVisible();
  const clientCode = (await page.locator("header").getByText(/^CLI-\d{4,}$/).textContent())!.trim();

  await page.getByRole("link", { name: /Unidades/ }).click();
  await page.getByRole("link", { name: "Nova unidade" }).click();
  await page.getByLabel("Nome da unidade").fill("Planta Homologação");
  await page.getByRole("button", { name: "Adicionar unidade" }).click();
  await expect(page.getByText("Unidade salva.")).toBeVisible();
  await page.getByRole("link", { name: /Contatos/ }).click();
  await page.getByRole("link", { name: "Novo contato" }).click();
  await page.getByLabel("Nome").fill("Gestora Fictícia");
  await page.getByLabel("E-mail").fill("gestora@exemplo.test");
  await page.getByLabel("Vínculo").selectOption({ label: "Planta Homologação" });
  await page.getByRole("button", { name: "Adicionar contato" }).click();
  await expect(page.getByText("Contato salvo.")).toBeVisible();
  await page.getByRole("link", { name: "Histórico" }).click();
  await expect(page.getByText("Inclusão · Unidade")).toBeVisible();
  await expect(page.getByText("Inclusão · Contato")).toBeVisible();
  await page.goto(`/clientes?q=${clientCode}`);
  await page.getByRole("link", { name: nome }).click();

  // ---------- FL-05 Demanda: registrar → vincular cliente/serviço
  await page.getByRole("link", { name: "Demandas e propostas" }).click();
  await page.getByRole("link", { name: "Nova demanda" }).click();
  await page.getByLabel("Resumo da solicitação").fill(`[Homologação] Integração de SST ${tag}`);
  await page.getByLabel("Unidade / local").selectOption({ label: "Planta Homologação" });
  await page.getByLabel("Pessoa de contato").selectOption({ label: "Gestora Fictícia" });
  const svc = await page.locator('select[name="service_id"] option', { hasText: "TRN-001" }).first().getAttribute("value");
  await page.getByLabel("Serviço do catálogo").selectOption(svc!);
  await page.getByRole("button", { name: "Registrar demanda" }).click();
  await expect(page.getByText(/Demanda registrada com o código DEM-\d{4}-\d{4,}/)).toBeVisible();
  const demandUrl = page.url();

  // ---------- FL-02 Orçamento: cotação → conferir liberação → escopo/valores → calcular → revisar → emitir → aceite
  await page.getByRole("button", { name: "Criar cotação" }).click();
  await expect(page.getByText(/Cotação criada com o código PROP-\d{4}-\d{4,}/)).toBeVisible();
  await page.getByTestId("quote-item").first().getByRole("link", { name: "Editar item" }).click();
  await page.getByLabel("Execução", { exact: true }).fill("19");
  await page.getByLabel("Demais custos diretos", { exact: true }).fill("250");
  await expect(page.getByTestId("item-final-price")).toHaveText("R$ 4.237,59");
  await page.getByRole("button", { name: "Salvar item" }).click();
  await expect(page.getByText("Item salvo.")).toBeVisible();
  await page.getByLabel("Validade (dias)").fill("15");
  for (const [label, value] of CONTENT) await page.getByLabel(startsWith(label)).fill(value);
  await page.getByRole("button", { name: "Salvar conteúdo" }).click();
  await expect(page.getByText("Conteúdo da proposta salvo.")).toBeVisible();
  await page.getByRole("button", { name: "Concluir revisão Rev.00" }).click();
  await expect(page.getByText("Revisão concluída e congelada.")).toBeVisible();
  await page.getByRole("button", { name: "Emitir proposta" }).click();
  await expect(page.getByText("Proposta emitida: documentos DOCX e PDF gerados e arquivados.")).toBeVisible({ timeout: 30_000 });
  const pdf = await page.request.get((await page.getByTestId("flow").getByRole("link", { name: /PDF/ }).getAttribute("href"))!);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page.getByLabel("Quem aceitou (nome e cargo)").fill("Gestora Fictícia — Gerente de SST");
  await page.getByLabel("Referência do aceite").fill("[Homologação] E-mail de aceite");
  await page.getByRole("button", { name: "Registrar aceite" }).click();
  await expect(page.getByText("Aceite registrado.")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/90-homologacao-proposta-aceita.png`, fullPage: true });

  // ---------- FL-05 (continuação): acompanhar entrega → fechar
  await page.goto(demandUrl);
  await expect(page.locator("header").getByText("Aceita")).toBeVisible();
  for (const [status, label] of [
    ["em_execucao", "Em execução"],
    ["entregue", "Entregue"],
    ["encerrada", "Encerrada"],
  ] as const) {
    await page.getByLabel(/Nova situação/).selectOption(status);
    if (status === "encerrada") await page.getByLabel("Observação").fill("[Homologação] Turmas realizadas e registros entregues.");
    await page.getByRole("button", { name: "Atualizar situação" }).click();
    await expect(page.locator("header").getByText(label)).toBeVisible();
  }
  await expect(page.getByText(/Proposta PROP-\d{4}-\d{4,} Rev\.00 aceita em/).first()).toBeVisible();
  // H-02: o aviso de criação não permanece após as ações seguintes
  await expect(page.getByText(/Demanda registrada com o código/)).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/91-homologacao-demanda-encerrada.png`, fullPage: true });

  // ---------- FL-03 Biblioteca: pesquisar documento oficial → vigente com SHA-256 → baixar
  await page.goto("/biblioteca?q=AUDDOC011");
  await page.getByRole("link", { name: /Metodologia de Precificação/ }).first().click();
  const vig = page.getByTestId("vigente");
  await expect(vig).toContainText("Rev.00");
  await expect(vig).toContainText(/[0-9a-f]{64}/);
  const doc = await page.request.get((await vig.getByRole("link", { name: /Baixar Rev\.00/ }).getAttribute("href"))!);
  expect(doc.ok()).toBe(true);

  // ---------- CA-11 Painel: confere exatamente com o que foi feito na jornada
  const after = await kpis(page);
  expect(after.clients - before.clients).toBe(1);
  expect(after.received - before.received).toBe(1);
  expect(after.quoted - before.quoted).toBe(423759);
  expect(after.accepted - before.accepted).toBe(423759);
  await expect(page.getByText(/não dinheiro recebido/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/92-homologacao-painel.png`, fullPage: true });

  // ---------- CA-01 Saída: sessão encerrada não volta pelas telas internas
  await page.getByRole("button", { name: "Sair" }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/orcamentos");
  await expect(page).toHaveURL(/\/login/);
});
