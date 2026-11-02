import { afterEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { getTableColumns } from "drizzle-orm";
import { readFileSync } from "node:fs";

vi.mock("server-only", () => ({}));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("D-153 migration rollout compatibility (mock SQL only)", () => {
  it.each([undefined, "0", "1"])("prepares reads AND manual writes safely with storage-ready=%s", async gate => {
    vi.stubEnv("API_NINJAS_STORAGE_READY", gate);
    vi.resetModules();
    const { runtimePriceBar } = await import("../src/db/price-runtime");
    const { priceBar } = await import("../src/db/schema/market");
    const db = drizzle.mock();
    const select = db.select().from(runtimePriceBar).toSQL().sql;
    const insert = db.insert(runtimePriceBar).values({ security_id: "00000000-0000-4000-8000-000000000001",
      date: "2026-09-30", month_end_for: "2026-09-30", close: 123, currency: "USD",
      source_label: "Manual close", source_url: "https://example.test/source" }).returning().toSQL().sql;
    const columns = getTableColumns(runtimePriceBar);
    if (gate === "1") {
      for (const query of [select, insert]) {
        expect(query).toContain('"price_provider"');
        expect(query).toContain('"provider_updated_at"');
      }
      expect(Object.keys(columns).sort()).toEqual(Object.keys(getTableColumns(priceBar)).sort());
    } else {
      for (const query of [select, insert]) expect(query).not.toMatch(/price_provider|provider_updated_at/);
      expect(Object.keys(columns).sort()).toEqual(Object.keys(getTableColumns(priceBar))
        .filter(key => !["price_provider", "provider_updated_at"].includes(key)).sort());
      // SQL still retains every pre-0013 manual evidence/provenance column.
      for (const name of ["month_end_for", "source_id", "source_url", "source_label", "close"])
        expect(insert).toContain(`"${name}"`);
    }
  });
  it("routes all existing financial reads and manual writes through the compatibility shape", () => {
    for (const path of [
      "src/lib/financial/data.ts", "src/lib/financial/service.ts",
      "src/lib/financial/market-value-persistence.ts", "src/lib/launch/evidence.ts",
      "src/ingest/prices/manual.ts",
    ]) {
      const text = readFileSync(path, "utf8");
      expect(text).toContain("runtimePriceBar as priceBar");
      for (const match of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g))
        if (match[2].includes("/schema/")) expect(match[1].split(",").map(name => name.trim())).not.toContain("priceBar");
    }
  });
});
