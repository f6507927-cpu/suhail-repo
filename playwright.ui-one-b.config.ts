import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "**/ui-one-b.spec.ts", workers: 1,
  outputDir: "generated-artifacts/playwright-ui-one-b",
  use: { baseURL: process.env.UI_ONE_B_ORIGIN ?? "http://127.0.0.1:5000",
    ...devices["Desktop Chrome"],
    viewport: { width: 375, height: 812 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } },
});
