import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { methodologyCacheFile, methodologyCacheFiles } from "../tests/methodology-isr-cache";

// next-intl serializes the full message dictionary into script/Flight payloads,
// including unused error-copy keys. Assert the rendered markup, not that table.
function visibleMarkup(html: string) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

test("database-free build produces no prerendered public locale pages", () => {
  const manifest = JSON.parse(readFileSync(".next/prerender-manifest.json", "utf8"));
  for (const locale of ["ar", "en"]) {
    expect(Object.keys(manifest.routes).filter(path => path === `/${locale}` || path.startsWith(`/${locale}/`))).toEqual([]);
    expect(methodologyCacheFiles(locale, "methodology")).toEqual([]);
    expect(methodologyCacheFiles(locale, "methodology/example-a")).toEqual([]);
  }
});

for (const [locale, path, cacheKey] of [
  ["ar", "/methodology", "methodology"],
  ["en", "/en/methodology", "methodology"],
  ["ar", "/methodology/example-a", "methodology/example-a"],
  ["en", "/en/methodology/example-a", "methodology/example-a"],
] as const) {
  test(`failed ISR revalidation on ${path} retains the last good page`, async ({ request }) => {
    const cachePath = methodologyCacheFile(locale, cacheKey);
    const good = readFileSync(cachePath, "utf8");
    const first = await request.get(path);
    expect(first.status()).toBe(200);
    expect(first.headers()["cache-control"]).toContain("s-maxage=900");
    expect(first.headers()["x-nextjs-cache"]).toBe("STALE");
    expect(await first.text()).toBe(good);
    // Background revalidation must fail (database URLs are absent). Give it
    // time to finish, then ensure neither response nor persistent cache changed.
    await new Promise(resolve => setTimeout(resolve, 1000));
    const retry = await request.get(path);
    expect(retry.status()).toBe(200);
    expect(await retry.text()).toBe(good);
    expect(readFileSync(cachePath, "utf8")).toBe(good);
  });
}

for (const path of ["/methodology", "/en/methodology", "/methodology/example-a", "/en/methodology/example-a"]) {
  test(`failed first read on ${path} cannot create a cached error page`, async ({ request }) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request.get(path);
      expect(response.status()).toBe(500);
      expect(response.headers()["cache-control"]).toContain("no-store");
      const html = await response.text();
      expect(visibleMarkup(html)).not.toContain("Methodology register unavailable");
      expect(visibleMarkup(html)).not.toContain("registerUnavailable");
    }
    for (const locale of ["ar", "en"]) {
      expect(methodologyCacheFiles(locale, "methodology")).toEqual([]);
      expect(methodologyCacheFiles(locale, "methodology/example-a")).toEqual([]);
    }
  });
}

for (const locale of ["ar", "en"] as const) {
  test(`failed first read renders ${locale} home recovery in the real error boundary`, async ({page}) => {
    const prefix = locale==="en"?"/en":"";
    await page.goto(`${prefix}/methodology`);
    const home=page.locator(`main a[href="${prefix||"/"}"]`);
    await expect(home).toBeVisible();
    await home.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(prefix||"/");
    await expect(page.locator("html")).toHaveAttribute("lang",locale);
    await expect(page.getByRole("main")).toHaveAttribute("id","content");
  });
}
