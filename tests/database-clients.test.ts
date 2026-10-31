import { rootCertificates } from "node:tls";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { databaseUrl } from "../src/db/connection-url";
import { cliConnection } from "../scripts/db/connection";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  postgres: vi.fn(() => ({ fixture: true })),
  drizzle: vi.fn((client: unknown) => ({
    $client: client,
    select: vi.fn(),
    execute: vi.fn(),
  })),
}));
vi.mock("postgres", () => ({ default: mocks.postgres }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: mocks.drizzle }));
import { lazyRuntimeClient, runtimeOptions } from "../src/db/runtime-client";
import { dbPublic } from "../src/db/public";
import { dbApp } from "../src/db/app";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("database credential separation", () => {
  it("imports both server-only clients without requiring credentials or connecting", () => {
    expect(dbPublic).toBeDefined();
    expect(dbApp).toBeDefined();
    expect(mocks.postgres).not.toHaveBeenCalled();
    for (const file of [
      "src/db/public.ts",
      "src/db/app.ts",
      "src/db/runtime-client.ts",
    ])
      expect(readFileSync(file, "utf8")).toContain('import "server-only"');
  });
  it.each(["DATABASE_URL_PUBLIC", "DATABASE_URL_APP"] as const)(
    "lazily validates only %s, with TLS and small unprepared pool",
    (key) => {
      for (const other of [
        "DATABASE_URL_PUBLIC",
        "DATABASE_URL_APP",
        "DATABASE_URL_MIGRATIONS",
        "DATABASE_URL_TEST",
      ])
        vi.stubEnv(other, undefined);
      const db = lazyRuntimeClient(key);
      expect(mocks.postgres).not.toHaveBeenCalled();
      expect(() => db.select).toThrow(key);
      const fixtureUrl = "postgresql://fixture@127.0.0.1:55432/database";
      vi.stubEnv(key, fixtureUrl);
      db.select();
      db.select();
      expect(mocks.postgres).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          host: ["127.0.0.1"],
          port: [55432],
          username: "fixture",
          database: "database",
          password: expect.any(Function),
          ...runtimeOptions,
          ssl: false,
        }),
      );
      expect(runtimeOptions).toMatchObject({
        prepare: false,
        max: 3,
        max_lifetime: 1800,
        keep_alive: 30,
        idle_timeout: 20,
        connect_timeout: 10,
      });
      // TLS is supplied centrally by connectDatabase, not an encryption-only default.
      expect(runtimeOptions).not.toHaveProperty("ssl");
    },
  );
  it.each(["DATABASE_URL_MIGRATIONS", "DATABASE_URL_TEST"] as const)(
    "CLI %s requires no runtime credentials",
    (key) => {
      vi.stubEnv("DATABASE_URL_PUBLIC", undefined);
      vi.stubEnv("DATABASE_URL_APP", undefined);
      vi.stubEnv(key, "postgresql://postgres@127.0.0.1:5432/fixture");
      cliConnection(key);
      expect(mocks.postgres).toHaveBeenCalledWith(
        expect.objectContaining({ ssl: false, max: 1, prepare: false }),
      );
      vi.stubEnv(key, "postgresql://remote.example.test/fixture");
      mocks.postgres.mockClear();
      expect(() => cliConnection(key)).toThrow("never Supabase");
      expect(mocks.postgres).not.toHaveBeenCalled();
    },
  );
  it("does not expose rejected credentials in validation errors", () => {
    vi.stubEnv("DATABASE_URL_APP", "private-invalid-fixture");
    expect(() => databaseUrl("DATABASE_URL_APP")).toThrow("DATABASE_URL_APP");
    expect(() => databaseUrl("DATABASE_URL_APP")).not.toThrow(
      "private-invalid-fixture",
    );
  });
  it("uses the local test default without migrations credentials", () => {
    vi.stubEnv("DATABASE_URL_TEST", undefined);
    vi.stubEnv("DATABASE_URL_MIGRATIONS", undefined);
    cliConnection("DATABASE_URL_TEST");
    expect(mocks.postgres).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        host: ["127.0.0.1"],
        port: [55432],
        username: "postgres",
        database: "suhail_test",
        ssl: false,
        max: 1,
        prepare: false,
      }),
    );
  });
  it.each([
    ["DATABASE_URL_APP", "production"],
    ["DATABASE_URL_PUBLIC", "production"],
    ["DATABASE_URL_APP", "test"],
    ["DATABASE_URL_PUBLIC", "test"],
  ] as const)(
    "wires role refusal into the actual lazy %s client in %s mode",
    async (key, mode) => {
      vi.stubEnv("NODE_ENV", mode);
      vi.stubEnv("SUPABASE_DB_CA_CERT", rootCertificates[0]);
      const username =
        key === "DATABASE_URL_APP"
          ? "suhail_app.project"
          : "suhail_public.project";
      vi.stubEnv(
        key,
        `postgresql://${username}@${mode === "test" ? "127.0.0.1" : "aws-0-region.pooler.supabase.com"}:5432/postgres`,
      );
      const raw = {
        fixture: true,
        unsafe: vi.fn((text: string) =>
          Promise.resolve(
            text === "select current_user"
              ? [{ current_user: "postgres" }]
              : [],
          ),
        ),
        end: vi.fn(async () => {}),
      };
      mocks.postgres.mockReturnValueOnce(raw);
      const db = lazyRuntimeClient(key);
      await expect(db.$client.unsafe("business")).rejects.toThrow(key);
      expect(raw.unsafe).toHaveBeenCalledWith("select current_user");
      expect(raw.end).toHaveBeenCalledExactlyOnceWith({ timeout: 0 });
    },
  );
});
