import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/hydration.spec.ts",
  timeout: 90_000,
  workers: 1,
  outputDir: "generated-artifacts/playwright-hydration",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3500",
    timezoneId: "America/Los_Angeles",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
  },
  webServer: {
    command: "pnpm exec tsx tests/next-hydration/server.ts",
    url: "http://127.0.0.1:3500/api/health",
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
