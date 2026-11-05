import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "**/ui-six.spec.ts", workers: 1,
  outputDir: "generated-artifacts/playwright-ui-six",
  use: {
    baseURL: process.env.UI_SIX_ORIGIN || "http://127.0.0.1:5000",
    ...devices["Desktop Chrome"], reducedMotion: "reduce",
    viewport: { width: 375, height: 812 },
    navigationTimeout: 90000,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
  },
  timeout: 120000,
});
