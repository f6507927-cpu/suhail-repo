import { expect, test } from "@playwright/test";
import { approvedArabicCopy } from "../src/i18n/approved-arabic";
import { checkPublicUi } from "./public-ui-checks";

for (const locale of ["ar", "en"] as const) {
  const home = locale === "en" ? "/en" : "/";
  const prefix = locale === "en" ? "/en" : "";
  for (const screen of ["header", "signin", "consent", "account", "enroll", "verify", "users", "deferred", "methodologies", "not-found", "error", "global-error"]) {
    test(`${locale} ${screen}: keyboard-operable public home`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${home}?screen=${screen}`);
      const link = page.locator(`a[href="${home}"]`).first();
      await expect(link).toBeVisible();
      for (let index = 0; index < 18 && !(await link.evaluate(el => el === document.activeElement)); index++) await page.keyboard.press("Tab");
      await expect(link).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(home);
      await expect(page.getByRole("heading", { name: "Suhail home" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
  for (const mode of ["enroll", "verify"]) {
    test(`${locale} ${mode}: AAL1-safe exit and unchanged successful continuation`, async ({ page }) => {
      const target = `${prefix}/admin/methodologies?methodology=parent`;
      const fixtureUrl = `${home}?screen=${mode}&next=${encodeURIComponent(target)}&identity=admin`;
      await page.goto(fixtureUrl);
      await expect(page.locator('a[href*="/admin"]')).toHaveCount(0);
      await expect(page.locator("[data-back-direction]")).toHaveCount(0);
      await expect(page.locator('main form[action*="/auth/sign-out"]')).toHaveCount(0);
      const exit = page.locator(`main a[href="${home}"]`);
      await expect(exit).toHaveCount(1);
      await exit.click();
      await expect(page).toHaveURL(home);
      // Successful verification still honors its validated protected continuation.
      await page.goto(fixtureUrl);
      if (mode === "enroll") {
        await page.getByRole("button", { name: locale === "ar" ? approvedArabicCopy["Begin setup"] : "Begin setup" }).click();
      }
      await page.locator('input[autocomplete="one-time-code"]').fill("123456");
      await page.getByRole("button", { name: locale === "ar" ? approvedArabicCopy["Verify and continue"] : "Verify and continue" }).click();
      await expect(page).toHaveURL(target);
    });
  }
  test(`${locale}: one selection-aware methodology breadcrumb, anchors and reload`, async ({ page }) => {
    const method = "11111111-1111-4111-8111-111111111111", version = "22222222-2222-4222-8222-222222222222";
    await page.goto(`${prefix}/admin/methodologies?methodology=${method}&version=${version}`);
    const breadcrumb = page.getByRole("navigation", { name: locale === "ar" ? approvedArabicCopy.Breadcrumb : "Breadcrumb", exact: true });
    await expect(breadcrumb).toHaveCount(1);
    await expect(breadcrumb).toContainText(locale === "ar" ? approvedArabicCopy.Methodologies : "Methodologies");
    await expect(breadcrumb).toContainText("UI fixture methodology");
    await expect(breadcrumb).toContainText("UI v1");
    await expect(page.locator("#criteria-record nav")).toHaveCount(0);
    await expect(page.locator('section[aria-labelledby="reports-title"] nav')).toHaveCount(0);
    await expect(page.locator("[data-back-direction]")).toHaveCount(0);
    await page.locator('a[href="#criteria-record"]').click();
    await expect(page).toHaveURL(/#criteria-record$/);
    await page.locator('a[href="#reports-title"]').click();
    await expect(page).toHaveURL(/#reports-title$/);
    await page.getByRole("button").filter({ hasText: "UI v3" }).click();
    await expect(breadcrumb).toContainText("UI v3");
    await expect(breadcrumb).not.toContainText("UI v1");
    await page.reload();
    await expect(breadcrumb).toHaveCount(1);
    await expect(breadcrumb).toContainText("UI v3");
    // Select the other methodology, then prove the selected parent/child survives reload.
    await page.getByRole("button").filter({ hasText: "Second UI methodology" }).click();
    await expect(breadcrumb).toContainText("Second UI methodology");
    await expect(breadcrumb).toContainText("Second v2");
    await page.reload();
    await expect(breadcrumb).toHaveCount(1);
    await expect(breadcrumb).toContainText("Second v2");
    expect(await page.locator('main [style*="gradient"]').count()).toBe(0);
  });
  for (const width of [390, 1366]) test(`${locale} ${width}: admin cards and navigation matrix`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${prefix}/admin/methodologies?methodology=11111111-1111-4111-8111-111111111111&version=22222222-2222-4222-8222-222222222222`);
    await checkPublicUi(page, info, `method-admin-${locale}-${width}`);
  });
}
