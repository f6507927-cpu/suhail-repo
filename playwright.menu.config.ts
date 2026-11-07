import { defineConfig, devices } from "@playwright/test";

// D-168: phone menu navigation against the isolated hydration production build
// (tests/next-hydration/server.ts), with only the homepage read stubbed so the
// real homepage search renders. No database, Supabase or provider IO.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/mobile-menu-navigation.spec.ts",
  timeout: 60_000,
  workers: 1,
  outputDir: "generated-artifacts/playwright-menu",
  use: { baseURL: "http://127.0.0.1:3510" },
  projects: [
    {
      name: "chromium-375",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 },
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } },
    },
    {
      // The reported device: iPhone Safari.
      name: "webkit-iphone",
      use: { ...devices["iPhone 13"], browserName: "webkit" as const, viewport: { width: 375, height: 812 },
        launchOptions: { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE } },
    },
  ],
  webServer: {
    command: "pnpm exec tsx tests/next-hydration/server.ts",
    env: { MENU_HOME_FIXTURE: "1" },
    url: "http://127.0.0.1:3510/api/health",
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
