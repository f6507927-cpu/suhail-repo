import { expect, test, type Page } from "@playwright/test";
import { formatTimestamp } from "../src/lib/format";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
import { createHash } from "node:crypto";
import { securityHeaders } from "../src/security/headers";

const failures = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, context }, info) => {
  const bytes = createHash("sha256").update(info.testId).digest();
  await context.setExtraHTTPHeaders({"x-forwarded-for":`198.19.${bytes[0]}.${bytes[1]}`});
  const errors: string[] = [];
  failures.set(page, errors);
  // Install BEFORE goto/click/reload. No console error exemptions.
  page.on("console", (message) => {
    if (message.type() === "error" || (message.type() === "warning" && /hydrat|server.render|script/i.test(message.text())))
      errors.push(`${page.url()} console.${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`${page.url()} pageerror: ${error.stack ?? error.message}`));
  await context.addCookies([{ name: "hydration-session", value: "admin", url: "http://127.0.0.1:3500" }]);
});
test.afterEach(async ({ page }, info) => {
  const errors = failures.get(page) ?? [];
  await info.attach("route-console-and-page-errors", { body: errors.join("\n"), contentType: "text/plain" });
  expect(errors, "Every console error, hydration warning and page error is a regression").toEqual([]);
});

for (const locale of ["ar", "en"] as const) {
  test(`UX-3 ${locale}: 375px single-row header and keyboard-accessible menu`, async ({ page }) => {
    const prefix = locale === "en" ? "/en" : "";
    const messages = locale === "ar" ? ar : en;
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(prefix || "/");
    const header = page.locator("header");
    const menu = header.getByRole("button", { name: messages.nav.menu, exact: true, includeHidden: true });
    const language = header.getByRole("link", { name: messages.controls.locale, exact: true });
    const brand = header.getByRole("link", { name: messages.app.name, exact: true });
    const theme = header.getByRole("button", { name: messages.controls.theme, exact: true });
    const screen = header.getByRole("link", { name: locale === "ar" ? "افحص سهماً" : "Screen a stock", exact: true });
    const methodology = header.getByRole("link", { name: locale === "ar" ? "المنهجية" : "Methodology", exact: true });
    const panelId = await menu.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = page.locator(`[id="${panelId}"]`);
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
    await expect(language).toBeVisible();
    await expect(header.locator("form, input")).toHaveCount(0);
    await expect(header.locator('a[href*="/edition"], a[href*="/picks"]')).toHaveCount(0);
    const box = await header.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(72);
    const rowBoxes = await Promise.all([brand, menu, language].map(locator => locator.boundingBox()));
    const centers = rowBoxes.map(rect => rect!.y + rect!.height / 2);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(2);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: messages.controls.skip, exact: true });
    await expect(skip).toBeFocused();
    expect((await skip.boundingBox())!.y).toBeGreaterThanOrEqual(0);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`${prefix || "/"}#content`);
    await expect(page.locator("#content")).toHaveCount(1);

    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();
    await expect(theme).toBeEnabled();
    const panelBox = await panel.boundingBox();
    expect(Math.abs(panelBox!.width - box!.width)).toBeLessThanOrEqual(1);
    // The skip link can scroll the header; compare current geometry and allow
    // the real reduced-motion-aware reveal animation to reach its final state.
    await expect.poll(async () => {
      const currentHeader = await header.boundingBox();
      const currentPanel = await panel.boundingBox();
      return Math.abs(currentPanel!.y - (currentHeader!.y + currentHeader!.height));
    }).toBeLessThanOrEqual(2);
    await methodology.focus();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(menu).toBeFocused();
    await menu.click();
    await menu.click();
    await expect(panel).toBeHidden();

    await menu.click();
    await theme.click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem("suhail-theme"))).toBe("light");
    await screen.click();
    await expect(page).toHaveURL(`${prefix || "/"}#stock-query`);
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
    await menu.click();
    await methodology.click();
    await expect(page).toHaveURL(`${prefix}/methodology`);
    await expect(menu).toHaveAttribute("aria-expanded", "false");

    for (const width of [320, 375, 759, 760, 1440]) {
      await page.setViewportSize({ width, height: 812 });
      expect((await header.boundingBox())!.height).toBeLessThanOrEqual(72);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (width < 760) {
        await expect(menu).toBeVisible();
        await expect(panel).toBeHidden();
      } else {
        await expect(menu).toBeHidden();
        await expect(screen).toBeVisible();
        await expect(language).toBeVisible();
        await expect(theme).toBeVisible();
      }
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await menu.click();
    await page.setViewportSize({ width: 760, height: 812 });
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(panel).toBeHidden();
    await language.click();
    await expect(page.locator("html")).toHaveAttribute("lang", locale === "ar" ? "en" : "ar");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
}

/** D-149: phone header destinations live in the menu panel; open it only when needed. */
async function headerClick(page: Page, selector: string) {
  const target = page.locator(selector).first();
  const menu = page.locator("header").getByRole("button", { name: new RegExp(`^(${en.nav.menu}|${ar.nav.menu})$`) });
  if (!(await target.isVisible()) && await menu.isVisible() && (await menu.getAttribute("aria-expanded")) !== "true") {
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
  }
  await target.click();
}

async function checkTheme(page: Page, theme: string) {
  // toHaveURL can resolve at document commit, before delayed async chunks load.
  // Direct goto defaults to load; use that same boundary for link navigation.
  await page.waitForLoadState("load");
  if (/\/admin\/methodologies/.test(page.url())) {
    // The unchanged admin header has no theme toggle. Exercise a real client
    // state transition instead of treating static markup as hydrated UI.
    const messages = await page.locator("html").getAttribute("lang") === "ar" ? ar : en;
    const create = page.getByRole("button", { name: messages.governed.createMethodology, exact: true });
    await create.click();
    await expect(page.locator("form")).toHaveCount(2); // sign-out + metadata form
    await create.click();
    await expect(page.locator("form")).toHaveCount(1);
  } else {
    // D-149: on phones the theme toggle lives in the header menu. Opening the
    // menu is itself a hydrated client state change; then assert the toggle.
    const toggle = page.getByRole("button", { name: /Change theme|تغيير المظهر/, exact: true });
    const menu = page.locator("header").getByRole("button", { name: new RegExp(`^(${en.nav.menu}|${ar.nav.menu})$`) });
    if (!(await toggle.isVisible()) && await menu.isVisible()) {
      await menu.click();
      await expect(menu).toHaveAttribute("aria-expanded", "true");
    }
    await expect(toggle).toBeEnabled();
    if (await menu.isVisible() && (await menu.getAttribute("aria-expanded")) === "true") {
      await page.keyboard.press("Escape");
      await expect(menu).toHaveAttribute("aria-expanded", "false");
    }
  }
  expect(await page.locator("html").evaluate((node) => node.classList.contains("dark"))).toBe(theme === "dark");
  // This is browser paint timing, not a post-hydration theme assertion.
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("paint").length)).toBeGreaterThan(0);
  const timing = await page.evaluate(() => ({
    paints: performance.getEntriesByType("paint").map(({ name, startTime }) => ({ name, startTime })),
    restores: performance.getEntriesByName("theme-applied").map(({ startTime }) => startTime),
    reads: performance.getEntriesByName("theme-storage-read").length,
  }));
  expect(timing.restores, `theme restoration once per document: ${JSON.stringify(timing)}`).toHaveLength(1);
  expect(timing.reads).toBe(1);
  for (const paint of timing.paints)
    expect(timing.restores[0], `restore before ${paint.name}: ${JSON.stringify(timing)}`).toBeLessThanOrEqual(paint.startTime);
}

for (const locale of ["ar", "en"] as const) {
  const prefix = locale === "en" ? "/en" : "";
  for (const theme of ["light", "dark"] as const) {
    test(`${locale} ${theme}: real Next SSR, direct loads, reloads and route-group navigation`, async ({ page, request }) => {
      await page.addInitScript((saved) => {
        localStorage.setItem("suhail-theme", saved);
        const get = Storage.prototype.getItem;
        Storage.prototype.getItem = function(key) {
          if (key === "suhail-theme") performance.mark("theme-storage-read");
          return get.call(this, key);
        };
        const toggle = DOMTokenList.prototype.toggle;
        DOMTokenList.prototype.toggle = function(token, force) {
          const result = force === undefined ? toggle.call(this, token) : toggle.call(this, token, force);
          if (this === document.documentElement.classList && token === "dark")
            performance.mark("theme-applied");
          return result;
        };
      }, theme);
      // A fast local bootstrap must not conceal a first-paint theme flash.
      await page.route("**/_next/static/**/*.js", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 250));
        await route.continue();
      });
      await page.route("**/theme-restore.js", async (route) => {
        // Verify render blocking itself, not only a fast theme-resource race.
        await new Promise((resolve) => setTimeout(resolve, 350));
        await route.continue();
      });
      let phase = 0;
      for (const route of ["/", "/methodology", "/auth/sign-in", "/account", "/admin"]) {
        // These phases test hydration, not sustained auth traffic. Each phase
        // has its own local synthetic client; no limiter code is bypassed.
        const bytes=createHash("sha256").update(`${locale}:${theme}:${phase++}`).digest();
        await page.context().setExtraHTTPHeaders({"x-forwarded-for":`198.19.${bytes[0]}.${bytes[1]}`});
        await page.context().addCookies([{ name: "hydration-session", value: route === "/account" ? "user" : "admin", url: "http://127.0.0.1:3500" }]);
        const url = route === "/" ? prefix || "/" : `${prefix}${route}`;
        const response = await page.goto(url);
        expect(response?.status(), url).toBe(200);
        for (const [key,value] of Object.entries(securityHeaders)) {
          expect(response!.headers()[key.toLowerCase()],`${url}: ${key}`).toBe(value);
        }
        const html = await response!.text();
        // Assert real server markup before trusting any browser result.
        expect(html).toContain("<h1");
        expect(html).toContain("suhail-theme-restore");
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await checkTheme(page, theme);
        if (route === "/account") {
          const expected = formatTimestamp("2026-10-11T22:30:00Z", locale, { dateStyle: "medium" });
          expect(html).toContain(expected);
          await expect(page.getByText(expected, { exact: true })).toBeVisible();
        }
        if (["/auth/sign-in", "/account", "/admin"].includes(route)) {
          const csp = response!.headers()["content-security-policy"];
          const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
          expect(nonce).toBeTruthy();
          expect(csp).toContain("'strict-dynamic'");
          expect(csp.split(";").find((directive) => directive.trim().startsWith("script-src "))).not.toContain("'unsafe-inline'");
          const scripts = await page.locator("script").evaluateAll((nodes) => nodes.map((node) => node.nonce));
          expect(scripts.every((value) => value === nonce), `${url} script nonces`).toBe(true);
          expect(response!.headers()["cache-control"]).toContain("no-store");
        } else {
          expect(response!.headers()["cache-control"]).toContain("s-maxage=900");
          expect(response!.headers()["set-cookie"]).toBeUndefined();
          const cookieFree = await request.get(url);
          const cookieProbe = await request.get(url, { headers: { Cookie: "probe=synthetic; suhail-theme=light" } });
          expect(await cookieProbe.text()).toBe(await cookieFree.text());
          expect(cookieProbe.headers()["vary"] ?? "").not.toMatch(/cookie/i);
        }
        await page.reload();
        await checkTheme(page, theme);
      }

      // Real shared-header Link navigation within the public root, then normal
      // document links across public/private/admin roots (including /admin redirect).
      const navigationClient=createHash("sha256").update(`${locale}:${theme}:navigation`).digest();
      await page.context().setExtraHTTPHeaders({"x-forwarded-for":`198.19.${navigationClient[0]}.${navigationClient[1]}`});
      await page.goto(prefix || "/");
      await headerClick(page, `header a[href="${prefix}/methodology"]`);
      await expect(page).toHaveURL(`${prefix}/methodology`);
      await checkTheme(page, theme);
      await headerClick(page, `header a[href="${prefix}/auth/sign-in"]`);
      await expect(page).toHaveURL((url) => url.pathname === `${prefix}/auth/sign-in` && url.searchParams.get("next") === `${prefix}/methodology`);
      await checkTheme(page, theme);
      await headerClick(page, "header summary");
      await page.locator(`header a[href="${prefix}/account"]`).click();
      await expect(page).toHaveURL(`${prefix}/account`);
      await checkTheme(page, theme);
      await headerClick(page, "header summary");
      await page.locator(`header a[href="${prefix}/admin"]`).click();
      await expect(page).toHaveURL(`${prefix}/admin/methodologies`);
      await checkTheme(page, theme);
      await page.locator("header a[href]").first().click();
      await expect(page).toHaveURL(prefix || "/");
      await checkTheme(page, theme);
      await page.getByRole("link", { name: locale === "ar" ? "تغيير اللغة" : "Change language", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", locale === "ar" ? "en" : "ar");
      await checkTheme(page, theme);
    });
  }
}
