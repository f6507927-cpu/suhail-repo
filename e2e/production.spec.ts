import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { checkPublicUi } from "./public-ui-checks";
test.beforeEach(async ({context}, testInfo) => {
  // Local HTTP clients only: independent synthetic IP budget per test. This
  // exercises the real limiter, not a runtime bypass or platform forwarding claim.
  const bytes = createHash("sha256").update(testInfo.testId).digest();
  await context.setExtraHTTPHeaders({"x-forwarded-for": `198.18.${bytes[0]}.${bytes[1]}`});
});

for (const locale of ["ar", "en"] as const) for (const width of [390, 1366]) {
  test(`@public-ui actual global 404 ${locale} ${width}`, async ({ page, browser }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const path = `${locale === "en" ? "/en" : ""}/missing-public-ui-route`;
    expect((await page.goto(path))?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page).toHaveTitle(`${locale === "ar" ? "الصفحة غير موجودة" : "Page not found"} | Suhail`);
    await checkPublicUi(page, info, `production-global-404-${locale}-${width}`);
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 900 } });
    const recovery = await noJs.newPage();
    expect((await recovery.goto(`http://127.0.0.1:3200${path}`))?.status()).toBe(404);
    await expect(recovery.locator('a[href="/en"]')).toBeVisible();
    await expect(recovery.locator('a[href="/"]').first()).toBeVisible();
    await noJs.close();
  });
}

test("@search production home ISR and dynamic search have separate caching boundaries", async ({ request }) => {
  const manifest = JSON.parse(readFileSync(".next/prerender-manifest.json", "utf8"));
  expect(manifest.dynamicRoutes["/[locale]"]).toMatchObject({ response: "empty", compute: "blocking" });
  expect(manifest.dynamicRoutes).not.toHaveProperty("/[locale]/search");
  for (const prefix of ["", "/en"]) {
    const home = await request.get(prefix || "/");
    expect(home.status()).toBe(200);
    expect(home.headers()["cache-control"]).toContain("s-maxage=900");
    expect(home.headers()["set-cookie"]).toBeUndefined();
    const again = await request.get(prefix || "/");
    expect(again.headers()["x-nextjs-cache"]).toBe("HIT");
    for (const query of ["", "?q=%20%20", `?q=${"a".repeat(41)}`]) {
      const response = await request.get(`${prefix}/search${query}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect(response.headers()["set-cookie"]).toBeUndefined();
      const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
      expect(html).toContain('name="robots" content="noindex, follow"');
      expect(html).toContain("Enter 1–40 characters");
      expect(html).not.toMatch(/href="(?:\/en)?\/stock\//);
    }
  }
});
import enMessages from "../src/i18n/messages/en.json";
import arMessages from "../src/i18n/messages/ar.json";
import { approvedArabicCopy } from "../src/i18n/approved-arabic";

for (const locale of ["ar", "en"] as const) {
  const prefix = locale === "en" ? "/en" : "";
  const title = locale === "ar" ? approvedArabicCopy.Methodologies : "Methodologies";
  const messages=locale==="ar"?arMessages:enMessages;
  test(`@security ${locale} actual public/auth/404 home links and no auth Back control`, async ({page}) => {
    for (const path of [prefix||"/", `${prefix}/auth/sign-in?error=cancelled`, `${prefix}/auth/sign-in?error=provider`, `${prefix}/missing-navigation-page`]) {
      const client=createHash("sha256").update(`${locale}:${path}`).digest();
      await page.context().setExtraHTTPHeaders({"x-forwarded-for":`198.18.${client[0]}.${client[1]}`});
      const response = await page.goto(path);
      if (path.endsWith("missing-navigation-page")) expect(response?.status()).toBe(404);
      const home=page.locator(`a[href="${prefix||"/"}"]`).first();
      await expect(home).toBeVisible();
      await home.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(prefix||"/");
      await expect(page.getByRole("heading",{level:1})).toHaveText(messages.app.tagline);
    }
    await page.context().setExtraHTTPHeaders({"x-forwarded-for":`198.18.255.${locale==="ar"?1:2}`});
    await page.goto(`${prefix}/auth/sign-in?next=${encodeURIComponent(`${prefix}/admin/methodologies`)}`);
    await expect(page.locator("[data-back-direction]")).toHaveCount(0);
    await page.locator(`a[href="${prefix||"/"}"]`).first().click();
    await expect(page).toHaveURL(prefix||"/");
  });

  test(`${locale} public Methodologies link opens a truthful cookie-free destination`, async ({
    page, request,
  }) => {
    test.skip(Boolean(process.env.CI), "D-78: database-available checks run in a configured runtime; database-free CI runs the cold ISR suite.");
    let profiles = 0;
    page.on("request", (req) => {
      if (new URL(req.url()).pathname === "/api/account/profile") profiles++;
    });
    await page.goto(prefix || "/");
    const link = page.locator("header").getByRole("link", { name: title, exact: true });
    await expect(link).toHaveAttribute("href", `${prefix}/methodology`);
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`${prefix}/methodology`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.methodologies.title);
    await expect(page.getByRole("main").getByText(locale === "ar" ? "هذا القسم غير متاح بعد" : "This section is not available yet", { exact: true })).toHaveCount(0);
    await expect(page.locator("#content")).toHaveCount(1);
    expect(profiles).toBe(0);
    const response = await request.get(`${prefix}/methodology`);
    expect(response.status()).toBe(200);
    expect(response.headers()["set-cookie"]).toBeUndefined();
    expect(response.headers()["cache-control"]).toContain("s-maxage=900");
    // A same-path locale switch must not drop the user onto a missing page.
    await page.getByRole("link", { name: locale === "ar" ? "تغيير اللغة" : "Change language", exact: true }).click();
    await expect(page).toHaveURL(locale === "ar" ? "/en/methodology" : "/methodology");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(locale === "ar" ? enMessages.methodologies.title : arMessages.methodologies.title);
  });
  test(`${locale} example-a public documentation renders literal criteria and no-margin evidence`,async({page,request})=>{
    test.skip(Boolean(process.env.CI), "D-78: database-available checks run in a configured runtime; database-free CI runs the cold ISR suite.");
    const response = await page.goto(`${prefix}/methodology/example-a`);
    expect(response?.status()).toBe(200);
    await expect(page.getByText(messages.banner.exampleMethodology,{exact:true})).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    const row=page.getByRole("row").filter({hasText:"Accounts receivable"});
    await expect(row).toContainText(messages.stock.noMarginDefined);
    await expect(page.getByText(messages.methodology.pageNote,{exact:true})).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir",locale==="ar"?"rtl":"ltr");
    const html=await request.get(`${prefix}/methodology/example-a?version=private-version`);
    expect(html.headers()["set-cookie"]).toBeUndefined();
    expect(html.headers()["cache-control"]).toContain("s-maxage=900");
    const body=await html.text();
    expect(body).not.toContain("analyst_test_cases");
    expect(body).not.toContain("workflow_history");
  });
  test(`@security ${locale} public methodology HTML and ISR headers are independent of cookies`,async({request})=>{
    test.skip(Boolean(process.env.CI), "D-78: cached data checks run in a configured runtime; database-free CI runs the cold ISR suite.");
    for(const path of [prefix||"/",`${prefix}/methodology`,`${prefix}/methodology/example-a`]) {
      const anonymous=await request.get(path);
      const cookieRequest=await request.get(path,{headers:{Cookie:"public-cache-probe=synthetic; theme=light"}});
      expect(anonymous.status()).toBe(200);
      expect(anonymous.headers()["set-cookie"]).toBeUndefined();
      expect(anonymous.headers()["vary"]?.toLowerCase()??"").not.toContain("cookie");
      expect(anonymous.headers()["cache-control"]).toBe(cookieRequest.headers()["cache-control"]);
      expect(cookieRequest.status()).toBe(200);
      expect(cookieRequest.headers()["cache-control"]).toContain("s-maxage=900");
      expect(cookieRequest.headers()["set-cookie"]).toBeUndefined();
      expect(cookieRequest.headers()["vary"]?.toLowerCase()??"").not.toContain("cookie");
      expect(await cookieRequest.text()).toBe(await anonymous.text());
    }
  });
}

test("@security encoded private roots including dotted descendants stay private over actual HTTP", async ({
  request,
}) => {
  for (const path of [
    "/%61dmin",
    "/%65n/%61dmin",
    "/en/%61uth/sign-in",
    "/en/%61dmin/hidden.json",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    const headers = response.headers();
    expect(headers["cache-control"]).toContain("private");
    expect(headers["cache-control"]).toContain("no-store");
    expect(headers["cdn-cache-control"]).toBe("no-store");
    expect(headers["x-robots-tag"]).toContain("noindex");
    expect(headers["content-security-policy"]).toMatch(/nonce-[^']+'/);
  }
  const malformed = await request.get("/%ZZ", { maxRedirects: 0 });
  expect(malformed.status()).toBe(400);
  const publicResponse = await request.get("/en/terms", {
    headers: { "x-private-path": "/en/admin", "x-nonce": "spoofed" },
    maxRedirects: 0,
  });
  expect(publicResponse.headers()["content-security-policy"]).toContain("'unsafe-inline'");
  expect(publicResponse.headers()["set-cookie"]).toBeUndefined();
});
test("@security private production scripts use nonce CSP and restore theme; legal remains cookie-free ISR", async ({
  page,
  request,
}) => {
  const violations: string[] = [];
  page.on("pageerror", (error) => violations.push(`${page.url()} pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (
      message.type() === "error" ||
      (message.type() === "warning" && /hydrat|server.render|script/i.test(message.text()))
    )
      violations.push(`${page.url()} console.${message.type()}: ${message.text()}`);
  });
  await page.addInitScript(() => localStorage.setItem("suhail-theme", "light"));
  let profiles = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/account/profile")) profiles++;
  });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "تسجيل الدخول" })).toBeVisible();
  expect(profiles).toBe(0);
  const response = await page.goto("/en/auth/sign-in?next=%2Fen%2Faccount");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("'strict-dynamic'");
  const nonce = /nonce-([^']+)/.exec(csp)?.[1];
  expect(nonce).toBeTruthy();
  const scripts = await page
    .locator("script")
    .evaluateAll((elements) => elements.map((element) => element.nonce));
  expect(scripts.every((value) => value === nonce)).toBe(true);
  expect(violations).toEqual([]);
  const legal = await request.get("/en/terms");
  expect(legal.headers()["set-cookie"]).toBeUndefined();
  expect(legal.headers()["content-security-policy"]).toContain("'unsafe-inline'");
  expect(legal.headers()["cache-control"]).toContain("s-maxage=900");
  expect(await legal.text()).toContain("⟦LEGAL-REVIEW⟧");
});

test("styleguide excluded in production in both locales; shell is static and health unchanged", async ({
  request,
}) => {
  for (const url of ["/styleguide", "/en/styleguide"])
    expect((await request.get(url)).status()).toBe(404);
  for (const [url, locale, dir] of [
    ["/", "ar", "rtl"],
    ["/en", "en", "ltr"],
  ]) {
    const response = await request.get(url);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["set-cookie"]).toBeUndefined();
    expect(await response.text()).toContain(`lang="${locale}" dir="${dir}"`);
  }
  expect(await (await request.get("/api/health")).json()).toMatchObject({
    status: "ok",
  });
  expect((await request.get("/manifest.webmanifest")).ok()).toBeTruthy();
});

const publicHomes = {
  ar: {
    path: "/",
    dir: "rtl",
    theme: "تغيير المظهر",
    language: "تغيير اللغة",
    skip: "الانتقال إلى المحتوى",
    disclaimer: "إخلاء المسؤولية الكامل",
  },
  en: {
    path: "/en",
    dir: "ltr",
    theme: "Change theme",
    language: "Change language",
    skip: "Skip to content",
    disclaimer: "Full disclaimer",
  },
} as const;

async function expectHomeTheme(
  page: Page,
  locale: keyof typeof publicHomes,
  theme: "dark" | "light",
) {
  const home = publicHomes[locale];
  await expect(page).toHaveURL(new RegExp(`${home.path}$`));
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("dir", home.dir);
  const control = page.getByRole("button", { name: home.theme, exact: true });
  // Enabled and aria-pressed prove hydration, not just the before-paint script.
  await expect(control).toBeEnabled();
  await expect(control).toHaveAttribute("aria-pressed", String(theme === "dark"));
  if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
  else await expect(page.locator("html")).not.toHaveClass(/dark/);
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
}

async function expectTouchHeader(page: Page) {
  await expectNoHorizontalOverflow(page);
  const header = page.getByRole("banner");
  const controls = header.locator("a, button");
  expect(await controls.count()).toBeGreaterThanOrEqual(6);
  for (const control of await controls.all()) {
    await expect(control).toBeVisible();
    // Full bounds, not just intersection: a partially clipped control fails.
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    const viewport = page.viewportSize()!;
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    // Playwright checks enabled, stable, and receiving touch events without
    // navigating away through each header link.
    await control.tap({ trial: true });
  }
}

test.describe("@phone public production touch controls", () => {
  for (const locale of ["ar", "en"] as const) {
    test(`${locale}: header fits, theme and locale respond to touch, full disclaimer is readable`, async ({
      page,
      context,
      browser,
      browserName,
    }, testInfo) => {
      // Record the actual engine, not only a Safari-looking user agent.
      if (testInfo.project.name.startsWith("webkit-iphone-")) {
        expect(browserName).toBe("webkit");
        expect(browser.browserType().name()).toBe("webkit");
      }
      await testInfo.attach("touch-browser", {
        body: JSON.stringify({
          engine: browser.browserType().name(),
          version: browser.version(),
          viewport: page.viewportSize(),
          userAgent: await page.evaluate(() => navigator.userAgent),
        }),
        contentType: "application/json",
      });
      const home = publicHomes[locale];
      const otherLocale = locale === "ar" ? "en" : "ar";
      const otherHome = publicHomes[otherLocale];
      await page.goto(home.path);
      expect(await page.evaluate(() => localStorage.getItem("suhail-theme"))).toBeNull();
      await expectHomeTheme(page, locale, "dark");
      await expectTouchHeader(page);

      await page.getByRole("button", { name: home.theme, exact: true }).tap();
      await expectHomeTheme(page, locale, "light");
      expect(await page.evaluate(() => localStorage.getItem("suhail-theme"))).toBe("light");
      await expectTouchHeader(page);
      await page.reload();
      await expectHomeTheme(page, locale, "light");

      await page.getByRole("link", { name: home.language, exact: true }).tap();
      await expectHomeTheme(page, otherLocale, "light");
      await expectTouchHeader(page);
      await page.getByRole("button", { name: otherHome.theme, exact: true }).tap();
      await expectHomeTheme(page, otherLocale, "dark");
      expect(await page.evaluate(() => localStorage.getItem("suhail-theme"))).toBe("dark");
      await page.getByRole("link", { name: otherHome.language, exact: true }).tap();
      await expectHomeTheme(page, locale, "dark");
      await page.reload();
      await expectHomeTheme(page, locale, "dark");
      await expectTouchHeader(page);
      // A fresh document in another tab must restore the saved choice too.
      const restored = await context.newPage();
      await restored.goto(home.path);
      await expectHomeTheme(restored, locale, "dark");
      await restored.close();

      const details = page.locator("#full-disclaimer");
      const paragraph = details.locator("p");
      await expect(details.locator("summary")).toHaveCount(0);
      await expect(paragraph).toBeVisible();
      await page.getByRole("link", { name: home.disclaimer, exact: true }).tap();
      await expect(page).toHaveURL(/#full-disclaimer$/);
      await expect(paragraph).toBeVisible();
      // Check the entire current disclaimer, including the Arabic review
      // placeholder, rather than accepting only its first sentence.
      await expect(paragraph).toHaveText((locale==="ar"?arMessages:enMessages).disclaimer.full);
      await expectNoHorizontalOverflow(page);
      const textLines = () => paragraph.evaluate((element) => {
        function textRects() {
          // LocalizedText may wrap review wording in an inline-block span.
          // Measure text nodes, not the wrapper's single aggregate rectangle.
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          const rects: DOMRect[] = [];
          let node: Node | null;
          while ((node = walker.nextNode())) {
            if (!node.textContent?.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            rects.push(...Array.from(range.getClientRects()));
          }
          return rects;
        }
        return textRects().map((rect) => ({
          left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        }));
      });
      await paragraph.evaluate((element) => {
        element.scrollIntoView({ block: "end", behavior: "instant" });
      });
      // WebKit may settle scrolling after evaluate returns. Poll the rendered
      // text instead of assuming synchronous scroll coordinates.
      await expect.poll(async () => (await textLines()).at(-1)!.bottom)
        .toBeLessThanOrEqual(page.viewportSize()!.height);
      const lines = await textLines();
      expect(lines.length).toBeGreaterThan(1);
      const viewport = page.viewportSize()!;
      for (const line of lines) {
        expect(line.left).toBeGreaterThanOrEqual(0);
        expect(line.right).toBeLessThanOrEqual(viewport.width);
      }
      expect(lines.at(-1)!.top).toBeGreaterThanOrEqual(0);
      expect(lines.at(-1)!.bottom).toBeLessThanOrEqual(viewport.height);
      await expectNoHorizontalOverflow(page);
    });
  }
});

for (const locale of ["ar", "en"] as const) {
  const home = publicHomes[locale];
  const otherLocale = locale === "ar" ? "en" : "ar";
  const otherHome = publicHomes[otherLocale];

  test(`public production ${locale}: hydrated theme persists through reloads and locale switches`, async ({
    page,
  }) => {
    // Use real user choices; an init script resetting storage on navigation
    // would mask a broken toggle or persistence implementation.
    await page.goto(home.path);
    expect(await page.evaluate(() => localStorage.getItem("suhail-theme"))).toBeNull();
    await expectHomeTheme(page, locale, "dark");
    await page.getByRole("button", { name: home.theme, exact: true }).click();
    await expectHomeTheme(page, locale, "light");
    expect(await page.evaluate(() => localStorage.getItem("suhail-theme"))).toBe("light");
    await page.reload();
    await expectHomeTheme(page, locale, "light");

    await page.getByRole("link", { name: home.language, exact: true }).click();
    await expectHomeTheme(page, otherLocale, "light");
    await page.reload();
    await expectHomeTheme(page, otherLocale, "light");
    await page.getByRole("button", { name: otherHome.theme, exact: true }).click();
    await expectHomeTheme(page, otherLocale, "dark");
    expect(await page.evaluate(() => localStorage.getItem("suhail-theme"))).toBe("dark");
    await page.reload();
    await expectHomeTheme(page, otherLocale, "dark");

    await page.getByRole("link", { name: otherHome.language, exact: true }).click();
    await expectHomeTheme(page, locale, "dark");
    await page.reload();
    await expectHomeTheme(page, locale, "dark");
  });

  test(`public production ${locale}: keyboard skip link and full disclaimer work`, async ({
    page,
  }) => {
    await page.goto(home.path);
    await expectHomeTheme(page, locale, "dark");
    const skip = page.getByRole("link", { name: home.skip, exact: true });
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#content$/);
    await expect(page.getByRole("main")).toHaveAttribute("id", "content");
    await expect(page.getByRole("main")).toBeInViewport();
    // Non-tabindex main landmarks receive the browser's sequential-focus start.
    // The next Tab must bypass the header, not return to its navigation.
    await page.keyboard.press("Tab");
    const main = page.getByRole("main");
    await expect(main.getByRole("searchbox")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(main.getByRole("button", { name: (locale === "ar" ? arMessages : enMessages).publicSearch.submit, exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(main.getByRole("link")).toBeFocused();
    await page.keyboard.press("Tab");
    const details = page.locator("#full-disclaimer");
    await expect(page.getByRole("link", { name: home.disclaimer, exact: true })).toBeFocused();
    await expect(details.locator("summary")).toHaveCount(0);
    await expect(details.locator("p")).toBeVisible();

    // The full disclosure is already visible; its native anchor works without JS.
    await page.getByRole("link", { name: home.disclaimer, exact: true }).click();
    await expect(page).toHaveURL(/#full-disclaimer$/);
    await expect(details.locator("p")).toBeVisible();
    await expect(details.locator("p")).toHaveText((locale==="ar"?arMessages:enMessages).disclaimer.full);
  });
}
