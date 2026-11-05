import { test, expect } from "@playwright/test";
for (const locale of ["ar", "en"]) {
  test(`UI-5 ${locale}: compact phone methodology with complete closed evidence`, async ({ page, request }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const prefix = locale === "ar" ? "" : "/en";
    const path = `${prefix}/ui-five/methodology/fixture`;
    const html = await (await request.get(path)).text();
    expect(html).toContain("Stored technical definition 0.");
    expect(html).toContain("Stored treatment paragraph 0.");
    expect(html).not.toMatch(/\bD-\d+/);
    await page.goto(path);
    const cards = page.locator("article ol > li");
    await expect(cards).toHaveCount(3);
    const technical = cards.locator("details");
    await expect(technical).toHaveCount(3);
    expect(await technical.evaluateAll(elements => elements.every(element => !(element as HTMLDetailsElement).open))).toBe(true);
    await expect(page.getByText("Stored technical definition 0.")).not.toBeVisible();
    if (locale === "ar") await expect(page.locator("[data-language-notice]")).toHaveCount(1);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(height).toBeLessThan(2800);
    console.log("UI-5 fixture", locale, "closed phone height", height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    await technical.first().locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Stored technical definition 0.")).toBeVisible();
    await expect(technical.first()).toHaveAttribute("open", "");
  });
}
