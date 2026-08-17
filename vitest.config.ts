import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": resolve(process.cwd()), "server-only": resolve(process.cwd(), "tests/server-only.ts") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "tests/contracts/**/*.test.ts"],
    environment: "node",
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/database/**"],
      thresholds: { statements: 90, lines: 90, functions: 90, branches: 65 },
    },
  },
});
