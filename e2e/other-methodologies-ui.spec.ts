import { test, expect } from "@playwright/test";

// D-174 / D-166: the real section and switcher on a DB-free fixture page.
for (const locale of ["ar", "en"] as const) {
  for (const width of [375, 360, 390]) {
    test(`${locale} ${width}px: separate results, switcher, saved choice, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      const base = locale === "ar" ? "/" : "/en";
      await page.goto(base);
      const section = page.locator('[data-section="other-methodologies"]');
      await expect(section).toBeVisible();
      await expect(section.locator('[data-selected-methodology="al-rajhi-adapted"]')).toBeVisible();
      await expect(section.locator("[data-methodology-card]")).toHaveCount(2);
      await expect(section.locator('[data-methodology-card="msci-islamic-adapted"]')).toContainText("Accounts receivable and cash / total assets");
      await expect(section.locator('[data-methodology-card="msci-islamic-adapted"] [data-debt-components]')).toBeVisible();
      await expect(section.locator('[data-methodology-card="msci-islamic-adapted"] bdi[dir="ltr"]').filter({ hasText: "%" }).first()).toHaveText("72.53% / 70%");
      for (const option of await section.locator("[data-methodology-option]").all())
        expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width === 375) await page.screenshot({ path: `generated-artifacts/other-methodologies-ui-${locale}-375.png`, fullPage: true });
      await section.locator('[data-methodology-option="msci-islamic-adapted"]').click();
      await expect(section.locator('[data-methodology-option="msci-islamic-adapted"]')).toHaveAttribute("aria-pressed", "true");
      await expect(section.locator("[data-methodology-card]")).toHaveCount(1);
      await expect(page).toHaveURL(/[?&]m=msci-islamic-adapted/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width === 375) await page.screenshot({ path: `generated-artifacts/other-methodologies-ui-${locale}-375-msci.png`, fullPage: true });
      // Remembered in this browser only.
      await page.goto(base);
      await expect(section.locator('[data-selected-methodology="msci-islamic-adapted"]')).toBeVisible();
      // A ?m= link wins over the saved choice; choosing the default clears it.
      await page.goto(`${base}?m=aaoifi-ss21-adapted`);
      await expect(section.locator('[data-selected-methodology="aaoifi-ss21-adapted"]')).toBeVisible();
      await section.locator('[data-methodology-option="al-rajhi-adapted"]').click();
      await page.goto(base);
      await expect(section.locator('[data-selected-methodology="al-rajhi-adapted"]')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}
