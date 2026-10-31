import { defineConfig, devices } from "@playwright/test";

// An explicit origin runs the same checks against an already-running preview.
// Never launch a second Next server for that mode.
const previewOrigin = process.env.PLAYWRIGHT_BASE_URL || undefined;

// Playwright honors PLAYWRIGHT_BROWSERS_PATH automatically; browser installation
// is managed by the environment and must not be triggered by this project.
export default defineConfig({
  testDir: "./e2e",
  // Cold Next/font compilation in the workspace can exceed 30 seconds.
  timeout: 120_000,
  // Fixture apps have their own server/config; never send them to the real app.
  testIgnore: ["**/production.spec.ts", "**/*-fixture.spec.ts", "**/methodology-isr.spec.ts", "**/hydration.spec.ts", "**/security.spec.ts"],
  outputDir: "generated-artifacts/playwright",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: previewOrigin ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: {
      // Workspace can use its managed Chromium; CI uses the versioned download.
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: previewOrigin ? undefined : {
    command: "pnpm dev",
    url: "http://127.0.0.1:3100/api/health",
    env: { PORT: "3100", PLAYWRIGHT_TEST_SERVER: "1", SITE_MODE: "live" },
    // Fail on an occupied port instead of silently testing an unknown server.
    // Pause the preview workflow first: Next's lock is per repo, not per port.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
