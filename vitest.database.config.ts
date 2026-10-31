import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import DatabaseSequencer from "./tests/db-sequencer";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.integration.test.ts"],
    fileParallelism: false,
    sequence: { sequencer: DatabaseSequencer },
    hookTimeout: 60000,
    testTimeout: 30000,
  },
});
