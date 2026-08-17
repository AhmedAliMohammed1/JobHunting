import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": resolve(process.cwd()) } },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node", coverage: { provider: "v8", reporter: ["text", "json-summary"], include: ["src/lib/**/*.ts"] } },
});
