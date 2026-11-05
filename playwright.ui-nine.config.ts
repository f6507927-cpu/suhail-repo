import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"./e2e",testMatch:"ui-nine-admin.spec.ts",timeout:30000,workers:2,
  outputDir:"generated-artifacts/playwright-ui-nine",
  use:{baseURL:"http://127.0.0.1:3309",launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}},
  webServer:{command:"pnpm exec tsx tests/ui-nine-browser/server.ts",url:"http://127.0.0.1:3309",reuseExistingServer:!process.env.CI,timeout:60000},
});
