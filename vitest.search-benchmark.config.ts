import { defineConfig } from "vitest/config";

// Deliberately opt-in: never mix scale measurements with normal unit/DB suites.
export default defineConfig({
  test: {
    environment: "node",
    include: ["benchmarks/search.integration.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
