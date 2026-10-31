import { afterEach, describe, expect, it, vi } from "vitest";
import { connectDatabase } from "../src/db/connect";
import {
  databaseUrl,
  databaseConnectionOptions,
} from "../src/db/connection-url";

afterEach(() => vi.unstubAllEnvs());

const credentialCases = [
  ["DATABASE_URL_APP", "suhail_app.project"],
  ["DATABASE_URL_PUBLIC", "suhail_public.project"],
  ["DATABASE_URL_MIGRATIONS", "postgres.project"],
] as const;
const host = "aws-0-region.pooler.supabase.com";

describe("explicit database destination guard", () => {
  it.each([
    undefined,
    "",
    " ",
    "not-a-url",
    "postgresql://%ZZ@localhost:5432/db",
  ])("refuses absent/malformed input without echoing it (%s)", (value) => {
    vi.stubEnv("DATABASE_URL_APP", value);
    expect(() => databaseUrl("DATABASE_URL_APP")).toThrow("DATABASE_URL_APP");
  });
  it.each([
    `https://suhail_app.project@${host}:6543/db`,
    `postgresql://${host}:6543/db`,
    `postgresql://:password@${host}:6543/db`,
    `postgresql://suhail_app.project@${host}/db`,
    `postgresql://suhail_app.project@${host}:0/db`,
    `postgresql://suhail_app.project@:6543/db`,
    `postgresql://suhail_app.project@${host}:70000/db`,
    `postgresql://suhail_app.project@${host}:notaport/db`,
    `postgresql://suhail_app.project@${host}:6543/db#fragment`,
    `postgresql://suhail_app.project@${host}:6543/%ZZ`,
    `postgresql://suhail_app.project:%ZZ@${host}:6543/db`,
  ])("refuses incomplete or invalid URL components (%s)", (value) => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => databaseConnectionOptions("DATABASE_URL_APP", value)).toThrow(
      "DATABASE_URL_APP",
    );
  });
  it.each([
    "localhost",
    "127.0.0.1",
    "db.fixture.supabase.co",
    "pooler.supabase.com",
    `${host}.evil.test`,
    `evil.test,${host}`,
    `${host}.`,
    `%61ws-0-region.pooler.supabase.com`,
  ])("refuses non-pooler and ambiguous production hosts (%s)", (target) => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() =>
      databaseUrl(
        "DATABASE_URL_APP",
        `postgresql://suhail_app.project@${target}:6543/db`,
      ),
    ).toThrow();
  });
  it.each(credentialCases)(
    "accepts only the correct production identity for %s",
    (key, username) => {
      vi.stubEnv("NODE_ENV", "production");
      expect(
        databaseConnectionOptions(
          key,
          `postgresql://${username}@${host}:5432/db`,
        ),
      ).toMatchObject({
        host: [host],
        port: [5432],
        username,
        database: "db",
      });
      for (const wrong of [
        "postgres",
        "suhail_app",
        "suhail_public",
        "other.project",
        ...credentialCases.map((c) => c[1]).filter((name) => name !== username),
      ]) {
        expect(() =>
          databaseUrl(key, `postgresql://${wrong}@${host}:6543/db`),
        ).toThrow(key);
      }
    },
  );
  it("also enforces production restrictions when NODE_ENV is unset", () => {
    vi.stubEnv("NODE_ENV", undefined);
    expect(() =>
      databaseUrl(
        "DATABASE_URL_MIGRATIONS",
        "postgresql://postgres@127.0.0.1:5432/test",
      ),
    ).toThrow();
  });
  it.each([
    "DATABASE_URL_APP",
    "DATABASE_URL_PUBLIC",
    "DATABASE_URL_MIGRATIONS",
    "DATABASE_URL_TEST",
  ] as const)(
    "allows only complete loopback destinations in tests for %s",
    (key) => {
      vi.stubEnv("NODE_ENV", "test");
      for (const target of ["localhost", "127.0.0.1", "[::1]"])
        expect(
          databaseUrl(key, `postgresql://postgres@${target}:55432/test`),
        ).toContain(target);
      expect(() =>
        databaseUrl(key, `postgresql://postgres.project@${host}:5432/test`),
      ).toThrow();
      expect(() =>
        databaseUrl(key, "postgresql://postgres@localhost/test"),
      ).toThrow();
    },
  );
  it.each(["production", "development", "test"])(
    "test credentials never allow external hosts in %s",
    (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      expect(() =>
        databaseUrl(
          "DATABASE_URL_TEST",
          `postgresql://postgres.project@${host}:5432/test`,
        ),
      ).toThrow();
    },
  );
  it.each([
    "host=localhost",
    "user=postgres",
    "port=5432",
    "password=leak",
    "database=other",
    "options=-c%20role%3Dpostgres",
    "sslmode=disable",
    "ssl=false",
    "search_path=evil",
  ])("refuses connection/startup overrides (%s)", (parameters) => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() =>
      databaseUrl(
        "DATABASE_URL_APP",
        `postgresql://suhail_app.project@${host}:6543/db?${parameters}`,
      ),
    ).toThrow();
  });
  it("permits secure TLS declarations without forwarding URI parameters", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(
      databaseConnectionOptions(
        "DATABASE_URL_APP",
        `postgresql://suhail_app.project@${host}:6543/db?sslmode=require`,
      ),
    ).toMatchObject({ host: [host] });
  });
  it("does not disclose passwords, URLs or parser errors", () => {
    vi.stubEnv("NODE_ENV", "production");
    const value = "postgresql://wrong:fixture-secret@remote.test:5432/private";
    try {
      databaseUrl("DATABASE_URL_APP", value);
      expect.fail("must refuse");
    } catch (error) {
      expect(String(error)).toContain("DATABASE_URL_APP");
      for (const privatePart of [
        "fixture-secret",
        "remote.test",
        "/private",
        value,
      ])
        expect(String(error)).not.toContain(privatePart);
    }
  });
  it.each(["", "fixture%3Apassword"])(
    "overrides ambient PG credentials, including omitted password (%s)",
    async (encodedPassword) => {
      vi.stubEnv("NODE_ENV", "test");
      for (const name of [
        "PGHOST",
        "PGUSER",
        "PGUSERNAME",
        "PGDATABASE",
        "PGPORT",
        "PGPASSWORD",
        "DATABASE_URL",
      ])
        vi.stubEnv(name, "forbidden-ambient-fixture");
      const sql = connectDatabase(
        "DATABASE_URL_TEST",
        { ssl: false, prepare: false },
        `postgresql://fixture${encodedPassword ? ":" + encodedPassword : ""}@127.0.0.1:55432/`,
      );
      // Inspect the real driver's resolved options, without opening a socket.
      expect(sql.options.host).toEqual(["127.0.0.1"]);
      expect(sql.options.port).toEqual([55432]);
      expect(sql.options.user).toBe("fixture");
      expect(sql.options.database).toBe("fixture");
      expect(typeof sql.options.pass).toBe("function");
      expect(await (sql.options.pass as unknown as () => string)()).toBe(
        decodeURIComponent(encodedPassword),
      );
      await sql.end();
    },
  );
  it("preserves IPv6 without the driver's string-host splitting", async () => {
    const sql = connectDatabase(
      "DATABASE_URL_TEST",
      { ssl: false },
      "postgresql://postgres@[::1]:55432/test",
    );
    expect(sql.options.host).toEqual(["::1"]);
    expect(sql.options.port).toEqual([55432]);
    await sql.end();
  });
});
