import { defineConfig, devices } from "@playwright/test";
import { publicFixtureServer } from "./tests/search-browser/config";
export default defineConfig({
  testDir: "./e2e", testMatch: "**/search-fixture.spec.ts",
  outputDir: "generated-artifacts/playwright-search", timeout: 120_000,
  fullyParallel: false, workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3500", ...devices["Desktop Chrome"],
    viewport: { width: 375, height: 812 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
  },
  webServer: publicFixtureServer(3500),
});
