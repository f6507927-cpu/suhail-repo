import { expect, test, type Page, type Route } from "@playwright/test";
import { createHash } from "node:crypto";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";

// D-168: the phone menu gives immediate feedback, ignores a second tap and
// reaches the homepage stock search with a client-side navigation.
// Runs in the isolated hydration production build (playwright.hydration.config.ts).

test.use({ viewport: { width: 375, height: 812 } });

test.beforeEach(async ({ context }, info) => {
  const bytes = createHash("sha256").update(info.testId).digest();
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `198.20.${bytes[0]}.${bytes[1]}` });
});

/** Hold homepage RSC responses (prefetch and navigation) to imitate a cold instance. */
async function holdHomeRsc(page: Page, home: string) {
  let release!: () => void;
  const released = new Promise<void>(resolve => { release = resolve; });
  const held: string[] = [];
  await page.route("**/*", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.headers()["rsc"] === "1" && url.pathname === home) {
      held.push(url.href);
      await released;
    }
    await route.continue();
  });
  return { release, held };
}

function header(page: Page, locale: "ar" | "en") {
  const messages = locale === "ar" ? ar : en;
  const root = page.locator("header");
  const menu = root.getByRole("button", { name: messages.nav.menu, exact: true });
  const screen = root.getByRole("link", { name: locale === "ar" ? "افحص سهماً" : "Screen a stock", exact: true });
  return { root, menu, screen, progress: root.locator('[class*="progress"]') };
}

for (const locale of ["ar", "en"] as const) {
  const prefix = locale === "en" ? "/en" : "";
  const home = prefix || "/";

  test(`D-168 ${locale}: menu "screen a stock" from methodology is one client navigation with feedback`, async ({ page }) => {
    const documents: string[] = [];
    page.on("request", request => {
      if (request.resourceType() === "document") documents.push(request.url());
    });
    // Installed before load: the visible brand link prefetches the homepage too.
    const { release } = await holdHomeRsc(page, home);
    await page.goto(`${prefix}/methodology`);
    await page.waitForLoadState("load");
    documents.length = 0;
    await page.evaluate(() => { (window as unknown as { __sameDocument: boolean }).__sameDocument = true; });
    const historyBefore = await page.evaluate(() => history.length);

    const { root, menu, screen, progress } = header(page, locale);
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await screen.click();

    // Immediate feedback while the server has not answered yet.
    await expect(screen).toHaveAttribute("data-pending", "true");
    await expect(screen).toHaveAttribute("aria-disabled", "true");
    await expect(progress).toHaveAttribute("data-active", "true");
    await expect(root).toHaveAttribute("data-navigating", "true");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(page).toHaveURL(`${prefix}/methodology`);

    // A second tap during the wait does not start another navigation.
    // force: the link is aria-disabled now, which Playwright would otherwise wait out.
    await screen.click({ force: true });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => history.length)).toBe(historyBefore);

    release();
    await expect(page).toHaveURL(`${home}#stock-query`);
    await expect(page.locator("#stock-query")).toBeFocused();
    await expect(page.locator("#stock-query")).toBeInViewport();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(progress).toHaveAttribute("data-active", "false");
    await expect(root).not.toHaveAttribute("data-navigating", /.*/);
    expect(await page.evaluate(() => history.length)).toBe(historyBefore + 1);
    // Client-side: same document, no full page load.
    expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBe(true);
    expect(documents).toEqual([]);
  });

  test(`D-168 ${locale}: on the homepage the menu link only scrolls and focuses`, async ({ page }) => {
    await page.goto(home);
    await page.waitForLoadState("load");
    await page.evaluate(() => { (window as unknown as { __sameDocument: boolean }).__sameDocument = true; });
    const { menu, screen, progress } = header(page, locale);
    await page.locator("footer").scrollIntoViewIfNeeded();
    await menu.click();
    await screen.click();
    await expect(page).toHaveURL(`${home}#stock-query`);
    await expect(page.locator("#stock-query")).toBeFocused();
    await expect(page.locator("#stock-query")).toBeInViewport();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(progress).toHaveAttribute("data-active", "false");
    expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBe(true);
  });

  test(`D-168 ${locale}: reduced motion keeps the indicator but drops its animation`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { release } = await holdHomeRsc(page, home);
    await page.goto(`${prefix}/methodology`);
    await page.waitForLoadState("load");
    const { menu, screen, progress } = header(page, locale);
    await menu.click();
    await screen.click();
    await expect(progress).toHaveAttribute("data-active", "true");
    await expect(progress).toBeVisible();
    expect(await progress.evaluate(element => getComputedStyle(element).animationName)).toBe("none");
    release();
    await expect(page.locator("#stock-query")).toBeFocused();
  });
}
