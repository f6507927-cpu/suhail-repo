import { defineConfig, devices } from "@playwright/test";
import { stockTestEnvironment } from "./tests/stock-browser/environment";
export default defineConfig({
  testDir: "./e2e", testMatch: "**/stock-fixture.spec.ts", timeout: 90_000,
  outputDir: "generated-artifacts/playwright-stock", fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:3400", ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } },
  webServer: {
    command: "pnpm exec tsx tests/stock-browser/setup.ts && pnpm exec tsx tests/stock-browser/server.ts", url: "http://127.0.0.1:3400/health",
    env: stockTestEnvironment(),
    reuseExistingServer: false, timeout: 120_000,
  },
});
