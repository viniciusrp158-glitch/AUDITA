/**
 * V1.2 — Caderno de pendências aplicado: endereço /empresa, metas do Início (D9), guarda e anonimização (J4) e verificação em duas etapas do mestre (I3.01).
 * Dados fictícios; o MFA ativado no teste é desativado no final.
 */
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const SHOTS = "test-results/telas";

async function login(page: Page, who: { email: string; password: string }, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(who.email);
  await page.getByLabel("Senha").fill(who.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(landing);
}

/** TOTP (RFC 6238, SHA-1, 30 s, 6 dígitos) a partir da chave base32 mostrada na ativação. */
function totp(secret: string, offset = 0): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

test("sistema em /empresa: a raiz e os caminhos antigos levam ao sistema", async ({ page }) => {
  const res = await page.request.get("/", { maxRedirects: 0 });
  expect([307, 308]).toContain(res.status());
  expect(res.headers()["location"]).toMatch(/\/empresa$/);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/empresa\/login$/);
  await expect(page.getByRole("img", { name: "AUDITA" }).first()).toBeVisible();
});

test("Início com as metas do caderno (D9) e Guarda e anonimização (J4)", async ({ page }) => {
  await login(page, ADMIN, /\/empresa$/);
  await expect(page.getByTestId("kpi-quoted-target")).toContainText(/Meta do mês: R\$ 10\.000,00/);
  await expect(page.getByTestId("kpi-conversion-target")).toContainText("Meta: 30%");
  await expect(page.getByTestId("kpi-ticket-target")).toContainText("Meta: R$ 300,00");
  await expect(page.getByTestId("kpi-received-target")).toContainText(/Meta do mês: 5/);
  await page.goto("/configuracoes");
  await page.getByRole("link", { name: /Guarda e anonimização/ }).click();
  await expect(page.getByTestId("retention-rules")).toContainText("RET-08");
  await expect(page.getByTestId("retention-rules")).toContainText("Solicitações de autocadastro recusadas");
  await expect(page.getByText(/Nenhum registro com prazo de guarda vencido|Registros com prazo vencido/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/v12-guarda.png`, fullPage: true });
});

/** Limpeza garantida: remove o fator do mestre de teste pela API (exige a sessão verificada). */
async function removeFactor(secret: string) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await db.auth.signInWithPassword(ADMIN);
  const { data } = await db.auth.mfa.listFactors();
  for (const f of data?.all ?? []) {
    if (f.status === "verified") await db.auth.mfa.challengeAndVerify({ factorId: f.id, code: totp(secret) });
    await db.auth.mfa.unenroll({ factorId: f.id });
  }
}

test("verificação em duas etapas: ativar, entrar com o código e desativar (mestre de teste)", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, ADMIN, /\/empresa$/);
  await page.goto("/conta");
  await page.locator("summary", { hasText: "Segurança" }).click();
  const sec = page.getByTestId("mfa-section");
  await sec.getByRole("button", { name: "Ativar verificação em duas etapas" }).click();
  const secret = (await sec.getByTestId("mfa-secret").innerText()).trim();
  expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  try {
    await sec.getByLabel(/Digite o código/).fill(totp(secret));
    await sec.getByRole("button", { name: "Confirmar e ativar" }).click();
    await expect(sec.getByText("ativa", { exact: true })).toBeVisible({ timeout: 15_000 });

    // novo login: senha não basta; código pedido antes de qualquer tela
    await page.context().clearCookies();
    await login(page, ADMIN, /\/empresa\/verificacao$/);
    await page.goto("/clientes");
    await expect(page).toHaveURL(/\/empresa\/verificacao$/);
    await page.getByLabel("Código do aplicativo autenticador").fill("000000");
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(page.getByText(/Código inválido/)).toBeVisible();
    await page.getByLabel("Código do aplicativo autenticador").fill(totp(secret));
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(page).toHaveURL(/\/empresa$/);
    await page.screenshot({ path: `${SHOTS}/v12-mfa-inicio.png` });

    // desativa pela tela
    await page.goto("/conta");
    await page.locator("summary", { hasText: "Segurança" }).click();
    await sec.getByLabel(/Desativar a verificação/).check();
    await sec.getByRole("button", { name: "Desativar" }).click();
    await expect(sec.getByRole("button", { name: "Ativar verificação em duas etapas" })).toBeVisible({ timeout: 15_000 });
  } finally {
    await removeFactor(secret);
  }
});
