import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "**/ui-eight.spec.ts", workers: 1, timeout: 120000,
  outputDir: "generated-artifacts/playwright-ui-eight",
  use: {
    baseURL: "http://127.0.0.1:3400", ...devices["Desktop Chrome"],
    viewport: { width: 375, height: 812 }, reducedMotion: "reduce",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
  },
  webServer: { command: "NODE_ENV=test pnpm exec tsx tests/ui-one-browser/server.ts",
    url: "http://127.0.0.1:3400/health", reuseExistingServer: true, timeout: 60000 },
});
