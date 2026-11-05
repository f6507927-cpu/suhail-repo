import { test, expect } from "@playwright/test";
const paths = ["/", "/search?q=a", "/stock/nyse-ko", "/methodology", "/auth/sign-in"];
for (const width of [375, 768, 1440]) {
  test(`UI-6 actual pages: no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 812 });
    for (const [index, path] of paths.entries()) {
      const response = await page.goto(path, { waitUntil: "networkidle" });
      expect(response?.status(), path).toBe(200);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBe(width);
      // Every remaining hover/focus card owns its shape and padding.
      const cards = await page.locator("[data-ux-card]").evaluateAll(elements => elements.map(element => {
        const style = getComputedStyle(element);
        return { radius: parseFloat(style.borderTopLeftRadius), padding: parseFloat(style.paddingInlineStart) };
      }));
      for (const card of cards) {
        expect(card.radius, path).toBeGreaterThanOrEqual(20);
        expect(card.padding, path).toBeGreaterThan(0);
      }
      if (path === "/") {
        for (const company of await page.getByText("Example Co.", { exact: true }).all()) {
          const article = company.locator("xpath=ancestor::article[1]");
          await expect(article).not.toHaveAttribute("data-ux-card");
          const before = await article.evaluate(element => getComputedStyle(element).backgroundColor);
          await article.hover();
          expect(await article.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(before);
        }
        await expect(page.locator("footer").getByText("سهيل", { exact: true })).toBeVisible();
      }
      if (path !== "/auth/sign-in") {
        const language = page.locator("header a").filter({ hasText: /^English$/ }).first();
        expect((await language.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      } else {
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("button", { name: /Google/ })).toBeVisible();
        await expect(page.getByText("01 / 01", { exact: true })).toHaveCount(0);
        await expect(page.getByRole("link", { name: /شروط الاستخدام|Terms of Use/ })).toBeVisible();
      }
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `generated-artifacts/ui-six/${index}-${width}.jpg`, type: "jpeg", quality: 90 });
    }
  });
}
test("UI-6 public 404 retains search and both standalone home choices", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/stock/not-a-real-stock-ui-six", "/en/stock/not-a-real-stock-ui-six", "/no-such-page-ui-six"]) {
    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("search")).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    const search = page.getByRole("search");
    await search.locator('input[name="q"]').fill("KO");
    await search.getByRole("button", { name: /افحص|Screen/ }).click();
    await expect(page).toHaveURL(/\/(?:en\/)?search\?q=KO$/);
  }
});
test("UI-6 light styling stays public and retains legacy private control radius", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of paths) {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBe(375);
  }
  await page.goto("/search?q=a", { waitUntil: "networkidle" });
  const styles = await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    const sentinel = document.createElement("div");
    sentinel.className = "bg-card border rounded-md";
    sentinel.style.cssText = "width:16px;height:16px";
    document.body.append(sentinel); // Deliberately outside the public wrapper.
    const result = {
      legacy: getComputedStyle(document.documentElement).getPropertyValue("--radius").trim(),
      privateRadius: getComputedStyle(sentinel).borderRadius,
      publicInputRadius: getComputedStyle(document.querySelector('main input[name="q"]')!).borderRadius,
      publicButtonRadius: getComputedStyle(document.querySelector('main button[type="submit"]')!).borderRadius,
    };
    const language = [...document.querySelectorAll("header a")].find(anchor => anchor.textContent?.trim() === "English")!;
    const privateHeaderLink = language.cloneNode(true) as HTMLElement;
    document.body.append(privateHeaderLink);
    const privateHeaderMinHeight = getComputedStyle(privateHeaderLink).minHeight;
    privateHeaderLink.remove();
    sentinel.remove();
    return { ...result, privateHeaderMinHeight };
  });
  expect(parseFloat(styles.legacy)).toBe(0.5);
  expect(parseFloat(styles.privateRadius)).toBeLessThan(20);
  expect(parseFloat(styles.publicInputRadius)).toBe(999);
  expect(parseFloat(styles.publicButtonRadius)).toBe(999);
  expect(styles.privateHeaderMinHeight).not.toBe("44px");
});
