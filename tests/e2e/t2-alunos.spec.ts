/**
 * T2 — Alunos: matrícula individual e em lote pela aba Alunos (gestão), convite por e-mail (lido na caixa de testes
 * do ambiente de desenvolvimento), criação da senha na área do aluno (/treinamentos), "Meus cursos", sair/entrar,
 * senha errada e celular. Requer: L01 com versão publicada no ambiente de desenvolvimento e a caixa de testes
 * (Mailpit) em DEV_MAILPIT_URL. Dados "[TESTE]".
 */
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const MAILPIT = process.env.DEV_MAILPIT_URL;
const ALUNO = `http://127.0.0.1:${process.env.E2E_ALUNO_PORT ?? 3001}/treinamentos`;
const SHOTS = "test-results/telas";
const stamp = Date.now().toString(36);
const ALUNA = { nome: "[TESTE] Aluna Fictícia de Verificação", email: `aluna.${stamp}@teste.audita` };
const SENHA = `Teste${stamp}9`;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/empresa");
}

async function inviteLink(email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/messages?limit=50`)).json();
    const msg = (list.messages ?? []).find((m: { To?: { Address: string }[] }) => m.To?.some((t) => t.Address === email));
    if (msg) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      expect(full.Subject).toBe("Seu acesso aos treinamentos AUDITA");
      return /href="([^"]+)"/.exec(full.HTML)![1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Convite não chegou");
}

test.describe.configure({ mode: "serial" });
test.skip(!MAILPIT, "Defina DEV_MAILPIT_URL (caixa de testes do ambiente de desenvolvimento)");

test("matrícula individual → convite → criar senha → Meus cursos", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await login(page);
  await page.goto("/treinamentos?q=L01");
  await page.getByTestId("training-list").getByRole("link").first().click();
  await page.getByRole("tab", { name: "Alunos" }).click();
  const one = page.getByTestId("enroll-one");
  await one.getByLabel("Nome completo *").fill(ALUNA.nome);
  await one.getByLabel("E-mail *").fill(ALUNA.email);
  await one.getByLabel(/Empresa/).fill("[TESTE] Empresa Fictícia");
  await one.getByRole("button", { name: "Matricular e enviar convite" }).click();
  await expect(page.getByTestId("enroll-results")).toContainText("convite enviado por e-mail", { timeout: 30_000 });
  await expect(page.getByTestId("enrollment-list")).toContainText(ALUNA.email);
  await expect(page.getByTestId("enrollment-list")).toContainText("Convite pendente");
  await page.screenshot({ path: `${SHOTS}/t2-01-alunos.png`, fullPage: true });

  // O aluno abre o convite numa sessão separada (outro navegador)
  const link = await inviteLink(ALUNA.email);
  expect(link).toContain("/treinamentos/auth/confirm?token_hash=");
  const ctx = await browser.newContext();
  const aluno = await ctx.newPage();
  await aluno.goto(link.replace(/^https?:\/\/[^/]+\/treinamentos/, ALUNO));
  await expect(aluno.getByRole("heading", { name: "Crie sua senha" })).toBeVisible();
  await aluno.getByLabel("Nova senha").fill("curta");
  await aluno.getByLabel("Repita a senha").fill("curta");
  await aluno.getByRole("button", { name: "Salvar senha e entrar" }).click();
  await expect(aluno.getByText(/pelo menos 8 caracteres/).first()).toBeVisible();
  await aluno.getByLabel("Nova senha").fill(SENHA);
  await aluno.getByLabel("Repita a senha").fill(SENHA);
  await aluno.getByRole("button", { name: "Salvar senha e entrar" }).click();
  await expect(aluno.getByText("Senha salva.")).toBeVisible({ timeout: 20_000 });
  await expect(aluno.getByTestId("my-courses")).toContainText("Segurança do Trabalho");
  await aluno.screenshot({ path: `${SHOTS}/t2-02-meus-cursos.png`, fullPage: true });

  // Sair e entrar de novo; senha errada é recusada
  await aluno.getByRole("button", { name: "Sair" }).click();
  await expect(aluno.getByRole("heading", { name: "Área do aluno" })).toBeVisible();
  await aluno.getByLabel("E-mail").fill(ALUNA.email);
  await aluno.getByLabel("Senha").fill("SenhaErrada123");
  await aluno.getByRole("button", { name: "Entrar" }).click();
  await expect(aluno.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await aluno.getByLabel("Senha").fill(SENHA);
  await aluno.getByRole("button", { name: "Entrar" }).click();
  await expect(aluno.getByTestId("my-courses")).toContainText("Segurança do Trabalho");

  // O aluno não entra no sistema da equipe
  await aluno.goto("http://127.0.0.1:3100/empresa/clientes");
  await expect(aluno).toHaveURL(/\/empresa\/login/);

  // Celular sem rolagem horizontal
  await aluno.setViewportSize({ width: 390, height: 844 });
  await aluno.goto(`${ALUNO}/meus-cursos`);
  const overflow = await aluno.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await aluno.screenshot({ path: `${SHOTS}/t2-03-celular.png`, fullPage: true });
  await ctx.close();

  // A gestão passa a mostrar que a senha foi criada
  await page.reload();
  await expect(page.getByTestId("enrollment-list")).toContainText(/Último acesso|Senha criada/);
});

test("matrícula em lote por texto colado, com prévia e resultado por linha", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await page.goto("/treinamentos?q=L01");
  await page.getByTestId("training-list").getByRole("link").first().click();
  await page.getByRole("tab", { name: "Alunos" }).click();
  await page.getByRole("tab", { name: /Matricular em lote/ }).click();
  const batch = page.getByTestId("enroll-batch");
  await batch.getByLabel(/Ou cole aqui/).fill(
    `nome;email;empresa\n[TESTE] Lote Um;lote1.${stamp}@teste.audita;[TESTE] Empresa\n[TESTE] Lote Dois;lote2.${stamp}@teste.audita;\nSem Email;;\n`,
  );
  await expect(page.getByTestId("batch-preview")).toContainText("3 aluno(s)");
  await batch.getByRole("button", { name: /Matricular 3 aluno/ }).click();
  const res = page.getByTestId("enroll-results");
  await expect(res).toContainText("2 de 3", { timeout: 30_000 });
  await expect(res).toContainText("E-mail inválido.");
  await page.screenshot({ path: `${SHOTS}/t2-04-lote.png`, fullPage: true });
});
