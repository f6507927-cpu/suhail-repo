import { stockTestEnvironment } from "../stock-browser/environment";

/** D-218: isolated Next copy, real public role/SQL, strict disposable target. */
export function publicFixtureServer(port: number) {
  return {
    command: "pnpm exec tsx --conditions=react-server tests/search-browser/setup.ts && pnpm exec tsx tests/search-browser/server.ts",
    url: `http://127.0.0.1:${port}/api/health`,
    env: {
      ...stockTestEnvironment(),
      PORT: String(port), PLAYWRIGHT_TEST_SERVER: "1",
      SITE_MODE: "preview", SITE_URL: `http://127.0.0.1:${port}`,
      NEXT_PUBLIC_SUPABASE_URL: "https://auth.fixture.test",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-test-key",
    },
    timeout: 180_000,
    reuseExistingServer: false,
  };
}
