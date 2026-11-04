import { expect, test } from "@playwright/test";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
import { stripPublicReviewMarker } from "../src/components/foundation/shared";
import { startSearchEdgeFixture } from "../tests/search-edge/http-fixture";
import { checkCriteriaReachability, checkPublicUi } from "./public-ui-checks";

for (const locale of ["ar", "en"] as const) {
  test(`UX-4 ${locale}: native AAPL submit, screened link and zzzz no coverage`, async ({ page, context }) => {
    const prefix = locale === "en" ? "/en" : "";
    const messages = locale === "ar" ? ar : en;
    await context.setExtraHTTPHeaders({ "X-Forwarded-For": locale === "ar" ? "192.0.2.241" : "192.0.2.242" });
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(prefix || "/");
    await expect(page.locator("header button[aria-pressed]")).toBeEnabled();
    const input = page.locator("#stock-query");
    await expect(input).toHaveAttribute("placeholder", messages.publicSearch.placeholder);
    await expect(input).toHaveAttribute("spellcheck", "false");
    await expect(input).toHaveAttribute("autocapitalize", "characters");
    await expect(input).toHaveAttribute("enterkeyhint", "search");
    const examples = page.locator("[data-home-search-examples] a");
    await expect(examples).toHaveCount(3);
    for (const [index, ticker] of ["AAPL", "NVDA", "KO"].entries()) {
      await expect(examples.nth(index)).toHaveAttribute("href", `${prefix}/search?q=${ticker}`);
      const box = await examples.nth(index).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    const searchRequests: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname === `${prefix}/search`) searchRequests.push(request.url());
    });
    await input.fill("a");
    await input.fill("AAPL");
    expect(searchRequests).toEqual([]);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**${prefix}/search?q=AAPL`, async route => { await gate; await route.continue(); });
    let pendingSnapshot: { disabled: boolean; busy: string | null; spinner: number } | undefined;
    await page.exposeFunction("captureSearchSubmission", (value: typeof pendingSnapshot) => { pendingSnapshot = value; });
    await page.evaluate(() => {
      window.addEventListener("submit", () => {
        const button = document.querySelector<HTMLButtonElement>("main button[type=submit]")!;
        void (window as unknown as { captureSearchSubmission: (value: { disabled: boolean; busy: string | null; spinner: number }) => Promise<void> })
          .captureSearchSubmission({ disabled: button.disabled, busy: button.getAttribute("aria-busy"), spinner: button.querySelectorAll("svg").length });
      }, { once: true });
    });
    const submit = page.getByRole("button", { name: messages.publicSearch.screenSubmit, exact: true });
    try {
      await submit.click({ noWaitAfter: true });
      // Capture after React's submit handler, before native navigation
      // suspends the old document. The destination is still blocked above.
      await expect.poll(() => pendingSnapshot).toEqual({ disabled: true, busy: "true", spinner: 1 });
    } finally { release(); }
    await expect(page).toHaveURL(`${prefix}/search?q=AAPL`);
    const result = page.locator(`main a[href="${prefix}/stock/nasdaq-aapl"]`);
    await expect(result).toHaveCount(1);
    await expect(page.locator("main li .status-pass, main li .status-review, main li .status-fail, main li .status-insufficient")).toHaveCount(1);
    await expect(page.locator("[data-home-search-examples]")).toHaveCount(0);
    await result.click();
    await expect(page).toHaveURL(`${prefix}/stock/nasdaq-aapl`);
    await expect(page.locator("main")).toContainText("AAPL");
    await expect(page.locator("[data-home-search-examples]")).toHaveCount(0);
    await page.goto(`${prefix}/search?q=zzzz`);
    const empty = page.locator("[data-search-no-coverage]");
    await expect(empty).toContainText(messages.publicSearch.noResults);
    await expect(empty.locator("a")).toHaveCount(5);
    await expect(empty.locator("[data-stock-request-slot]")).toHaveCount(1);
    await expect(empty.locator("button")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("AR-REVIEW");
    await page.goto(`${prefix}/search?q=FIXN`);
    const row = page.locator("main li").filter({ hasText: "FIXN" });
    await expect(row).toContainText(`${messages.publicSearch.listedPrefix} · ${messages.publicSearch.notScreened}`);
    await expect(row.locator("a")).toHaveCount(0);
  });
}

test("UX-4 GET search works with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.243" } });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await page.locator("#stock-query").fill("AAPL");
    await page.getByRole("button", { name: "افحص", exact: true }).click();
    await expect(page).toHaveURL("/search?q=AAPL");
    await expect(page.locator('main a[href="/stock/nasdaq-aapl"]')).toHaveCount(1);
  } finally { await context.close(); }
});

for (const locale of ["ar", "en"] as const) {
  test(`UX-1 ${locale}: public home, empty search and stock presentation`, async ({ page }) => {
    const prefix = locale === "en" ? "/en" : "";
    for (const path of [prefix || "/", `${prefix}/search?q=ux-one-uncovered-fixture`, `${prefix}/stock/demo-fixa`]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("body")).not.toContainText("⟦AR-REVIEW⟧");
      await expect(page.locator("[data-language-notice]")).toHaveCount(path.includes("/stock/") && locale === "ar" ? 1 : 0);
      for (const obsolete of ["PUBLIC SCREENING RECORD", "SCREENING RESULT", "STORED RUN EVIDENCE",
        "DOCUMENTED RULE SET", "CRITERION RECORD", "CURRENT PERIOD FACTS", "PROVENANCE",
        "APPEND-ONLY RUNS", "IMMUTABLE RUN RECORD", "EXPLANATION OBJECT"])
        await expect(page.locator("body")).not.toContainText(obsolete);
      if (path.includes("/search")) {
        await expect(page.locator("main")).toContainText(locale === "ar" ? ar.publicSearch.noResults : en.publicSearch.noResults);
        await expect(page.locator('[data-search-no-coverage] a[href*="/stock/"]')).toHaveCount(5);
      }
    }
  });
}

for (const locale of ["ar", "en"] as const) for (const width of [390, 1366]) {
  test(`${locale} ${width}: real public UI matrix and unmatched global 404`, async ({ page, browser }, info) => {
    const prefix = locale === "en" ? "/en" : "";
    const messages = locale === "en" ? en : ar;
    await page.setViewportSize({ width, height: 900 });
    for (const path of [prefix || "/", `${prefix}/search?q=FIX`, `${prefix}/stock/demo-fixa`, `${prefix}/methodology`]) {
      await page.goto(path);
      await expect(page.locator("body")).not.toContainText("⟦AR-REVIEW⟧");
      await expect(page.locator("[data-language-notice]")).toHaveCount(path.includes("/stock/") && locale === "ar" ? 1 : 0);
      if (path.includes("/stock/")) {
        await expect(page.locator("header input[name=q]")).toHaveCount(0);
        await expect(page.locator('[data-section="search-again"] input[name=q]')).toHaveCount(1);
        await checkCriteriaReachability(page);
      } else if (path === (prefix || "/") || path.includes("/search")) {
        await expect(page.locator("header input[name=q]")).toHaveCount(0);
      }
      await expect(page.getByText(messages.disclaimer.full, { exact: true })).toHaveCount(1);
      await expect(page.locator('footer a[href="#full-disclaimer"]')).toHaveCount(1);
      if (path.includes("/search") && width === 1366) {
        const columns = await page.locator("main ul > li").evaluateAll(rows => rows.map(row =>
          Array.from(row.children).map((cell, index) => Math.round(cell.getBoundingClientRect()[index === 3 && getComputedStyle(row).direction !== "rtl" ? "right" : "left"]))));
        expect(columns.length).toBeGreaterThan(1);
        expect(columns.every(row => row.every((left, index) => Math.abs(left - columns[0][index]) <= 1))).toBe(true);
      }
      await checkPublicUi(page, info, `real-${locale}-${width}-${path.replaceAll("/", "-").replaceAll("?", "-")}`);
      if (path.includes("/stock/")) {
        await page.locator('[data-section="search-again"] input[name=q]').fill("FIXA");
        await page.locator('[data-section="search-again"] button[type=submit]').click();
        await expect(page).toHaveURL(`${prefix}/search?q=FIXA`);
        await expect(page.locator("main")).toContainText("FIXA");
      }
    }
    const missing = `${prefix}/missing-public-ui-route`;
    await page.goto(`${prefix}/search?q=launch-uncovered-fixture`);
    await expect(page.locator("main")).toContainText(messages.publicSearch.noResults);
    await checkPublicUi(page, info, `unmet-search-${locale}-${width}`);
    const response = await page.goto(missing);
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page).toHaveTitle(`${locale === "ar" ? "الصفحة غير موجودة" : "Page not found"} | Suhail`);
    await expect(page.locator('a[href="/"]')).not.toHaveCount(0);
    await expect(page.locator('a[href="/en"]')).not.toHaveCount(0);
    await checkPublicUi(page, info, `global-404-${locale}-${width}`);
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 900 } });
    const recovery = await noJs.newPage();
    expect((await recovery.goto(`http://127.0.0.1:3500${missing}`))?.status()).toBe(404);
    await recovery.locator('a[href="/en"]').click();
    await expect(recovery).toHaveURL("http://127.0.0.1:3500/en");
    await noJs.close();
  });
}

test.describe("local edge policy in front of real query-driven SSR", () => {
  let edge: Awaited<ReturnType<typeof startSearchEdgeFixture>>;
  test.beforeAll(async () => { edge = await startSearchEdgeFixture(); });
  test.beforeEach(() => edge.reset());
  test.afterAll(async () => { await edge?.close(); });

  for (const locale of ["ar", "en"] as const) {
    test(`${locale} normal GET forms work through the local edge`, async ({ page, request }) => {
      const prefix = locale === "en" ? "/en" : "";
      await page.goto(`${edge.origin}${prefix || "/"}`);
      await page.locator("main input[name=q]").fill("FIXA");
      await page.locator("main button[type=submit]").click();
      await expect(page).toHaveURL(`${edge.origin}${prefix}/search?q=FIXA`);
      await expect(page.locator(`main a[href="${prefix}/stock/demo-fixa"]`)).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
      await expect(page.locator("header input[name=q]")).toHaveCount(0);
      await page.locator("main input[name=q]").fill("FIXB");
      await page.locator("main button[type=submit]").click();
      await expect(page).toHaveURL(`${edge.origin}${prefix}/search?q=FIXB`);
      await expect(page.locator(`main a[href="${prefix}/stock/demo-fixb"]`)).toBeVisible();
      const result = await request.get(`${edge.origin}${prefix}/search?q=FIXN`);
      expect(result.status()).toBe(200);
      expect(result.headers()["cache-control"]).toContain("no-store");
      expect(result.headers()["x-robots-tag"]).toContain("noindex");
      expect(result.headers()["set-cookie"]).toBeUndefined();
      expect(await result.text()).toContain((locale === "ar" ? ar : en).publicSearch.notScreened);
    });
  }

  test("shared locale budget blocks before origin, then recovers without affecting ISR", async ({ page, request }) => {
    for (let i = 0; i < 30; i++) {
      const response = await request.head(`${edge.origin}${i % 2 ? "/en" : ""}/search?q=FIXA&_rsc=${i}`, {
        headers: { "x-forwarded-for": `spoof-${i}`, "cf-connecting-ip": `spoof-${i}` },
      });
      expect(response.status()).toBe(200);
    }
    const forwarded = edge.upstreamRequests();
    for (const prefix of ["", "/en"]) {
      const response = await page.goto(`${edge.origin}${prefix}/search?q=FIXB`);
      expect(response?.status()).toBe(429);
      expect(response?.headers()["cache-control"]).toContain("no-store");
      expect(response?.headers()["x-robots-tag"]).toContain("noindex");
      expect(response?.headers()["set-cookie"]).toBeUndefined();
      await expect(page.locator('p[lang="ar"]')).toHaveText("تجاوزت الحد المسموح من الطلبات، حاول مجددا لاحقا");
      await expect(page.locator('p[lang="en"]')).toHaveText("You have exceeded the request limit. Please try again later.");
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    }
    expect(edge.upstreamRequests()).toBe(forwarded);
    for (const prefix of ["", "/en"]) {
      for (const path of ["/", "/stock/demo-fixa", "/methodology"]) {
        const response = await request.get(`${edge.origin}${prefix}${path}`);
        expect(response.status()).toBe(200);
        expect(response.headers()["cache-control"]).toContain("s-maxage=900");
        expect(response.headers()["cache-control"]).not.toContain("no-store");
        expect(response.headers()["set-cookie"]).toBeUndefined();
      }
    }
    edge.advance(60_000);
    const recovered = await request.get(`${edge.origin}/en/search?q=FIXB`);
    expect(recovered.status()).toBe(200);
    expect(await recovered.text()).toContain("demo-fixb");
    expect(recovered.headers()["cache-control"]).toContain("no-store");
  });
});

for (const locale of ["ar", "en"] as const) {
  const prefix = locale === "en" ? "/en" : "";
  const messages = locale === "ar" ? ar : en;
  test(`${locale} home and header submit real query-dependent public search`, async ({ page, request }) => {
    await page.goto(prefix || "/");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.app.tagline);
    await expect(page.getByText(messages.disclaimer.full, { exact: true })).toHaveCount(1);
    await expect(page.getByText(messages.disclaimer.short, { exact: true })).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(messages.controls.emptyBody);
    await expect(page.locator(`main a[href="${prefix}/methodology"]`)).toHaveText(messages.publicSearch.methodologyLine);
    await page.locator("main input[name=q]").fill("FIXA");
    await page.locator("main button[type=submit]").click();
    await expect(page).toHaveURL(`${prefix}/search?q=FIXA`);
    await expect(page.locator(`main a[href="${prefix}/stock/demo-fixa"]`)).toBeVisible();
    await expect(page.locator("main")).toContainText(messages.status.passes_selected_methodology);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
    await expect(page.locator("header input[name=q]")).toHaveCount(0);
    await page.locator("main input[name=q]").fill("FIXB");
    await page.locator("main button[type=submit]").click();
    await expect(page).toHaveURL(`${prefix}/search?q=FIXB`);
    await expect(page.locator(`main a[href="${prefix}/stock/demo-fixb"]`)).toBeVisible();
    await expect(page.locator("main")).toContainText(messages.status.requires_review);
    await expect(page.locator('main a[href$="/demo-fixa"]')).toHaveCount(0);
    const response = await request.get(`${prefix}/search?q=FIXN`);
    expect(response.status()).toBe(200);
    expect(response.headers()["set-cookie"]).toBeUndefined();
    expect(response.headers()["cache-control"]).toContain("no-store");
    // A raw document response, not hydrated client enumeration.
    expect((await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")).toContain(messages.publicSearch.notScreened);
    await page.goto(`${prefix}/search?q=no-such-fixture`);
    await expect(page.locator("main")).toContainText(stripPublicReviewMarker(messages.publicSearch.noResults));
    await expect(page.locator('main a[href*="/stock/"]')).toHaveCount(0);
    await page.goto(`${prefix}/search?q=%20%20`);
    await expect(page.locator("main")).toContainText(stripPublicReviewMarker(messages.publicSearch.hint));
    await expect(page.locator('main a[href*="/stock/"]')).toHaveCount(0);
    await page.goto(`${prefix}/search?q=${"x".repeat(41)}`);
    await expect(page.locator("main")).toContainText(stripPublicReviewMarker(messages.publicSearch.hint));
    await expect(page.locator('main a[href*="/stock/"]')).toHaveCount(0);
    for (const query of [" fixn ", "fixn", "tUrE nEw"]) {
      await page.goto(`${prefix}/search?q=${encodeURIComponent(query)}`);
      await expect(page.locator(`main a[href="${prefix}/stock/demo-new"]`)).toBeVisible();
    }
    // No company name in this fixture contains these literal wildcard strings.
    for (const query of ["IXN", "%", "_", "\\", "' OR 1=1 --", "x".repeat(40)]) {
      await page.goto(`${prefix}/search?q=${encodeURIComponent(query)}`);
      await expect(page.locator("main")).toContainText(stripPublicReviewMarker(messages.publicSearch.noResults));
      await expect(page.locator('main a[href*="/stock/"]')).toHaveCount(0);
    }
    await page.goto(`${prefix}/search?q=FIXA&q=FIXB`);
    await expect(page.locator("main")).toContainText(stripPublicReviewMarker(messages.publicSearch.hint));
    await expect(page.locator('main a[href*="/stock/"]')).toHaveCount(0);
  });
  test(`${locale} SQL Arabic matching survives actual route rendering and locale navigation`, async ({ page }) => {
    for (const query of ["ابل", "أبل", "إيمان", "ايمان", "آفاق", "افاق", "مدرسه", "مدرسة", "فتي", "فتى", "مـدّ", "مد"]) {
      await page.goto(`${prefix}/search?q=${encodeURIComponent(query)}`);
      await expect(page.locator(`main a[href="${prefix}/stock/demo-new"]`)).toBeVisible();
      await expect(page.locator("main")).toContainText(locale === "ar" ? "أبل إيمان آفاق مدرسة فتى مـدّ" : "Fixture New Co");
    }
    await page.goto(`${prefix}/search?q=${encodeURIComponent("ـّـ")}`);
    await expect(page.locator("main")).toContainText(stripPublicReviewMarker(messages.publicSearch.noResults));
    await page.goto(`${prefix}/search?q=FIXA`);
    await page.getByRole("link", { name: locale === "ar" ? "تغيير اللغة" : "Change language", exact: true }).click();
    const otherPrefix = locale === "ar" ? "/en" : "";
    await expect(page).toHaveURL(`${otherPrefix}/search`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale === "ar" ? "en" : "ar");
  });
}
