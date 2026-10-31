import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { stockMetadata } from "../src/stock/metadata";
import { loadPublicStock } from "../src/db/stock-public";
import type { PublicStockData } from "../src/stock/types";
vi.mock("server-only", () => ({}));

const data = {
  company: { name: "Fixture Alpha Co", name_ar: null },
  security: { slug: "demo-fixa", ticker: "FIXA" },
  methodology: { name: "Example Methodology A" },
  version: { version_label: "EX-A v1.0", production_enabled: false },
  run: { status: "passes_selected_methodology", data_as_of: "2025-12-31" },
} as PublicStockData;

describe("public stock boundary and metadata", () => {
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
      expect(meta.openGraph?.images).toEqual([{ url: "https://public.example/icons/icon-512.png", alt: expect.any(String) }]);
      expect(meta.twitter?.images).toEqual(["https://public.example/icons/icon-512.png"]);
    });
  }
  it("production versions are indexable; no-run metadata invents no status", () => {
    expect(stockMetadata({ ...data, version: { ...data.version!, production_enabled: true } }, "en", "https://public.example").robots).toMatchObject({ index: true });
    const meta = stockMetadata({ ...data, run: null, version: null }, "en", "https://public.example");
    expect(JSON.stringify(meta.title)).toContain("No run yet");
    expect(meta.description).not.toContain("2025-12-31");
    expect(() => stockMetadata(data, "en", "https://user:password@public.example")).toThrow("without credentials");
  });
  it("failed reads throw instead of producing cacheable fallback data", async () => {
    const db = { select() { throw new Error("Read unavailable"); }, execute: vi.fn() } as unknown as Parameters<typeof loadPublicStock>[1];
    await expect(loadPublicStock("demo-fixa", db)).rejects.toThrow("Read unavailable");
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
