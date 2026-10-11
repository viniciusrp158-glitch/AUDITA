/**
 * V1.1 no navegador: proposta aceita → serviço contratado → execução (linha do tempo) → M03 → OS-COM liberada → M05 →
 * alteração de escopo aprovada → entregue/encerrado (demanda acompanha); caixa gerencial com lançamento e estorno.
 * Usa uma proposta aceita de TESTE criada pelos testes anteriores (I6/homologação). Dados fictícios.
 */
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { uniqueSuffix } from "../helpers/br";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const OPERADOR = { email: process.env.TEST_OPERADOR_EMAIL!, password: process.env.TEST_OPERADOR_PASSWORD! };
const SHOTS = "test-results/telas";

async function login(page: Page, who: { email: string; password: string }, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(who.email);
  await page.getByLabel("Senha").fill(who.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(landing);
}

async function acceptedQuoteWithoutContract(): Promise<string | null> {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    db: { schema: "audita" },
    auth: { persistSession: false },
  });
  await c.auth.signInWithPassword(ADMIN);
  const { data: quotes } = await c.from("quotes").select("id").eq("status", "aceita").eq("is_test", true).order("updated_at", { ascending: false }).limit(50);
  const { data: used } = await c.from("service_contracts").select("quote_id");
  const taken = new Set((used ?? []).map((u) => u.quote_id));
  return (quotes ?? []).map((q) => q.id).find((id) => !taken.has(id)) ?? null;
}

async function generate(page: Page, scope: ReturnType<Page["locator"]>, button: string) {
  await scope.getByRole("button", { name: button }).click();
  const confirm = scope.getByLabel(/Gerar mesmo assim/);
  await expect(scope.getByText(/gerado|Campos sem dados/).first()).toBeVisible({ timeout: 30_000 });
  if (await confirm.count()) {
    await confirm.check();
    await scope.getByRole("button", { name: button }).click();
    await expect(scope.getByText(/gerado/)).toBeVisible({ timeout: 30_000 });
  }
}

test("serviço contratado: execução, M03, OS-COM/M05, alteração de escopo e encerramento sincronizando a demanda", async ({ page }) => {
  test.setTimeout(180_000);
  const quoteId = await acceptedQuoteWithoutContract();
  test.skip(!quoteId, "Nenhuma proposta aceita de teste disponível (rode antes os testes do I6/homologação).");
  await login(page, ADMIN, /\/$/);
  await page.goto(`/orcamentos/${quoteId}`);
  await page.getByTestId("contract-link").getByRole("button", { name: "Registrar serviço contratado" }).click();
  await expect(page).toHaveURL(/\/demandas\/servicos\/[0-9a-f-]{36}/);
  await expect(page.getByText(/Serviço contratado registrado a partir da proposta aceita\./)).toBeVisible();
  const contractUrl = page.url().split("?")[0];

  // Situação e linha do tempo
  const st = page.getByTestId("status-form");
  await st.locator('select[name="status"]').selectOption("em_execucao");
  await st.getByRole("button", { name: "Registrar situação" }).click();
  await expect(st.getByText(/Situação atualizada/)).toBeVisible();
  const ev = page.getByTestId("event-form");
  await ev.locator('select[name="event_type"]').selectOption("entrega");
  await ev.locator('textarea[name="description"]').fill("[TESTE] Relatório da primeira visita entregue");
  await ev.locator('input[name="channel"]').fill("E-mail");
  await ev.getByRole("button", { name: "Incluir na linha do tempo" }).click();
  await expect(page.getByTestId("timeline")).toContainText("[TESTE] Relatório da primeira visita entregue");

  // M03 (minuta) — campos ausentes listados antes, com confirmação
  const gens = page.getByTestId("generate-form");
  await generate(page, gens.first(), "Gerar M03");
  await expect(page.getByTestId("contract-documents")).toContainText("M03 — Termo de aceite");

  // OS-COM: não libera com condicionante; libera depois; gera M05
  await page.getByRole("button", { name: /Nova OS/ }).click();
  await expect(page).toHaveURL(/\/os\/[0-9a-f-]{36}/);
  const of = page.getByTestId("order-form");
  await of.locator('textarea[name="activities"]').fill("Visita técnica | Relatório de visita | EPI do cliente");
  await of.locator('textarea[name="pending_conditions"]').fill("Aguardando integração de acesso");
  await of.locator('input[name="released_by_name"]').fill("Diretor (teste)");
  await of.locator('input[name="released_on"]').fill("2026-10-11");
  await of.getByRole("button", { name: "Salvar OS" }).click();
  await expect(of.getByText("OS salva.")).toBeVisible();
  const os = page.getByTestId("status-form");
  await os.locator('select[name="status"]').selectOption("liberada");
  await os.getByRole("button", { name: "Registrar situação" }).click();
  await expect(os.getByRole("alert")).toContainText("condicionantes pendentes");
  await of.locator('textarea[name="pending_conditions"]').fill("Nenhuma");
  await of.getByRole("button", { name: "Salvar OS" }).click();
  await expect(of.getByText("OS salva.")).toBeVisible();
  await os.locator('select[name="status"]').selectOption("liberada");
  await os.getByRole("button", { name: "Registrar situação" }).click();
  await expect(page.getByText("Liberada para execução").first()).toBeVisible();
  await generate(page, page.getByTestId("generate-form"), "Gerar M05");
  await page.screenshot({ path: `${SHOTS}/v11-os.png`, fullPage: true });

  // Alteração de escopo: aprova só com aceite do cliente
  await page.goto(contractUrl);
  await page.locator("summary", { hasText: "Registrar alteração de escopo" }).click();
  const cf = page.getByTestId("change-form");
  await cf.locator('textarea[name="reason"]').fill("[TESTE] Inclusão de uma unidade");
  await cf.locator('input[name="value_before"]').fill("1.576,78");
  await cf.locator('input[name="value_after"]').fill("1.890,00");
  await cf.getByRole("button", { name: "Registrar alteração" }).click();
  await expect(page).toHaveURL(/\/alteracoes\/[0-9a-f-]{36}/);
  const ac = page.getByTestId("status-form");
  await ac.locator('select[name="status"]').selectOption("aprovada");
  await ac.getByRole("button", { name: "Registrar situação" }).click();
  await expect(ac.getByRole("alert")).toContainText("aceite rastreável");
  const cf2 = page.getByTestId("change-form");
  await cf2.locator('input[name="client_approval"]').fill("Responsável Fictício, gerente, 11/10/2026, e-mail");
  await cf2.locator('input[name="validated_by_name"]').fill("Diretor (teste)");
  await cf2.locator('input[name="validated_on"]').fill("2026-10-11");
  await cf2.getByRole("button", { name: "Salvar alteração" }).click();
  await expect(cf2.getByText("Alteração salva.")).toBeVisible();
  await ac.locator('select[name="status"]').selectOption("aprovada");
  await ac.getByRole("button", { name: "Registrar situação" }).click();
  await expect(page.getByText("Alteração aprovada e registrada na linha do tempo.")).toBeVisible();
  await generate(page, page.getByTestId("generate-form"), "Gerar M06");

  // Entregue → Encerrado; a demanda acompanha
  await page.goto(contractUrl);
  for (const s of ["entregue", "encerrado"]) {
    const f = page.getByTestId("status-form");
    await f.locator('select[name="status"]').selectOption(s);
    await f.getByRole("button", { name: "Registrar situação" }).click();
    await expect(page.getByText(s === "entregue" ? "Entregue" : "Encerrado").first()).toBeVisible();
    await page.reload();
  }
  await expect(page.getByText(/Serviço encerrado: registros travados/)).toBeVisible();
  await expect(page.getByTestId("contract-documents")).toContainText("M05 — Ordem de serviço comercial");
  await expect(page.getByTestId("contract-documents")).toContainText("M06 — Alteração de escopo");
  await page.screenshot({ path: `${SHOTS}/v11-servico.png`, fullPage: true });
  await page.getByRole("link", { name: /^DEM-/ }).click();
  await expect(page.getByText("Encerrada").first()).toBeVisible();
});

test("caixa gerencial: lançamento, quadro mensal, data futura recusada, estorno e indicadores no Início", async ({ page }) => {
  const tag = uniqueSuffix();
  await login(page, ADMIN, /\/$/);
  await expect(page.getByTestId("cash-kpis")).toBeVisible();
  await page.getByRole("link", { name: "Abrir caixa gerencial" }).click();
  await expect(page).toHaveURL(/\/caixa/);
  const f = page.getByTestId("cash-form");
  await f.locator('input[name="occurred_on"]').fill("2099-01-01");
  await f.locator('input[name="amount"]').fill("1.234,56");
  await f.locator('input[name="description"]').fill(`[TESTE] Recebimento ${tag}`);
  await f.getByRole("button", { name: "Lançar movimentação" }).click();
  await expect(page.getByText("Lance apenas o que já aconteceu (data futura não é permitida).")).toBeVisible();
  const f2 = page.getByTestId("cash-form");
  await f2.locator('input[name="occurred_on"]').fill(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()));
  await f2.locator('input[name="amount"]').fill("1.234,56");
  await f2.locator('input[name="description"]').fill(`[TESTE] Recebimento ${tag}`);
  await f2.getByRole("button", { name: "Lançar movimentação" }).click();
  await expect(page.getByText("Lançamento registrado.")).toBeVisible();
  const entry = page.getByTestId("cash-entries").locator("li", { hasText: `[TESTE] Recebimento ${tag}` });
  await expect(entry).toContainText("+ R$ 1.234,56");
  await entry.locator("summary", { hasText: "Estornar" }).click();
  await entry.getByLabel("Motivo do estorno").fill("[TESTE] lançamento de verificação");
  await entry.getByRole("button", { name: "Estornar" }).click();
  await expect(page.getByTestId("cash-entries").locator("li", { hasText: `[TESTE] Recebimento ${tag}` })).toContainText("ESTORNADO");
  await page.screenshot({ path: `${SHOTS}/v11-caixa.png`, fullPage: true });
});

test("operador sem caixa e sem serviços contratados; telas no celular sem rolagem horizontal", async ({ browser }) => {
  const op = await browser.newContext({ locale: "pt-BR" });
  const p = await op.newPage();
  await login(p, OPERADOR, /\/clientes/);
  for (const path of ["/caixa", "/demandas/servicos"]) {
    await p.goto(path);
    await expect(p, path).toHaveURL(/sem_permissao=1/);
  }
  await p.goto("/demandas");
  await expect(p.getByRole("link", { name: "Serviços contratados" })).toHaveCount(0);
  await op.close();

  const mob = await browser.newContext({ locale: "pt-BR", viewport: { width: 390, height: 844 } });
  const m = await mob.newPage();
  await login(m, ADMIN, /\/$/);
  for (const path of ["/caixa", "/demandas/servicos", "/"]) {
    await m.goto(path);
    expect(await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(1);
  }
  await m.goto("/caixa");
  await m.screenshot({ path: `${SHOTS}/v11-caixa-celular.png`, fullPage: true });
  await mob.close();
});
