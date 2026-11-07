import { test, expect } from "@playwright/test";

// D-174 / D-166: phone-first checks of the "Other methodologies" section.
for (const locale of ["ar", "en"] as const) {
  for (const width of [375, 360, 390]) {
    test(`${locale} ${width}px: separate results, switcher and remembered choice`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      const prefix = locale === "ar" ? "" : "/en";
      await page.goto(`${prefix}/stock/demo-fixa`);
      const section = page.locator('[data-section="other-methodologies"]');
      await expect(section).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      // First visit: the site default is selected and every other result is listed.
      await expect(section.locator('[data-selected-methodology="example-a"]')).toBeVisible();
      await expect(section.locator('[data-methodology-card="example-b"]')).toBeVisible();
      await expect(section.locator('[data-methodology-card="example-b"] .status-pass, [data-methodology-card="example-b"] .status-fail, [data-methodology-card="example-b"] .status-review, [data-methodology-card="example-b"] .status-insufficient')).toBeVisible();
      for (const option of await section.locator("[data-methodology-option]").all())
        expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width === 375) await page.screenshot({ path: `generated-artifacts/other-methodologies-${locale}-375.png`, fullPage: true });
      // Switching is remembered in this browser only and reflected in ?m=.
      await section.locator('[data-methodology-option="example-b"]').click();
      await expect(section.locator('[data-methodology-option="example-b"]')).toHaveAttribute("aria-pressed", "true");
      await expect(page).toHaveURL(/[?&]m=example-b/);
      await page.goto(`${prefix}/stock/demo-fixa`);
      await expect(section.locator('[data-selected-methodology="example-b"]')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // A ?m= link selects explicitly; choosing the default clears the saved choice.
      await page.goto(`${prefix}/stock/demo-fixa?m=example-a`);
      await expect(section.locator('[data-selected-methodology="example-a"]')).toBeVisible();
      await section.locator('[data-methodology-option="example-a"]').click();
      await page.goto(`${prefix}/stock/demo-fixa`);
      await expect(section.locator('[data-selected-methodology="example-a"]')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}
