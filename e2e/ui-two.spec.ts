import { expect, test } from "@playwright/test";

for (const locale of ["ar", "en"] as const) {
  test(`UI-2 ${locale}: phone dates, named ratio operands and quiet stored close`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 874 });
    await page.goto(`${locale === "en" ? "/en" : ""}/stock/ui-two-fixture`);
    const panel = page.locator('[data-section="why"]');
    const dataDate = panel.locator('time[datetime="2025-12-31"]');
    await expect(dataDate).toHaveText(locale === "ar" ? "31 ديسمبر 2025" : "December 31, 2025");
    await expect(panel).toContainText(locale === "ar"
      ? "الديون بفوائد $64.8B ÷ أساس القيمة السوقية $919B"
      : "Interest-bearing debt $64.8B ÷ Market value basis $919B");
    if (locale === "ar") {
      const bidi = await dataDate.evaluate(element => {
        const numbers = element.querySelectorAll("bdi");
        return { direction: getComputedStyle(element).direction, font: getComputedStyle(element).fontFamily,
          day: numbers[0].getBoundingClientRect().x, year: numbers[1].getBoundingClientRect().x };
      });
      expect(bidi.direction).toBe("rtl");
      expect(bidi.font).not.toMatch(/mono/i);
      expect(bidi.day).toBeGreaterThan(bidi.year);
    }
    const closing = page.locator("[data-stored-close]");
    await expect(closing).toBeVisible();
    await expect(closing).toContainText("$344.63");
    await expect(closing).toContainText(locale === "ar" ? "سعر الإغلاق في 30 أكتوبر 2026" : "Closing price on October 30, 2026");
    await expect(closing.locator('a[href="https://api-ninjas.com"]')).toBeVisible();
    expect(await closing.evaluate(element => getComputedStyle(element).gridColumn)).toBe("1 / -1");
    const record = page.locator('details[data-section="full-record"]');
    await expect(record).not.toHaveAttribute("open");
    await record.locator(":scope > summary").click();
    const fundamentals = page.locator('[data-section="fundamentals"]');
    await expect(fundamentals.locator("caption")).toHaveCount(1);
    await expect(fundamentals).toContainText("$80,111,000,000");
    await expect(fundamentals).not.toContainText("USD");
    await expect(page.locator('[data-section="history"]')).toContainText(locale === "ar" ? "4 نوفمبر 2026" : "November 4, 2026");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
