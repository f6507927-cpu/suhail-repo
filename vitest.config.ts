import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    // Completion checks run alongside lint/typecheck/coverage. Bound workers
    // instead of weakening assertion timeouts under concurrent cold startup.
    maxWorkers: 1,
    include: ["src/**/*.test.ts", "tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
    },
  },
});
