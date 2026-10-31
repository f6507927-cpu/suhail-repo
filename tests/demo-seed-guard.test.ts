import { afterEach, describe, expect, it, vi } from "vitest";
import { demoSeedConnection } from "../scripts/db/connection";
import { assertDemoMode, seedDemoData, createDemoFixtures } from "../scripts/db/seed-demo";
import type { Sql } from "postgres";
const connect = vi.hoisted(() => vi.fn(() => ({ end: vi.fn() })));
vi.mock("../src/db/connect", () => ({ connectDatabase: connect }));
vi.mock("server-only", () => ({}));
afterEach(() => { vi.unstubAllEnvs(); connect.mockClear(); });
describe("explicit preview loopback demo seeding", () => {
  for (const mode of [undefined, "", "invalid", "live"]) {
    it(`refuses ${String(mode)} at every boundary before connection or writes`, async () => {
      vi.stubEnv("SITE_MODE", mode);
      expect(() => assertDemoMode()).toThrow();
      expect(() => demoSeedConnection("DATABASE_URL_TEST")).toThrow();
      await expect(seedDemoData({} as Sql)).rejects.toThrow();
      await expect(createDemoFixtures({} as never)).rejects.toThrow();
      expect(connect).not.toHaveBeenCalled();
    });
  }
  for (const target of [
    "postgresql://postgres:private@db.example.supabase.co:5432/postgres",
    "postgresql://postgres.project:private@aws.pooler.supabase.com:6543/postgres",
    "postgresql://postgres:private@remote.example:5432/db",
    "postgresql://postgres:private@127.0.0.1.evil:5432/db",
    "postgresql://postgres:private@%31%32%37.0.0.1:5432/db",
    "postgresql://postgres:private@127.0.0.1/db",
    "postgresql://postgres:private@127.0.0.1:5432/db?options=role%3Dpostgres",
    "not-a-url", "",
  ]) {
    it(`rejects remote/malformed target ${target.split("@").at(-1)} before creating a client`, () => {
      vi.stubEnv("SITE_MODE", "preview");
      for (const key of ["DATABASE_URL_TEST", "DATABASE_URL_MIGRATIONS"] as const) {
        vi.stubEnv(key, target);
        try { demoSeedConnection(key); expect.fail("must refuse"); }
        catch (error) { expect(String(error)).not.toContain("private"); }
      }
      expect(connect).not.toHaveBeenCalled();
    });
  }
  it.each(["localhost", "127.0.0.1", "[::1]"])("permits explicit preview test target %s", host => {
    vi.stubEnv("SITE_MODE", "preview");
    vi.stubEnv("DATABASE_URL_TEST", `postgresql://postgres@${host}:55432/suhail_test`);
    demoSeedConnection("DATABASE_URL_TEST");
    expect(connect).toHaveBeenCalledOnce();
  });
  it("uses --test's local default, never a remote migration URL", () => {
    vi.stubEnv("SITE_MODE", "preview");
    vi.stubEnv("DATABASE_URL_TEST", undefined);
    demoSeedConnection("DATABASE_URL_TEST");
    expect(connect.mock.calls[0]).toContain("postgresql://postgres@127.0.0.1:55432/suhail_test");
  });
  it("validates the selected migration target rather than an unrelated test URL", () => {
    vi.stubEnv("SITE_MODE", "preview");
    vi.stubEnv("DATABASE_URL_MIGRATIONS", "postgresql://postgres@127.0.0.1:55432/suhail_test");
    vi.stubEnv("DATABASE_URL_TEST", "postgresql://postgres@remote.example:5432/db");
    demoSeedConnection("DATABASE_URL_MIGRATIONS");
    expect(connect.mock.calls[0]).toContain("DATABASE_URL_MIGRATIONS");
  });
  it("refuses an already supplied remote client before mutation", async () => {
    vi.stubEnv("SITE_MODE", "preview");
    await expect(seedDemoData({ options: { host: ["remote.example"] } } as Sql)).rejects.toThrow("loopback");
  });
});
