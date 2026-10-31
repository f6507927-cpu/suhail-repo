import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "**/search-fixture.spec.ts",
  outputDir: "generated-artifacts/playwright-search", timeout: 120_000,
  fullyParallel: false, workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3500", ...devices["Desktop Chrome"],
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
  },
  webServer: {
    command: "pnpm exec tsx --conditions=react-server tests/search-browser/setup.ts && pnpm exec tsx tests/search-browser/server.ts",
    url: "http://127.0.0.1:3500/api/health",
    env: {
      NODE_ENV: "test", PORT: "3500", PLAYWRIGHT_TEST_SERVER: "1",
      SITE_MODE: "preview", SITE_URL: "http://127.0.0.1:3500",
      DATABASE_URL_TEST: "postgresql://postgres@127.0.0.1:55432/suhail_test",
      DATABASE_URL_PUBLIC: "postgresql://suhail_public@127.0.0.1:55432/suhail_test",
      NEXT_PUBLIC_SUPABASE_URL: "https://auth.fixture.test",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-test-key",
    },
    timeout: 180_000, reuseExistingServer: false,
  },
});
