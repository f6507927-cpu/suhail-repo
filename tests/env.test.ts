import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("server-only", () => ({}));
import { getDbEnv } from "../src/env/db";
import { getAuthEnv } from "../src/env/auth";
import { getStorageEnv } from "../src/env/storage";
import { getSiteEnv } from "../src/env/site";
import { getJobsEnv } from "../src/env/jobs-env";
import { getSecEnv } from "../src/env/sec";

afterEach(() => vi.unstubAllEnvs());

describe("lazy environment validation", () => {
  it("reports missing variable names only when the getter is called", () => {
    vi.stubEnv("DATABASE_URL_PUBLIC", undefined);
    vi.stubEnv("DATABASE_URL_APP", undefined);
    vi.stubEnv("DATABASE_URL_MIGRATIONS", undefined);
    expect(() => getDbEnv()).toThrow("DATABASE_URL_PUBLIC");
    expect(() => getDbEnv()).toThrow("DATABASE_URL_APP");
    expect(() => getDbEnv()).not.toThrow(/DATABASE_URL_MIGRATIONS/);
  });

  it("does not include rejected values in validation errors", () => {
    const rejectedValue = "invalid-private-value-fixture";
    vi.stubEnv("DATABASE_URL_PUBLIC", rejectedValue);
    vi.stubEnv("DATABASE_URL_APP", undefined);
    vi.stubEnv("DATABASE_URL_MIGRATIONS", undefined);
    try {
      getDbEnv();
      throw new Error("Expected environment validation to fail");
    } catch (error) {
      expect((error as Error).message).toContain("DATABASE_URL_PUBLIC");
      expect((error as Error).message).not.toContain(rejectedValue);
    }
  });
});

describe("exact environment inventory", () => {
  it("lists only the supplied active variables, without values", () => {
    const example = readFileSync(".env.example", "utf8");
    const activeLines = example
      .split("\n")
      .filter((line) => line && !line.startsWith("#"));
    expect(activeLines.every((line) => /^[A-Z][A-Z0-9_]*=$/.test(line))).toBe(true);
    expect(activeLines.map((line) => line.slice(0, -1)).sort()).toEqual(
      [
        "DATABASE_URL_MIGRATIONS",
        "SUPABASE_DB_CA_CERT",
        "DATABASE_URL_PUBLIC",
        "DATABASE_URL_APP",
        "DATABASE_URL_TEST",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SECRET_KEY",
        "SEC_USER_AGENT",
        "S3_ENDPOINT",
        "S3_REGION",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
        "S3_BUCKET_PUBLIC",
        "PUBLIC_MEDIA_BASE_URL",
        "SITE_URL",
        "SITE_MODE",
        "FORWARDED_DIAGNOSTICS",
        "JOB_BATCH_SIZE",
      ].sort(),
    );
    const later = example.split("# Later (D-54)\n")[1];
    expect(later).toBeDefined();
    expect(
      [...later.matchAll(/^# ([A-Z][A-Z0-9_]*)=$/gm)].map((match) => match[1]),
    ).toEqual([
      "ANTHROPIC_API_KEY",
      "LLM_MODEL",
      "REVALIDATE_SECRET",
      "S3_BUCKET_ARCHIVE",
      "SEND_OTP_HOOK_SECRET",
    ]);
  });

  it("requires the SEC user agent", () => {
    vi.stubEnv("SEC_USER_AGENT", undefined);
    expect(() => getSecEnv()).toThrow("SEC_USER_AGENT");
    vi.stubEnv("SEC_USER_AGENT", "test-only-user-agent");
    expect(getSecEnv()).toEqual({ SEC_USER_AGENT: "test-only-user-agent" });
  });

  it("does not require workspace or test database URLs in the app", () => {
    vi.stubEnv("DATABASE_URL_PUBLIC", "postgresql://public.example.test/db");
    vi.stubEnv("DATABASE_URL_APP", "postgresql://app.example.test/db");
    vi.stubEnv("DATABASE_URL_MIGRATIONS", "");
    vi.stubEnv("DATABASE_URL_TEST", undefined);
    vi.stubEnv("SUPABASE_DB_CA_CERT", undefined);
    expect(getDbEnv()).toEqual({
      DATABASE_URL_PUBLIC: "postgresql://public.example.test/db",
      DATABASE_URL_APP: "postgresql://app.example.test/db",
      DATABASE_URL_MIGRATIONS: undefined,
      SUPABASE_DB_CA_CERT: undefined,
    });
  });

  it("does not require the workspace-only Supabase credential", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://auth.example.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-only-anon-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", undefined);
    expect(getAuthEnv()).not.toHaveProperty("SUPABASE_SECRET_KEY");
  });

  it("uses only the specified storage names", () => {
    const storage = {
      S3_ENDPOINT: "https://storage.example.test",
      S3_REGION: "test-region",
      S3_ACCESS_KEY_ID: "test-only-key-id",
      S3_SECRET_ACCESS_KEY: "test-only-credential",
      S3_BUCKET_PUBLIC: "test-public",
      PUBLIC_MEDIA_BASE_URL: "https://media.example.test",
    };
    for (const [name, value] of Object.entries(storage))
      vi.stubEnv(name, value);
    vi.stubEnv("S3_BUCKET_ARCHIVE", "deferred-test-fixture");
    expect(getStorageEnv()).toEqual(storage);
  });

  it.each([undefined, ""])(
    "defaults site mode to preview when unset (%s)",
    (mode) => {
      vi.stubEnv("SITE_URL", "https://site.example.test");
      vi.stubEnv("SITE_MODE", mode);
      expect(getSiteEnv().SITE_MODE).toBe("preview");
    },
  );

  it("allows preview mode without basic-auth credentials (D-137)", () => {
    vi.stubEnv("SITE_URL", "https://site.example.test");
    vi.stubEnv("SITE_MODE", undefined);
    vi.stubEnv("PREVIEW_BASIC_AUTH_USER", undefined);
    vi.stubEnv("PREVIEW_BASIC_AUTH_PASSWORD", undefined);
    expect(getSiteEnv()).toEqual({
      SITE_URL: "https://site.example.test",
      SITE_MODE: "preview",
      FORWARDED_DIAGNOSTICS: undefined,
    });
  });

  it("allows live mode without preview credentials or deferred settings", () => {
    vi.stubEnv("SITE_URL", "https://site.example.test");
    vi.stubEnv("SITE_MODE", "live");
    vi.stubEnv("PREVIEW_BASIC_AUTH_USER", undefined);
    vi.stubEnv("PREVIEW_BASIC_AUTH_PASSWORD", "");
    vi.stubEnv("REVALIDATE_SECRET", "deferred-test-fixture");
    expect(getSiteEnv()).toEqual({
      SITE_URL: "https://site.example.test",
      SITE_MODE: "live",
      FORWARDED_DIAGNOSTICS: undefined,
    });
  });

  it.each([undefined, ""])(
    "defaults job batches to 100 when unset (%s)",
    (batch) => {
      vi.stubEnv("JOB_BATCH_SIZE", batch);
      expect(getJobsEnv()).toEqual({ JOB_BATCH_SIZE: 100 });
    },
  );

  it("parses an explicit job batch size", () => {
    vi.stubEnv("JOB_BATCH_SIZE", "50");
    expect(getJobsEnv()).toEqual({ JOB_BATCH_SIZE: 50 });
  });

  it.each(["0", "-1", "1.5", "invalid"])(
    "rejects invalid job batch size %s",
    (batch) => {
      vi.stubEnv("JOB_BATCH_SIZE", batch);
      expect(() => getJobsEnv()).toThrow("JOB_BATCH_SIZE");
    },
  );
});
