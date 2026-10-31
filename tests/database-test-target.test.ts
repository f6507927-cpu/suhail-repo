import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, type AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import {
  testDatabaseUrl,
  LOCAL_TEST_DATABASE_URL,
} from "../scripts/db/test-target";
import {
  assertPostgres17,
  postgresExecutable,
  assertTestPortFree,
} from "../scripts/db/test-up";

afterEach(() => vi.unstubAllEnvs());

describe("disposable plain PostgreSQL test setup (D-78)", () => {
  it("defaults to the local process only when DATABASE_URL_TEST is unset", () => {
    vi.stubEnv("DATABASE_URL_TEST", undefined);
    vi.stubEnv(
      "DATABASE_URL_MIGRATIONS",
      "postgresql://never.example.test/production",
    );
    expect(testDatabaseUrl()).toBe(LOCAL_TEST_DATABASE_URL);
  });
  it.each([
    "postgresql://postgres@127.0.0.1:5432/suhail_test",
    "postgresql://postgres@localhost:55432/test",
    "postgresql://postgres@[::1]:5432/test",
  ])("honors explicit local/CI test URL %s", (url) => {
    vi.stubEnv("DATABASE_URL_TEST", url);
    expect(testDatabaseUrl()).toBe(url);
  });
  it.each([
    "postgresql://role:private-fixture@db.fixture.supabase.co/postgres",
    "postgresql://role:private-fixture@aws-0-region.pooler.supabase.com/postgres",
    "postgresql://remote.example.test/test",
  ])("rejects non-loopback targets without disclosing credentials", (url) => {
    vi.stubEnv("DATABASE_URL_TEST", url);
    expect(testDatabaseUrl).toThrow("never Supabase");
    expect(testDatabaseUrl).not.toThrow("private-fixture");
  });
  it.each(["", "invalid-fixture"])(
    "rejects malformed test URLs rather than silently falling back",
    (url) => {
      vi.stubEnv("DATABASE_URL_TEST", url);
      expect(testDatabaseUrl).toThrow("DATABASE_URL_TEST");
      expect(testDatabaseUrl).not.toThrow("invalid-fixture");
    },
  );
  it("requires version 17 and supports a native-binary directory", () => {
    assertPostgres17("postgres (PostgreSQL) 17.5\n");
    assertPostgres17("initdb (PostgreSQL) 17.6\n");
    expect(() => assertPostgres17("postgres (PostgreSQL) 16.15")).toThrow(
      "PostgreSQL 17",
    );
    expect(() => assertPostgres17("postgres (PostgreSQL) 18.1")).toThrow(
      "PostgreSQL 17",
    );
    vi.stubEnv("POSTGRES_TEST_BIN", undefined);
    expect(postgresExecutable("postgres")).toBe("postgres");
    vi.stubEnv("POSTGRES_TEST_BIN", "/native/postgresql17/bin");
    expect(postgresExecutable("initdb")).toBe(
      "/native/postgresql17/bin/initdb",
    );
  });
  it("refuses an occupied port without touching the existing service", async () => {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    try {
      await expect(
        assertTestPortFree((server.address() as AddressInfo).port),
      ).rejects.toThrow("refusing to touch");
      expect(server.listening).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
  it("keeps the CI integration command on its plain postgres:17 service", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(ci).toContain("image: postgres:17");
    expect(ci).toContain(
      "DATABASE_URL_TEST: postgresql://postgres@127.0.0.1:5432/suhail_test",
    );
    expect(ci).toContain("- run: pnpm test:db");
  });
});
