import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/helpers/empty.ts") } },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    // Os testes de integração compartilham o banco de desenvolvimento (ex.: versão vigente dos parâmetros);
    // rodam um arquivo por vez para não interferirem entre si.
    fileParallelism: false,
  },
});
