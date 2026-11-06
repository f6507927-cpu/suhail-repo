import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { stockMetadata } from "../src/stock/metadata";
import { loadPublicStock } from "../src/db/stock-public";
import { priceBar } from "../src/db/schema/market";
import type { PublicStockData } from "../src/stock/types";
vi.mock("server-only", () => ({}));
afterEach(() => vi.unstubAllEnvs());

const data = {
  company: { name: "Fixture Alpha Co", name_ar: null },
  security: { slug: "demo-fixa", ticker: "FIXA" },
  methodology: { name: "Example Methodology A" },
  version: { version_label: "EX-A v1.0", production_enabled: false },
  run: { status: "passes_selected_methodology", data_as_of: "2025-12-31" },
} as PublicStockData;

describe("public stock boundary and metadata", () => {
  it.each(["en", "ar"] as const)("%s metadata prefers curated English, retaining Arabic and empty-name fallbacks", locale => {
    const fixture = { ...data, company: { ...data.company, display_name_en: "Curated Alpha" } };
    expect(JSON.stringify(stockMetadata(fixture, locale, "https://public.example"))).toContain("Curated Alpha");
    expect(JSON.stringify(stockMetadata(fixture, locale, "https://public.example"))).not.toContain("Fixture Alpha Co");
    const arabic = { ...fixture, company: { ...fixture.company, name_ar: "شركة الاختبار" } };
    expect(JSON.stringify(stockMetadata(arabic, locale, "https://public.example").title))
      .toContain(locale === "ar" ? "شركة الاختبار" : "Curated Alpha");
    const cleared = { ...fixture, company: { ...fixture.company, display_name_en: " " } };
    expect(JSON.stringify(stockMetadata(cleared, locale, "https://public.example").title)).toContain("Fixture Alpha Co");
    expect(fixture.company.name).toBe("Fixture Alpha Co");
  });
  for (const locale of ["ar", "en"] as const) {
    it(`${locale} has stock-specific metadata and bilingual canonical links`, () => {
      const meta = stockMetadata(data, locale, "https://public.example");
      expect(JSON.stringify(meta.title)).toContain("Fixture Alpha Co (FIXA)");
      expect(meta.description).toContain("EX-A v1.0");
      expect(meta.description).toContain("2025-12-31");
      expect(meta.alternates?.canonical).toBe(`https://public.example${locale === "en" ? "/en" : ""}/stock/demo-fixa`);
      expect(meta.alternates?.languages).toMatchObject({ ar: "https://public.example/stock/demo-fixa", en: "https://public.example/en/stock/demo-fixa", "x-default": "https://public.example/stock/demo-fixa" });
      expect(meta.robots).toMatchObject({ index: false });
      expect(JSON.stringify(meta.openGraph)).toContain("FIXA");
      expect(JSON.stringify(meta.twitter)).toContain("FIXA");
      // UX polish: per-stock preview cards come from the route's opengraph-image/twitter-image files.
      expect(meta.openGraph?.images).toBeUndefined();
      expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
      expect(meta.twitter && "images" in meta.twitter ? meta.twitter.images : undefined).toBeUndefined();
    });
  }
  it("production versions are indexable; no-run metadata invents no status", () => {
    expect(stockMetadata({ ...data, version: { ...data.version!, production_enabled: true } }, "en", "https://public.example").robots).toMatchObject({ index: true });
    const meta = stockMetadata({ ...data, run: null, version: null }, "en", "https://public.example");
    expect(JSON.stringify(meta.title)).toContain("This stock hasn't been screened yet.");
    expect(meta.description).not.toContain("2025-12-31");
    expect(() => stockMetadata(data, "en", "https://user:password@public.example")).toThrow("without credentials");
  });
  it.each(["ar", "en"] as const)("%s public no-run metadata hides review tokens without changing evidence", locale => {
    const fixture = {
      ...data, run: null, company: { ...data.company, name: "⟦AR-REVIEW⟧ Fixture Alpha Co" },
      version: { ...data.version!, version_label: "⟦AR-REVIEW⟧ First version" },
      methodology: { ...data.methodology!, name: "⟦AR-REVIEW⟧ Fixture method" },
    };
    const original = structuredClone(fixture);
    const meta = stockMetadata(fixture, locale, "https://public.example");
    expect(JSON.stringify(meta)).not.toContain("⟦AR-REVIEW⟧");
    expect(JSON.stringify(meta.title)).toContain(locale === "ar" ? "لم يُفحص هذا السهم بعد." : "This stock hasn't been screened yet.");
    expect(fixture).toEqual(original);
  });
  it("failed reads throw instead of producing cacheable fallback data", async () => {
    const db = { select() { throw new Error("Read unavailable"); }, execute: vi.fn() } as unknown as Parameters<typeof loadPublicStock>[1];
    await expect(loadPublicStock("demo-fixa", db)).rejects.toThrow("Read unavailable");
  });
  it("includes the latest stored month without requiring a screening run or provider request", async () => {
    vi.stubEnv("API_NINJAS_STORAGE_READY", "1");
    const older = { id: "manual", date: "2026-08-31", month_end_for: "2026-08-31",
      close: 10, currency: "USD", source_id: "m", created_at: new Date("2026-10-02") };
    const newer = { ...older, id: "provider", date: "2026-09-30", month_end_for: "2026-09-30",
      price_provider: "API Ninjas", source_label: "API Ninjas", close: 20 };
    const responses = [[{ id: "s", company_id: "c", exchange_id: null }], [{ id: "c" }], [older, newer]];
    let priceProjection: object | undefined;
    const db = {
      select: (projection: object) => ({ from: (table: unknown) => {
        if (table === priceBar) priceProjection = projection;
        const rows = responses.shift()!;
        return { where: () => Object.assign(Promise.resolve(rows), { limit: async () => rows }) };
      } }),
      execute: async () => [],
    } as unknown as Parameters<typeof loadPublicStock>[1];
    const loaded = await loadPublicStock("stock", db);
    expect(loaded?.storedClose).toBe(newer);
    expect(loaded?.run).toBeNull();
    expect(priceProjection && Object.keys(priceProjection).sort()).toEqual([
      "id", "created_at", "date", "month_end_for", "close", "currency", "source_id",
      "price_provider", "source_label", "source_url",
    ].sort());
  });
  it("does not query new price columns on the current schema when the rollout gate is unset", async () => {
    vi.stubEnv("API_NINJAS_STORAGE_READY", undefined);
    vi.stubEnv("API_NINJAS_KEY", "mock-key-does-not-enable-storage");
    const responses = [[{ id: "s", company_id: "c", exchange_id: null }], [{ id: "c" }]];
    let reads = 0;
    const db = {
      select: () => ({ from: (table: unknown) => {
        expect(table).not.toBe(priceBar);
        const rows = responses[reads++];
        return { where: () => ({ limit: async () => rows }) };
      } }),
      execute: async () => [],
    } as unknown as Parameters<typeof loadPublicStock>[1];
    const loaded = await loadPublicStock("current-schema", db);
    expect(reads).toBe(2); expect(loaded?.storedClose).toBeNull();
    expect(loaded?.run).toBeNull();
  });
  it("is on-demand classic ISR and imports no cookie/header access", () => {
    const route = readFileSync("src/app/[locale]/(public)/stock/[slug]/page.tsx", "utf8");
    const query = readFileSync("src/db/stock-public.ts", "utf8");
    expect(route).toContain("revalidate = 900");
    expect(route).toContain('dynamic = "force-static"');
    expect(route).toContain("dynamicParams = true");
    expect(route).toContain("return []");
    for (const source of [route, query]) {
      expect(source).not.toMatch(/from ["']next\/headers|cookies\s*\(|headers\s*\(/);
      expect(source).not.toContain("dbApp");
    }
    expect(query).not.toContain("hash_payload");
  });
});
