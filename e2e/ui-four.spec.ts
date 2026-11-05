import { test, expect } from "@playwright/test";
for (const locale of ["ar", "en"]) for (const width of [375, 1440]) {
  test(`UI-4 ${locale} ${width}: whole rows, focus and no empty suggestions`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    const prefix = locale === "ar" ? "" : "/en";
    await page.goto(`${prefix}/ui-four/search`);
    const rows = page.locator("main li > a");
    await expect(rows).toHaveCount(10);
    for (const row of await rows.all()) {
      expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(56);
      expect((await row.boundingBox())!.width).toBeGreaterThan(width === 375 ? 300 : 800);
      await expect(row.locator("a")).toHaveCount(0);
      expect(await row.evaluate(element => getComputedStyle(element).textDecorationLine)).toBe("none");
    }
    const first = rows.first();
    await first.focus();
    await expect(first).toBeFocused();
    const focused = await first.evaluate(element => {
      const style = getComputedStyle(element);
      return { outline: style.outlineStyle, shadow: style.boxShadow };
    });
    expect(focused.outline !== "none" || focused.shadow !== "none").toBe(true);
    const primary = first.locator("span").first();
    expect((await primary.boundingBox())!.height).toBeGreaterThan(0);
    const unscreened = rows.nth(4).locator('[role="status"]');
    expect(await unscreened.evaluate(element => getComputedStyle(element).borderWidth)).toBe("0px");
    const form = page.locator('form[role="search"]');
    expect(parseFloat(await form.evaluate(element => getComputedStyle(element).borderRadius))).toBeGreaterThan(30);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    // Activate the first row from its trailing blank area, not just its name.
    await first.click({ position: { x: 8, y: 8 } });
    await expect(page).toHaveURL(new RegExp(`${prefix}/stock/fixture-0$`));
    await page.goto(`${prefix}/ui-four/search?status=empty`);
    await expect(page.locator("main ul")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(locale === "ar" ? "جرّب:" : "Try:");
  });
}
