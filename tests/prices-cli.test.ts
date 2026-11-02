import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("explicit price CLI disabled boundary", () => {
  it.each(["month", "dry-run"])("%s reports disabled without database setup, even with invalid arguments/cap", command => {
    const output = execFileSync(process.execPath, ["--conditions=react-server", "--import", "tsx",
      `scripts/prices/${command}.ts`, "invalid"], {
      env: { NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME, API_NINJAS_MONTHLY_CAP: "invalid" },
      encoding: "utf8", timeout: 15000,
    });
    expect(output.trim()).toBe("API Ninjas disabled: API_NINJAS_KEY is unset");
  });
  it("dry run is passed only a budget capability, not the real-run write store", () => {
    const dry = readFileSync("scripts/prices/dry-run.ts", "utf8");
    expect(dry).toContain("{ reserveCall: budgetStore.reserveCall }");
    expect(dry).not.toMatch(/import.*realStore|\.unavailable\(|\.claim\(|\.save\(/);
  });
  it.each(["month", "dry-run"])("%s cannot activate new storage just by supplying a key", command => {
    const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx",
      `scripts/prices/${command}.ts`, "2026-09", "AAPL"], {
      env: { NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME, API_NINJAS_KEY: "mock-key" },
      encoding: "utf8", timeout: 15000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("API Ninjas storage disabled");
    expect(result.stderr).not.toContain("DATABASE_URL");
  });
  it("public grant and RLS artifacts expose price provenance but no private bookkeeping", () => {
    const migration = readFileSync("drizzle/0013_api_ninjas_closes.sql", "utf8");
    expect(migration).toContain("GRANT SELECT (price_provider, month_end_for, source_id, source_url)");
    for (const table of ["price_call_usage", "price_target_claim", "price_provider_status"])
      expect(migration).toContain(`ALTER TABLE app.${table} ENABLE ROW LEVEL SECURITY`);
    expect(migration).not.toMatch(/GRANT[^;]+price_(call_usage|target_claim|provider_status)[^;]+TO suhail_public/);
    expect(migration).toContain("WHERE price_provider = 'API Ninjas'");
    expect(migration).toContain("CREATE POLICY public_price_source_read");
  });
});
