import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "**/research-fixture.spec.ts", timeout: 60000,
  outputDir: "generated-artifacts/playwright-research", fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:3500", viewport: { width: 375, height: 812 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } },
  webServer: { command: "pnpm exec tsx tests/research-browser/server.mts", url: "http://127.0.0.1:3500/health",
    reuseExistingServer: false, timeout: 120000, env: { NODE_ENV: "test" } },
});
