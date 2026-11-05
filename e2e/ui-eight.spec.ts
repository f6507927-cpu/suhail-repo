import { test, expect } from "@playwright/test";
const origin = process.env.UI_EIGHT_PUBLIC_ORIGIN;
const paths = ["/", "/search?q=a", "/stock/nyse-ko", "/stock/nasdaq-aapl", "/stock/nyse-jpm", "/methodology/al-rajhi-adapted"];
for (const locale of ["ar", "en"] as const) for (const width of [360, 375, 390]) {
  test(`UI-8 actual ${locale} ${width}: all disclosures open, no overflow or small tap targets`, async ({ page }) => {
    test.skip(!origin, "Actual development-preview origin is required.");
    await page.setViewportSize({ width, height: 812 });
    for (const [index, path] of paths.entries()) {
      const target = `${origin}${locale === "en" ? "/en" : ""}${path === "/" && locale === "en" ? "" : path}`;
      const response = await page.goto(target, { waitUntil: "networkidle" });
      expect(response?.status(), target).toBe(200);
      await page.evaluate(() => document.fonts.ready);
      if (width === 375 && path.startsWith("/stock/")) {
        const badge = page.locator('[data-section="why"] [class*="largeBadge"]');
        expect((await badge.boundingBox())!.y, target).toBeLessThan(400);
        const reason = page.locator('[data-section="why"] ul li').first();
        if (await reason.count()) {
          const reasonBox = (await reason.boundingBox())!;
          expect(reasonBox.y + reasonBox.height, target).toBeLessThan(812);
        }
        const record = page.locator('[data-section="full-record"]');
        await record.evaluate((element: HTMLDetailsElement) => { element.open = true; });
        console.log("UI-8 record open / inner sections closed", locale, path,
          await page.evaluate(() => document.documentElement.scrollHeight));
        await record.evaluate((element: HTMLDetailsElement) => { element.open = false; });
      }
      if (width === 375) await page.screenshot({ path: `generated-artifacts/ui-eight/${locale}-${index}-375.jpg`, type: "jpeg", quality: 90 });
      await page.locator("details").evaluateAll(elements => elements.forEach(element => element.setAttribute("open", "")));
      const metrics = await page.evaluate(() => {
        const tooSmall = [...document.querySelectorAll<HTMLElement>("a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button]")]
          .filter(element => {
            const box = element.getBoundingClientRect(), style = getComputedStyle(element);
            if (!box.width || !box.height || style.visibility !== "visible") return false;
            if (box.width <= 1 && box.height <= 1 && (style.clipPath !== "none" || style.clip !== "auto")) return false;
            if (element instanceof HTMLAnchorElement && !element.hash.startsWith("#source-")) {
              const paragraph = element.closest("p");
              if (paragraph && (paragraph.textContent || "").replace(element.textContent || "", "").trim().length > 20) return false;
            }
            return box.height < 43.9;
          }).map(element => ({ tag: element.tagName, text: element.textContent?.trim().slice(0, 75), height: element.getBoundingClientRect().height, class: element.className }));
        const smallInputs = [...document.querySelectorAll<HTMLInputElement>("input:not([type=hidden]),select,textarea")]
          .filter(element => element.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(element).fontSize) < 16)
          .map(element => ({ name: element.name, font: getComputedStyle(element).fontSize }));
        const rootClipped = [document.documentElement, document.body, document.querySelector("[data-public-ux]")!]
          .some(element => ["hidden", "clip"].includes(getComputedStyle(element).overflowX));
        const tinyText = [...document.querySelectorAll<HTMLElement>("[data-public-ux] *")]
          .filter(element => element.getBoundingClientRect().width > 0 &&
            [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) &&
            parseFloat(getComputedStyle(element).fontSize) < 13)
          .map(element => ({ text: element.textContent?.trim().slice(0, 65), font: getComputedStyle(element).fontSize, class: element.className }));
        return { width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, rootClipped, tooSmall, smallInputs, tinyText, height: document.documentElement.scrollHeight };
      });
      expect.soft(metrics.width, `${target}: ${JSON.stringify(metrics)}`).toBe(metrics.client);
      expect(metrics.client).toBe(width);
      expect(metrics.rootClipped, target).toBe(false);
      if (metrics.tooSmall.length) console.log("TAP", target, JSON.stringify(metrics.tooSmall));
      expect.soft(metrics.tooSmall, target).toEqual([]);
      expect.soft(metrics.smallInputs, target).toEqual([]);
      if (metrics.tinyText.length) console.log("FONT", target, JSON.stringify(metrics.tinyText));
      expect.soft(metrics.tinyText, target).toEqual([]);
      if (width === 375 && path.startsWith("/stock/")) console.log("UI-8 all record sections open", locale, path, metrics.height);
    }
  });
}
for (const locale of ["ar", "en"] as const) {
  test(`UI-8 fixture ${locale}: 1.1 and every status stay phone-first`, async ({ page }) => {
    const prefix = locale === "en" ? "/en" : "";
    for (const status of ["passes_selected_methodology", "fails_selected_methodology", "requires_review", "insufficient_data", "none"]) {
      await page.goto(`${prefix}/stock/ui-eight-fixture?status=${status}`);
      await page.evaluate(() => document.fonts.ready);
      const summary = page.locator('[data-section="why"]');
      const result = status === "none" ? summary.locator('[class*="noRun"]') : summary.locator('[class*="largeBadge"]');
      expect((await result.boundingBox())!.y).toBeLessThan(400);
      if (status !== "none") {
        const reason = summary.locator("ul li").first();
        if (await reason.count()) expect((await reason.boundingBox())!.y + (await reason.boundingBox())!.height).toBeLessThan(812);
        await expect(summary).toContainText(locale === "ar" ? "الإصدار 1.1 · مسودة" : "Version 1.1 · Draft");
      }
      const record = page.locator('[data-section="full-record"]');
      await record.evaluate((element: HTMLDetailsElement) => { element.open = true; });
      await expect(page.locator("[data-record-version]")).toContainText(locale === "ar" ? "ويعتمد على افتراض الحد الأعلى لدى سهيل" : "Suhail's upper-bound assumption");
      await expect(record.locator("details[open]")).toHaveCount(0);
      await page.locator("details").evaluateAll(elements => elements.forEach(element => element.setAttribute("open", "")));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    }
    await page.goto(`${prefix}/stock/ui-eight-fixture?status=longlabel`);
    await page.locator("details").evaluateAll(elements => elements.forEach(element => element.setAttribute("open", "")));
    await expect(page.locator('[data-section="why"]')).toContainText("UnmappedStoredVersion" + "X".repeat(128));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  });
}
