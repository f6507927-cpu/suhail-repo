import { expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { checkRegister } from "../src/lib/copy-register";

export async function checkPublicUi(page: Page, info: TestInfo, label: string) {
  const publicText = await page.locator("body").innerText();
  const locale = await page.locator("html").getAttribute("lang") === "en" ? "en" : "ar";
  // Includes rendered DB content and shared/hard-coded text, not just dictionaries.
  expect(checkRegister(publicText, locale).hardBans.filter(term =>
    /^(recommendation|advice|should buy)$/i.test(term)), `${label}: public regulatory copy`).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: page overflow`).toBe(true);
  const escaped = await page.locator("main *").evaluateAll(nodes => nodes.filter(node => {
    const element = node as HTMLElement;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || getComputedStyle(element).position === "fixed") return false;
    if (rect.left >= -1 && rect.right <= innerWidth + 1) return false;
    // Content may extend inside an explicitly contained, reachable scroll region.
    let parent = element.parentElement;
    while (parent && parent.tagName !== "MAIN") {
      if (["auto", "scroll"].includes(getComputedStyle(parent).overflowX)) {
        const box = parent.getBoundingClientRect();
        if (box.left >= -1 && box.right <= innerWidth + 1) return false;
      }
      parent = parent.parentElement;
    }
    return true;
  }).map(node => `${node.tagName}: ${node.textContent?.slice(0, 80)}`));
  expect(escaped, `${label}: escaped elements`).toEqual([]);
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(item => item.impact === "serious" || item.impact === "critical");
  expect(violations, `${label}: axe serious/critical`).toEqual([]);
  const markers = (await page.locator("body").innerText()).split("⟦AR-REVIEW⟧").length - 1;
  console.log(`${label}: visible ⟦AR-REVIEW⟧ count=${markers}`);
  await info.attach(`${label}-markers`, { body: JSON.stringify({ label, markers }), contentType: "application/json" });
  await info.attach(`${label}-screenshot`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}

export async function checkCriteriaReachability(page: Page) {
  const region = page.locator('[data-section="criteria"] [role="region"]');
  const table = region.locator("table");
  if (await table.isVisible()) {
    await region.scrollIntoViewIfNeeded();
    await expect(region).toHaveAttribute("tabindex", "0");
    await region.evaluate(element => { element.scrollLeft = 0; });
    await expect(table.locator("thead th").first()).toBeInViewport();
    await region.evaluate(element => { element.scrollLeft = getComputedStyle(element).direction === "rtl" ? -element.scrollWidth : element.scrollWidth; });
    await expect(table.locator("thead th").last()).toBeInViewport();
    const headers = await table.locator("thead th").evaluateAll(nodes => nodes.map(node => {
      const style = getComputedStyle(node);
      return (node.getBoundingClientRect().height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 1) / parseFloat(style.lineHeight);
    }));
    expect(headers.every(lines => lines <= 2.15), `header lines ${headers}`).toBe(true);
  } else {
    await expect(page.locator('[data-section="criteria"] article').first()).toBeVisible();
    await expect(page.locator('[data-section="criteria"] article').last()).toBeVisible();
  }
}
