import { test, expect } from "@playwright/test";
const paths = ["/", "/search?q=a", "/search?q=zzzz", "/stock/nyse-ko",
  "/methodology", "/methodology/al-rajhi-adapted", "/auth/sign-in", "/terms", "/privacy"];
for (const locale of ["ar", "en"]) for (const path of paths) {
  test(`UI-1B ${locale}: ${path} has no rendered review annotations`, async ({ page }) => {
    test.setTimeout(90000);
    // D-218: the default CI runner serves seeded synthetic records, not live
    // Coca-Cola/Al Rajhi records. Explicit preview runs retain their live paths.
    const target = test.info().config.metadata.publicFixture
      ? path.replace("/stock/nyse-ko", "/stock/demo-fixa").replace("/methodology/al-rajhi-adapted", "/methodology/example-a")
      : path;
    const url = locale === "en" ? `/en${target === "/" ? "" : target}` : target;
    const response = await page.goto(url);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    const content = await page.evaluate(() => {
      // Include initially closed evidence and accessible labels, not script/HTML fingerprints.
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const values: string[] = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.parentElement?.closest("script, style")) values.push(node.textContent ?? "");
      }
      for (const element of document.querySelectorAll("[aria-label],[placeholder],[title],[alt]"))
        for (const attribute of ["aria-label", "placeholder", "title", "alt"])
          values.push(element.getAttribute(attribute) ?? "");
      return values.join("\n");
    });
    expect(content).not.toContain("⟦");
    expect(await page.title()).not.toContain("⟦");
    if (path === "/terms" || path === "/privacy") {
      await expect(page.locator("article")).toBeVisible();
      expect(await page.locator("article").innerText()).not.toMatch(/LEGAL-REVIEW|AR-REVIEW/);
    }
  });
}
