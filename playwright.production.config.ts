import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/production.spec.ts",
  outputDir: "generated-artifacts/playwright-production",
  use: {
    baseURL: "http://127.0.0.1:3200",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      grepInvert: /@phone/,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
        },
      },
    },
    ...[320, 390].map((width) => ({
      name: `phone-${width}`,
      grep: /@phone/,
      use: {
        ...devices["Pixel 7"],
        viewport: { width, height: 844 },
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
        },
      },
    })),
    ...[320, 390].map((width) => ({
      name: `webkit-iphone-${width}`,
      // Also exercise real private-route CSP without signing in or bypassing auth.
      grep: /@phone|@security/,
      use: {
        ...devices["iPhone 13"],
        browserName: "webkit" as const,
        viewport: { width, height: 844 },
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE,
        },
      },
    })),
  ],
  // Pause any Next development server before building/running this suite;
  // production and development share generated metadata in this repository.
  webServer: {
    command: "pnpm start",
    url: "http://127.0.0.1:3200/api/health",
    env: { PORT: "3200", SITE_MODE: "live" },
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
