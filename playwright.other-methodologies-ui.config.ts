import { defineConfig } from "@playwright/test";
// D-174: DB-free browser check of the "Other methodologies" section (AR/EN, phone widths).
export default defineConfig({
  testDir: "./e2e", testMatch: "other-methodologies-ui.spec.ts", timeout: 30000, workers: 2,
  outputDir: "generated-artifacts/playwright-other-methodologies-ui",
  use: { baseURL: "http://127.0.0.1:3310", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } },
  webServer: { command: "pnpm exec tsx tests/other-methodologies-browser/fixture-server.ts", url: "http://127.0.0.1:3310", reuseExistingServer: !process.env.CI, timeout: 60000 },
});
