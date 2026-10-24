import { defineConfig, devices } from "@playwright/test";

/**
 * Testes do site institucional (pasta site/). Páginas estáticas: não usam banco nem Supabase.
 * Requer `npx next build site` antes. Rodar: `npx playwright test -c playwright.site.config.ts`.
 */
const PORT = Number(process.env.E2E_SITE_PORT ?? 3400);
const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: "tests/e2e-site",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${PORT}`, locale: "pt-BR", timezoneId: "America/Sao_Paulo", trace: "off", launchOptions },
  projects: [
    { name: "computador", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions } },
    { name: "celular", use: { ...devices["Pixel 7"], launchOptions } },
  ],
  webServer: {
    command: `python -m http.server ${PORT} --bind 127.0.0.1 --directory site/out`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: process.env.E2E_REUSE === "1",
    timeout: 30_000,
  },
});
