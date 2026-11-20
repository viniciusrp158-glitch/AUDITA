/**
 * P7 — Oportunidades do dia e modo prospecção (AUDDOC020 Rev.01, RP-20/RP-21/RP-22), celular e computador: grupos por
 * chance de resposta, cartão de uma empresa por vez com a mensagem do Diretor, correção do número, resultado em um
 * toque (a empresa entra no funil e sai da carteira), pular e "não é para nós". Ambiente de TESTES: os leads criados
 * ficam marcados como teste.
 */
import { expect, test, type Page } from "@playwright/test";

const OPER = { email: process.env.TEST_OPERADOR_EMAIL!, password: process.env.TEST_OPERADOR_PASSWORD! };
const SHOTS = process.env.E2E_SHOTS_DIR;
const shot = async (page: Page, name: string) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

async function login(page: Page) {
  await page.goto("/empresa/login");
  await page.getByLabel("E-mail").fill(OPER.email);
  await page.getByLabel("Senha").fill(OPER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/empresa(\/clientes|\/?)$/, { timeout: 60_000 });
}
const cardName = (page: Page) => page.getByRole("article", { name: "Empresa em análise" }).getByRole("heading", { level: 2 }).innerText();
// Filiais da mesma empresa têm o mesmo nome: a troca de empresa é conferida pelo CNPJ
const cardCnpj = (page: Page) => page.getByRole("article", { name: "Empresa em análise" }).getByTestId("cnpj").innerText();

test.skip(!OPER.email, "Defina TEST_OPERADOR_* (ambiente de testes)");

test.describe("celular", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "pt-BR" });

  test("modo prospecção: grupos, mensagem pronta, corrigir número, registrar e seguir", async ({ page, context }) => {
    test.setTimeout(180_000);
    context.on("page", (p) => p.close()); // o WhatsApp abre em outra aba
    await login(page);
    await page.goto("/empresa/prospeccao");
    await page.getByRole("navigation", { name: "Seções da prospecção" }).getByRole("link", { name: "Oportunidades" }).click();
    await expect(page).toHaveURL(/\/prospeccao\/oportunidades/);
    const grupos = page.getByRole("navigation", { name: "Grupos de chance" });
    await expect(grupos.getByRole("link", { name: /Quentes/ })).toHaveAttribute("aria-current", "page"); // começa pelos Quentes
    await grupos.getByRole("link", { name: /Mornos/ }).click();
    await expect(page).toHaveURL(/grupo=morno/);
    await page.goto("/empresa/prospeccao/oportunidades?grupo=quente");
    const card = page.getByRole("article", { name: "Empresa em análise" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("list", { name: "Por que está aqui" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await shot(page, "p7-cartao");

    // Mensagem do Diretor com segmento e linha de saída no link oficial do WhatsApp
    const wa = card.getByRole("link", { name: /WhatsApp/ });
    const href = decodeURIComponent((await wa.getAttribute("href"))!);
    expect(href).toMatch(/^https:\/\/wa\.me\/55\d{10,11}\?text=Olá! Tudo bem\? Aqui é /);
    expect(href).toContain("da AUDITA | SSMA & SGI, de Sorocaba.");
    expect(href).toContain("Se não fizer sentido agora, é só me avisar que não entro mais em contato.");

    // Corrigir número: passa a valer no WhatsApp e na ligação
    await card.getByRole("button", { name: "Corrigir número" }).click();
    await card.getByLabel("Número correto da empresa").fill("15991234567");
    await expect(card.getByLabel("Número correto da empresa")).toHaveValue("(15) 99123-4567");
    await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/5515991234567\?/);
    await expect(card.getByRole("link", { name: "Ligar" })).toHaveAttribute("href", "tel:+5515991234567");

    // Envia pelo WhatsApp e registra em um toque: a empresa vira lead e a próxima aparece
    const first = await cardCnpj(page);
    await wa.click();
    await card.getByRole("button", { name: "Enviei a mensagem" }).click();
    await expect(page.getByText("Contato registrado. Próxima empresa!")).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => cardCnpj(page), { timeout: 30_000 }).not.toBe(first);
    await shot(page, "p7-proxima");

    // Pular e "não é para nós"
    const atual = await cardCnpj(page);
    await page.getByRole("link", { name: /Pular/ }).click();
    await expect.poll(() => cardCnpj(page)).not.toBe(atual);
    const descartada = await cardCnpj(page);
    await page.getByRole("button", { name: "Não é para nós" }).click();
    await page.getByLabel("Motivo do descarte").fill("[TESTE] atividade sem relação com SST");
    await page.getByRole("button", { name: "Descartar" }).click();
    await expect(page.getByText("Empresa descartada.")).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => cardCnpj(page), { timeout: 30_000 }).not.toBe(descartada);
  });
});

test("computador: fila do grupo ao lado do cartão", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await page.goto("/empresa/prospeccao/oportunidades?grupo=morno");
  const fila = page.getByRole("complementary", { name: "Próximas empresas" });
  await expect(fila).toBeVisible();
  const items = fila.getByRole("link");
  expect(await items.count()).toBeGreaterThan(2);
  const terceiro = (await items.nth(2).innerText()).split("\n").find((t) => t.length > 3 && !/^\d+$/.test(t) && !/km$/.test(t))!;
  await items.nth(2).click();
  await expect(page).toHaveURL(/i=2/);
  await expect.poll(() => cardName(page)).toContain(terceiro.trim().split(" ")[0]);
  await shot(page, "p7-computador");
});
