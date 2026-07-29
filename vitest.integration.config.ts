import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Testes de integração falam com um Supabase real (local via CLI ou um projeto
 * descartável). Eles são separados dos unitários porque exigem banco de pé e
 * a chave service_role — ver README, seção "Testes".
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./") },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
