import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir:"./e2e", testMatch:"**/security.spec.ts",
  workers:1, outputDir:"generated-artifacts/playwright-security",
  use:{...devices["Desktop Chrome"],baseURL:"http://127.0.0.1:3600",
    launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}},
  webServer:{
    command:"pnpm exec tsx tests/security-browser/server.ts",
    url:"http://127.0.0.1:3600/api/health",reuseExistingServer:false,timeout:120_000,
  },
});
