import { defineConfig,devices } from "@playwright/test";
export default defineConfig({
  testDir:"./e2e",testMatch:["**/accounts-fixture.spec.ts","**/accounts-locales-fixture.spec.ts","**/methodology-fixture.spec.ts","**/navigation-fixture.spec.ts","**/financial-fixture.spec.ts","**/profile-deadline.spec.ts"],timeout:30000,
  outputDir:"generated-artifacts/playwright-account-fixtures",
  use:{...devices["Desktop Chrome"],baseURL:"http://127.0.0.1:3300",launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}},
  webServer:{command:"pnpm exec tsx tests/browser-fixture/server.ts",url:"http://127.0.0.1:3300",timeout:60000,reuseExistingServer:false},
});
