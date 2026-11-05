import { expect, test } from "@playwright/test";
const statuses = ["passes_selected_methodology", "fails_selected_methodology", "requires_review", "insufficient_data", "none"];
for (const locale of ["ar", "en"] as const) {
  test(`UI-3 ${locale}: every stock state fits the first phone screen`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const prefix = locale === "ar" ? "" : "/en";
    for (const status of statuses) {
      await page.goto(`${prefix}/stock/ui-three-fixture?status=${status}`);
      const summary = page.locator('[data-section="why"]');
      const header = page.locator('[data-section="header"]');
      await expect(header).toContainText("FIX");
      expect((await header.innerText()).match(/NASDAQ/g)).toHaveLength(1);
      expect(await header.locator('[class*="identityLine"]').evaluate(element =>
        [...element.children].every(child => getComputedStyle(child).borderTopWidth === "0px"))).toBe(true);
      expect((await header.locator('[class*="identityLine"]').boundingBox())!.height).toBeLessThan(26);
      await expect(header.locator('[class*="identityLine"]')).toContainText("·");
      const intro = page.locator('[data-section="intro"]');
      const introBox = await intro.boundingBox();
      // D-166: the compact intro remains usable as a 44px touch target.
      expect(introBox!.height).toBeGreaterThanOrEqual(44);
      expect(introBox!.height).toBeLessThanOrEqual(64);
      expect(await intro.evaluate(element => getComputedStyle(element).borderInlineStartWidth)).toBe("0px");
      if (status !== "none") {
        const badge = summary.locator('[class*="largeBadge"]');
        await expect(badge).toBeVisible();
        const badgeBox = await badge.boundingBox();
        expect(badgeBox!.y + badgeBox!.height).toBeLessThan(812);
        const reason = summary.locator("ul li").first();
        if (status !== "passes_selected_methodology") {
          await expect(reason).toBeVisible();
          const reasonBox = await reason.boundingBox();
          expect(reasonBox!.y + reasonBox!.height).toBeLessThan(812);
        }
        const share = page.locator('[data-section="share"]');
        await expect(share).toBeVisible();
        expect((await share.boundingBox())!.y).toBeGreaterThan((await summary.boundingBox())!.y);
        expect(await summary.evaluate(element => {
          return [...element.querySelectorAll("*"), element].every(node => {
            const style = getComputedStyle(node);
            // A filled status badge/bar can have its required status border/marker.
            return node.matches('[class*="largeBadge"], [class*="largeBadge"] *, [class*="ratioLimit"], svg, svg *')
              || style.borderInlineStartWidth === style.borderInlineEndWidth;
          });
        })).toBe(true);
        if (status === "passes_selected_methodology") {
          await expect(summary).not.toContainText("No additional status reasons");
          await expect(summary).not.toContainText("لم تُسجّل أسباب إضافية");
          await expect(summary).not.toContainText(locale === "ar" ? "ما لا نعرفه" : "What we don't know");
          const financialPass = summary.locator('[data-ux-ratio][data-result="pass"]').first();
          await expect(financialPass).toBeVisible();
        }
        if (status === "fails_selected_methodology") {
          const failed = summary.locator('[data-ux-ratio][data-result="fail"]').first();
          await expect(failed).toBeVisible();
          await expect(failed.locator("..").locator('[style*="inset-inline-start"]')).toHaveCount(1);
        }
      } else {
        await expect(page.locator('[data-section="share"]')).toHaveCount(0);
        await expect(page.locator("[data-stored-close]")).toHaveCount(0);
        await expect(summary.locator("article")).toHaveCount(0);
        await expect(page.locator('[data-section="figures"]')).toHaveCount(0);
        await expect(page.locator('[data-section="search-again"]')).toBeVisible();
        expect((await summary.boundingBox())!.y).toBeLessThan(812);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('details[data-section="full-record"]')).not.toHaveAttribute("open");
    }
  });
}

test("UI-3 real preview: Apple, JPM and KO at both requested widths", async ({ page }) => {
  test.setTimeout(120_000); // Six real Next pages can include a cold development compile.
  const origin = process.env.UI_THREE_PUBLIC_ORIGIN;
  test.skip(!origin, "Read-only public-preview verification requires an explicit origin.");
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    for (const slug of ["nasdaq-aapl", "nyse-jpm", "nyse-ko"]) {
      await page.goto(`${origin}/stock/${slug}`, { waitUntil: "networkidle" });
      const summary = page.locator('[data-section="why"]');
      const badge = summary.locator('[class*="largeBadge"]');
      await expect(badge).toBeVisible();
      expect((await badge.boundingBox())!.y + (await badge.boundingBox())!.height).toBeLessThan(812);
      const reason = summary.locator("ul li").first();
      if (await reason.count()) expect((await reason.boundingBox())!.y + (await reason.boundingBox())!.height).toBeLessThan(812);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const metadata = summary.locator('[data-section="summary-metadata"]');
      await expect(metadata.locator("[data-meta]")).toHaveCount(3);
      expect(await page.locator('[class*="identityLine"]').evaluate(element =>
        [...element.children].every(child => getComputedStyle(child).borderTopWidth === "0px"))).toBe(true);
      expect((await page.locator('[class*="identityLine"]').boundingBox())!.height).toBeLessThan(26);
      await expect(page.locator('[data-section="share"]')).toBeVisible();
      await expect(page.locator('details[data-section="full-record"]')).not.toHaveAttribute("open");
    }
  }
});
