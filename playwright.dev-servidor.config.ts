import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de tela contra o ambiente de TESTES do servidor (deploy/servidor/dev/montar-ambiente-testes.sh), com o
 * sistema já rodando no PC e o túnel SSH aberto (porta 8200). Nunca contra a produção (CLAUDE.md, regra 7).
 * Uso: set -a; . ./.env.dev-servidor; set +a; npx playwright test -c playwright.dev-servidor.config.ts [arquivo]
 */
const PORT = Number(process.env.E2E_PORT ?? 3137);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 240_000,
  retries: 0,
  // O banco de testes fica no servidor (túnel SSH): gravações levam mais que os 5 s padrão das verificações
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    actionTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
