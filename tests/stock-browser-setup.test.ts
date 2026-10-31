import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { stockTestEnvironment } from "./stock-browser/environment";

describe("disposable stock browser bootstrap", () => {
  it("preserves the default and overrides unrelated inherited targets", () => {
    vi.stubEnv("DATABASE_URL_TEST", undefined);
    vi.stubEnv("DATABASE_URL_APP", "unrelated");
    vi.stubEnv("DATABASE_URL_PUBLIC", "unrelated");
    try {
      expect(stockTestEnvironment()).toMatchObject({
        NODE_ENV: "test", SITE_MODE: "preview", DATABASE_URL_APP: "",
        DATABASE_URL_MIGRATIONS: "postgresql://postgres@127.0.0.1:55432/suhail_test",
        DATABASE_URL_PUBLIC: "postgresql://suhail_public@127.0.0.1:55432/suhail_test",
      });
    } finally { vi.unstubAllEnvs(); }
  });
  it.each(["127.0.0.1", "localhost", "[::1]"])("propagates CI host %s, port and database", host => {
    const target = `postgresql://postgres@${host}:5432/ci_stock`;
    expect(stockTestEnvironment(target)).toMatchObject({
      DATABASE_URL_TEST: target, DATABASE_URL_MIGRATIONS: target,
      DATABASE_URL_PUBLIC: `postgresql://suhail_public@${host}:5432/ci_stock`,
    });
  });
  it("materializes an omitted database before replacing the public identity", () => {
    expect(stockTestEnvironment("postgresql://postgres@127.0.0.1:5432").DATABASE_URL_PUBLIC)
      .toBe("postgresql://suhail_public@127.0.0.1:5432/postgres");
  });
  it.each(["postgresql://postgres@remote.example:5432/test", "", "postgresql://postgres@127.0.0.1:5432/test?options=-crole=postgres"])(
    "refuses unsafe targets before setup can launch commands: %s", target => {
      expect(() => stockTestEnvironment(target)).toThrow("Database environment validation failed");
    },
  );
  it("runs the required commands in preview before enabling the public login", () => {
    const setup = readFileSync("tests/stock-browser/setup.ts", "utf8");
    expect(setup.indexOf("stockTestEnvironment()")).toBeLessThan(setup.indexOf('execFileSync("pnpm"'));
    expect(setup).toContain('["db:migrate"]');
    expect(setup).toContain('["db:seed:demo", "--test"]');
    expect(setup.indexOf('["db:seed:demo", "--test"]')).toBeLessThan(setup.indexOf("alter role"));
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(ci.indexOf("pnpm test:db")).toBeLessThan(ci.indexOf("pnpm test:e2e:stock"));
    expect(ci.indexOf("playwright install")).toBeLessThan(ci.indexOf("pnpm test:e2e:stock"));
  });
});
