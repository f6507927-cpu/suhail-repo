import { defineConfig, devices } from "@playwright/test";
import { publicFixtureServer } from "./tests/search-browser/config";

// An explicit origin runs the same checks against an already-running preview.
// Never launch a second Next server for that mode.
const previewOrigin = process.env.PLAYWRIGHT_BASE_URL || undefined;
const fixtureServer = previewOrigin ? undefined : publicFixtureServer(3100);

// Playwright honors PLAYWRIGHT_BROWSERS_PATH automatically; browser installation
// is managed by the environment and must not be triggered by this project.
export default defineConfig({
  testDir: "./e2e",
  // Cold Next/font compilation in the workspace can exceed 30 seconds.
  timeout: 120_000,
  // D-218: explicit ownership. Admin/component fixtures run in their own CI
  // configurations, never against a real Next authentication/database boundary.
  testMatch: ["**/foundation.spec.ts", "**/health.spec.ts", "**/accounts.spec.ts",
    "**/public-motion.spec.ts", "**/ui-one-b.spec.ts", "**/ui-six.spec.ts"],
  metadata: { publicFixture: !previewOrigin },
  outputDir: "generated-artifacts/playwright",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: previewOrigin ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 375, height: 812 },
    launchOptions: {
      // Workspace can use its managed Chromium; CI uses the versioned download.
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: fixtureServer ? {
    ...fixtureServer,
    // Real routes, SQL, RLS and auth; only the generated copy's public
    // connection factory accepts the validated disposable loopback target.
    env: { ...fixtureServer.env,
      PLAYWRIGHT_FIXTURE_MODE: "development" },
    // Fail on an occupied port instead of silently testing an unknown server.
    reuseExistingServer: false,
    timeout: 180_000,
  } : undefined,
});
