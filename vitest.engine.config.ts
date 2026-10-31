import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Avoid CPU oversubscription when unit tests and coverage validate together.
    maxWorkers: 1,
    include: ["src/engine/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // All executable production engine modules, including validators/renderers.
      // Fixtures and tests are not production engine modules.
      include: ["src/engine/**/*.ts"],
      exclude: ["src/engine/**/*.test.ts", "src/engine/__fixtures__/**"],
      reportsDirectory: "coverage/engine",
      reporter: ["text", "json", "json-summary", "html"],
      thresholds: { perFile: true, branches: 100 },
    },
  },
});
