import { describe, expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({ directory: vi.fn(), detail: vi.fn() }));
vi.mock("server-only", () => ({}));
// next/font is a Next compiler transform, not a callable API in Vitest.
vi.mock("../src/components/foundation/LocaleDocument", () => ({
  documentMetadata: {},
  LocaleDocument: () => null,
}));
vi.mock("../src/i18n/navigation", () => ({ Link: () => null }));
vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("../src/db/methodology-public", () => ({
  getPublicMethodologies: reads.directory,
  getPublicMethodology: reads.detail,
}));
import Directory, * as directoryRoute from "../src/app/[locale]/(public)/methodology/page";
import Detail, * as detailRoute from "../src/app/[locale]/(public)/methodology/[slug]/page";
import * as publicLayout from "../src/app/[locale]/(public)/layout";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("Public methodology classic ISR", () => {
  it.each(["ar", "en"])("propagates failed %s reads instead of returning a cacheable error page", async (locale) => {
    const outage = new Error("Synthetic database outage");
    reads.directory.mockRejectedValue(outage);
    reads.detail.mockRejectedValue(outage);
    // Repeat the requests: neither a first render nor revalidation may swallow
    // an outage into JSX that Next would treat as a successful cache entry.
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(Directory({ params: Promise.resolve({ locale }) })).rejects.toBe(outage);
      await expect(Detail({ params: Promise.resolve({ locale, slug: "sample" }) })).rejects.toBe(outage);
    }
  });

  it("defers all public routes to first request, retaining 900-second classic ISR", async () => {
    for (const route of [publicLayout, directoryRoute, detailRoute]) {
      expect(route.revalidate).toBe(900);
    }
    for (const route of [directoryRoute, detailRoute]) expect(route.dynamic).toBe("force-static");
    // Leaf policies isolate query-driven search from static public siblings.
    expect(publicLayout).not.toHaveProperty("dynamic");
    expect(publicLayout.generateStaticParams()).toEqual([]);
    await expect(detailRoute.generateStaticParams()).resolves.toEqual([]);
  });

  it("public route modules read no request cookies or headers", () => {
    let checked = 0;
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) visit(path);
        else if (/\.tsx?$/.test(entry.name)) {
          checked++;
          const source = readFileSync(path, "utf8");
          expect(source, path).not.toMatch(/["']next\/headers["']/);
          expect(source, path).not.toMatch(/\b(?:cookies|headers)\s*\(/);
        }
      }
    };
    visit("src/app/[locale]/(public)");
    expect(checked).toBeGreaterThan(1);
  });
});
