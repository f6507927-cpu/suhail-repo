import { expect, test } from "@playwright/test";
for (const locale of ["ar", "en"] as const) for (const width of [390, 1366]) {
  test(`UI-1 ${locale} ${width}: all statuses, full record, home and search`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const prefix = locale === "ar" ? "" : "/en";
    for (const status of ["passes_selected_methodology", "fails_selected_methodology", "requires_review", "insufficient_data", "none"]) {
      await page.goto(`${prefix}/stock/fixture?status=${status}`);
      const record = page.locator('details[data-section="full-record"]');
      await expect(record).not.toHaveAttribute("open");
      await record.locator(":scope > summary").click();
      await expect(record).toHaveAttribute("open", "");
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(/\b[a-z]+(?:_[a-z]+)+\b/);
      await expect(page.locator("[data-language-notice]")).toHaveCount(0);
      if (status !== "none") {
        await expect(record).toContainText("a".repeat(64));
        await expect(record).toContainText(locale === "ar" ? "الإصدار 1.0 · مسودة" : "Version 1.0 · Draft");
        expect(text).not.toMatch(/1\.00|0\.00/);
        const activity = page.locator('[data-section="why"] article').first();
        await expect(activity.locator('[role="img"]')).toHaveCount(0);
      }
    }
    await page.goto(prefix || "/");
    const card = page.locator('a[href$="/stock/fixture"]');
    await expect(card).toContainText(locale === "ar" ? "النشاط الرئيسي للشركة" : "Primary business activity");
    await expect(card.locator('[role="img"]')).toHaveCount(1);
    await page.goto(`${prefix}/search`);
    await expect(page.locator("[data-language-notice]")).toHaveCount(0);
    // UI-4 repeats the fallback English name in the primary and muted lines.
    await expect(page.getByText("English Company")).toHaveCount(2);
    await expect(page.getByText("English Company").first()).toBeVisible();
    await page.goto(`${prefix}/stock/fixture`);
    await page.locator('[data-section="why"] a[href*="/methodology/fixture"]').click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/methodology/fixture\\?version=1.0#methodology-fixture-version-1.0`));
    await expect(page.locator("h1")).toContainText(locale === "ar" ? "منهجية سهيل الأساسية" : "Suhail core methodology"); // D-181
    await expect(page.locator("body")).toContainText(locale === "ar" ? "فريق سهيل" : "The Suhail team");
    await expect(page.locator("#public-version-selector")).toContainText(locale === "ar" ? "الإصدار 1.0 · مسودة" : "Version 1.0 · Draft");
    await expect(page.locator("body")).not.toContainText("Adapted research 1.0");
    await page.goto(`${prefix}/methodology`);
    await expect(page.locator("h2")).toContainText(locale === "ar" ? "منهجية سهيل الأساسية" : "Suhail core methodology"); // D-181
    await page.locator('h2 a[href$="/methodology/fixture"]').click();
    await expect(page.locator("body")).toContainText(locale === "ar" ? "إعداد أولي للنسخة البحثية." : "Initial research version.");
  });
}
