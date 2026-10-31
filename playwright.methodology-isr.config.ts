import { defineConfig, devices } from "@playwright/test";

// Build without database variables. Cold tests run before any successful
// requests; warmed tests run after the database-available production suite.
// Both outage phases run with no database variables and cannot reach Supabase.
const warmed = process.env.ISR_VERIFY_WARMED_CACHE === "1";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/methodology-isr.spec.ts",
  outputDir: "generated-artifacts/playwright-methodology-isr",
  timeout: 30000,
  workers: 1,
  grep: warmed ? /failed ISR revalidation/ : /database-free build|failed first read/,
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3400", launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} },
  webServer: {
    command: `${warmed ? "pnpm exec tsx tests/methodology-isr-age.ts && " : ""}env -u DATABASE_URL_PUBLIC -u DATABASE_URL_APP -u DATABASE_URL_MIGRATIONS -u DATABASE_URL_TEST -u DATABASE_URL -u PGHOST -u PGUSER -u PGDATABASE -u PGPORT -u PGPASSWORD -u SUPABASE_DB_CA_CERT pnpm start`,
    env: { PORT: "3400", SITE_MODE: "live" },
    url: "http://127.0.0.1:3400/api/health",
    timeout: 60000,
    reuseExistingServer: false,
  },
});
