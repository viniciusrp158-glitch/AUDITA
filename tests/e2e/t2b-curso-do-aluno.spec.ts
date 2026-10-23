/**
 * T2b/c/d — Curso do aluno de ponta a ponta, no ambiente de desenvolvimento:
 *   gestão: nova versão do L01, leitura dos 7 gabaritos (conferência: 45 questões, sem avisos), gravação, regras da
 *   avaliação final (nota 7, 3 tentativas), link do YouTube no M02 e publicação;
 *   aluno: convite → senha → curso; os 7 módulos em sequência (apostila no leitor, videoaula, avaliações), final
 *   reprovada sem retorno e aprovada na segunda tentativa, certificado, verificação pública e celular;
 *   gestão: andamento 7 de 7 com a nota e o código do certificado.
 * Requer DEV_MAILPIT_URL e PDFTOTEXT_PATH (no .env.local) e acesso ao YouTube. Dados "[TESTE]".
 */
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
const MAILPIT = process.env.DEV_MAILPIT_URL;
const ALUNO = `http://127.0.0.1:${process.env.E2E_ALUNO_PORT ?? 3001}/treinamentos`;
const SHOTS = "test-results/telas";
const VIDEO = "https://www.youtube.com/watch?v=jNQXAC9IVRw"; // vídeo público de 19 s (teste do player)
const stamp = Date.now().toString(36);
const ALUNA = { nome: "[TESTE] Aluna do Curso Completo", email: `curso.${stamp}@teste.audita` };
const SENHA = `Teste${stamp}9`;
const KEYS = ["A", "B", "C", "D"];

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/empresa");
}

async function openL01(page: Page) {
  await page.goto("/treinamentos?q=L01");
  await page.getByTestId("training-list").getByRole("link").first().click();
  await expect(page.getByRole("tab", { name: "Versões" })).toBeVisible();
}

async function inviteLink(email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/messages?limit=50`)).json();
    const msg = (list.messages ?? []).find((m: { To?: { Address: string }[] }) => m.To?.some((t) => t.Address === email));
    if (msg) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      return /href="([^"]+)"/.exec(full.HTML)![1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Convite não chegou");
}

/** Responde a prova aberta na tela: objetivas pela chave (ou errando de propósito) e abertas com texto. */
async function answerQuiz(page: Page, pick: (code: string) => string) {
  const quiz = page.getByTestId("quiz");
  await expect(quiz).toBeVisible();
  for (;;) {
    const code = (await quiz.locator("p").first().textContent())!.split(" · ")[0].trim();
    const radios = quiz.getByRole("radio");
    if (await radios.count()) {
      await radios.nth(KEYS.indexOf(pick(code))).click();
      await expect(radios.nth(KEYS.indexOf(pick(code)))).toHaveAttribute("aria-checked", "true");
    } else {
      await quiz.getByLabel("Sua resposta").fill("[TESTE] Resposta fictícia com o raciocínio pedido na atividade.");
    }
    const submit = page.getByTestId("submit-quiz");
    if (await submit.isVisible()) {
      await submit.click();
      break;
    }
    await quiz.getByRole("button", { name: /Próxima/ }).click();
  }
  await expect(page.getByTestId("quiz-result")).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ mode: "serial" });
test.skip(!MAILPIT, "Defina DEV_MAILPIT_URL (caixa de testes do ambiente de desenvolvimento)");

const finalKey: Record<string, string> = {};
let enrollUrl = "";

test("gestão: nova versão, leitura dos gabaritos, regras da final e publicação", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page);
  await openL01(page);
  await page.getByRole("tab", { name: "Versões" }).click();
  await expect(page.getByTestId("version-list")).toBeVisible();
  // Sem rascunho, cria a próxima versão a partir da publicada (com rascunho, segue nele)
  const create = page.getByRole("button", { name: "Criar nova versão" });
  if (await create.isVisible()) {
    await create.click();
    await expect(page.getByText(/Nova versão criada/)).toBeVisible({ timeout: 20_000 });
  }
  await page.getByRole("tab", { name: "Módulos e materiais" }).click();
  await page.getByRole("button", { name: "Ler os gabaritos de todos os módulos" }).click();
  const conf = page.getByTestId("gabarito-conference");
  await expect(conf).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("gabarito-reader")).toContainText("45 questões encontradas, sem avisos");
  await expect(conf).toContainText("M07-Q10");
  await page.screenshot({ path: `${SHOTS}/t2b-01-conferencia-gabaritos.png`, fullPage: false });
  await page.getByRole("button", { name: "Gravar 45 questões" }).click();
  await expect(page.getByText("45 questões gravadas em 7 módulos.")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("module-list")).toContainText("3 · Avaliação 11 questões");

  // M07: nota mínima 7 de 10 e 3 tentativas; a chave vem da lista de questões gravadas
  await page.getByRole("link", { name: /Abrir módulo/ }).nth(6).click();
  const rules = page.getByTestId("assessment-rules");
  await rules.getByLabel("Nota mínima (acertos)").fill("7");
  await rules.locator("input[name=max_attempts]").fill("3");
  await rules.getByRole("button", { name: "Salvar regras" }).click();
  await expect(page.getByText("Regras da avaliação salvas.")).toBeVisible({ timeout: 20_000 });
  for (const t of await page.getByTestId("question-list").locator("li > div > span:first-child").allTextContents()) {
    const m = /(M07-Q\d{2})Objetiva · ([A-E])/.exec(t);
    if (m) finalKey[m[1]] = m[2];
  }
  expect(Object.keys(finalKey)).toHaveLength(10);
  await page.getByTestId("assessment-section").screenshot({ path: `${SHOTS}/t2b-02-avaliacao-final-gestao.png` });

  // M02: link da videoaula
  await openL01(page);
  await page.getByRole("link", { name: /Abrir módulo/ }).nth(1).click();
  await page.getByLabel("Link da videoaula no YouTube").fill(VIDEO);
  await page.getByRole("button", { name: "Salvar módulo" }).click();
  await expect(page.getByText("Módulo salvo.")).toBeVisible({ timeout: 20_000 });

  await openL01(page);
  await page.getByRole("tab", { name: "Versões" }).click();
  await page.getByLabel(/Revisei a ficha técnica/).check();
  await page.getByRole("button", { name: "Publicar versão" }).click();
  await expect(page.getByText("Versão publicada.")).toBeVisible({ timeout: 20_000 });
});

test("aluno: curso completo em sequência, final com segunda tentativa e certificado", async ({ page, browser }) => {
  test.setTimeout(600_000);
  await login(page);
  await openL01(page);
  await page.getByRole("tab", { name: "Alunos" }).click();
  const one = page.getByTestId("enroll-one");
  await one.getByLabel("Nome completo *").fill(ALUNA.nome);
  await one.getByLabel("E-mail *").fill(ALUNA.email);
  await one.getByRole("button", { name: "Matricular e enviar convite" }).click();
  await expect(page.getByTestId("enroll-results")).toContainText("convite enviado por e-mail", { timeout: 30_000 });

  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await a.goto((await inviteLink(ALUNA.email)).replace(/^https?:\/\/[^/]+\/treinamentos/, ALUNO));
  await a.getByLabel("Nova senha").fill(SENHA);
  await a.getByLabel("Repita a senha").fill(SENHA);
  await a.getByRole("button", { name: "Salvar senha e entrar" }).click();
  await expect(a.getByTestId("my-courses")).toBeVisible({ timeout: 20_000 });
  await a.getByTestId("open-course").first().click();
  await expect(a.getByTestId("resume-card")).toContainText("Começar o curso");
  enrollUrl = a.url();
  // Só o M01 está liberado; os demais aparecem com cadeado e sem link
  const m02 = a.getByTestId("course-nav").locator(":scope > li").nth(1);
  await expect(m02).toContainText("Módulo 02");
  await expect(m02.locator("[aria-disabled=true]").first()).toBeVisible();
  await expect(m02.getByRole("link")).toHaveCount(0);
  await a.screenshot({ path: `${SHOTS}/t2b-03-curso-inicio.png` });
  await a.getByTestId("resume-button").click();

  for (let n = 1; n <= 7; n++) {
    await expect(a).toHaveURL(/\/apostila$/);
    await expect(a.locator("[data-testid=pdf-viewer] canvas").first()).toBeVisible({ timeout: 60_000 });
    if (n === 2) await a.screenshot({ path: `${SHOTS}/t2b-04-apostila.png` });
    await a.getByTestId("finish-reading").click();
    if (n === 2) {
      await expect(a).toHaveURL(/\/video$/);
      // Play no centro do player (o botão vermelho do YouTube)
      const player = a.locator("[data-testid=video-player] iframe");
      await expect(a.frameLocator("[data-testid=video-player] iframe").locator("body")).toContainText("Me at the zoo", { timeout: 30_000 });
      await player.click();
      await expect(a.getByTestId("finish-video")).toBeEnabled({ timeout: 90_000 });
      await a.screenshot({ path: `${SHOTS}/t2b-05-videoaula.png` });
      await a.getByTestId("finish-video").click();
    }
    await expect(a).toHaveURL(/\/avaliacao$/);
    await a.getByTestId("start-quiz").click();
    if (n < 7) {
      if (n === 3) {
        await expect(a.getByTestId("quiz-timer")).toBeVisible();
        await a.screenshot({ path: `${SHOTS}/t2b-06-prova-cronometro.png` });
      }
      await answerQuiz(a, () => "A");
      await expect(a.getByTestId("quiz-result")).toContainText(`Módulo 0${n} concluído`);
      await expect(a.getByTestId("quiz-feedback")).toContainText("Retorno:");
      if (n === 3) await a.screenshot({ path: `${SHOTS}/t2b-07-resultado-retorno.png`, fullPage: true });
      await a.getByTestId("next-module").click();
    } else {
      // 1ª tentativa errando tudo: reprovada e sem retorno (política da avaliação final)
      await answerQuiz(a, (code) => (code.includes("-Q") ? KEYS.find((k) => k !== finalKey[code])! : "A"));
      await expect(a.getByTestId("quiz-result")).toContainText("Ainda não foi desta vez");
      await expect(a.getByTestId("quiz-result")).toContainText(/Revise os Módulos [0-9, e]+ antes da nova tentativa/);
      await expect(a.getByText(/aparece depois da aprovação/).first()).toBeVisible();
      await expect(a.getByTestId("quiz-feedback")).not.toContainText("Retorno:");
      await a.screenshot({ path: `${SHOTS}/t2b-08-final-reprovada.png` });
      await a.getByRole("link", { name: "Voltar à avaliação do módulo" }).click();
      await expect(a.getByTestId("my-attempts")).toContainText("Tentativa 1");
      await expect(a.getByTestId("my-attempts")).toContainText("não aprovada");
      await a.getByTestId("start-quiz").click();
      await answerQuiz(a, (code) => finalKey[code] ?? "A");
      await expect(a.getByTestId("quiz-result")).toContainText("Parabéns, curso concluído!");
      await expect(a.getByTestId("quiz-result")).toContainText("Você acertou 10 de 10.");
    }
  }

  await a.getByRole("link", { name: "Ver certificado" }).first().click();
  await expect(a.getByTestId("certificate-name")).toHaveText(ALUNA.nome);
  const code = (await a.getByTestId("certificate-code").textContent())!.replace("Código: ", "").trim();
  expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  await expect(a.getByTestId("certificate")).toContainText("10/10 na avaliação final (mínimo para aprovação: 7/10)");
  await a.getByTestId("certificate").screenshot({ path: `${SHOTS}/t2b-09-certificado.png` });

  // Verificação pública, sem login
  const pub = await (await browser.newContext()).newPage();
  await pub.goto(`${ALUNO}/certificado/${code}`);
  await expect(pub.getByTestId("verify-result")).toContainText("Certificado válido");
  await expect(pub.getByTestId("verify-result")).toContainText(ALUNA.nome);
  await pub.screenshot({ path: `${SHOTS}/t2b-10-verificacao.png` });
  await pub.goto(`${ALUNO}/certificado/0000-0000-0000`);
  await expect(pub.getByTestId("verify-result")).toContainText("Certificado não encontrado");

  // Celular: sem rolagem horizontal; a lateral vira gaveta
  await a.setViewportSize({ width: 390, height: 844 });
  for (const url of [enrollUrl, `${enrollUrl}/certificado`]) {
    await a.goto(url);
    const overflow = await a.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, url).toBeLessThanOrEqual(1);
  }
  await a.goto(enrollUrl);
  await a.screenshot({ path: `${SHOTS}/t2b-11-celular-curso.png`, fullPage: true });
  await a.getByRole("button", { name: "Conteúdo" }).click();
  await expect(a.getByRole("dialog", { name: "Conteúdo do curso" })).toContainText("7 de 7 módulos concluídos");
  await a.screenshot({ path: `${SHOTS}/t2b-12-celular-gaveta.png` });
  await ctx.close();

  // Gestão: andamento, nota e certificado
  await page.reload();
  const row = page.getByTestId("enrollment-list").locator("li", { hasText: ALUNA.email });
  await expect(row.getByTestId("enrollment-progress")).toContainText("7 de 7 módulos · nota final 10/10");
  await expect(row.getByTestId("enrollment-progress")).toContainText(code);
  // Todas as tentativas ficam no histórico (a final reprovada e a aprovada)
  const hist = row.getByTestId("attempt-history");
  await hist.locator("summary").click();
  await expect(hist).toContainText("M07 · tentativa 1");
  await expect(hist).toContainText("0/10 · reprovada");
  await expect(hist).toContainText("10/10 · aprovada");
});
