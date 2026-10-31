import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const diagnosticLogs = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  // Record actual document requests (not HMR history/soft refresh events).
  // Reload loops can otherwise look like an ordinary hydration timeout.
  const diagnostics: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      diagnostics.push(`document ${request.url()}`);
  });
  page.on("pageerror", (error) => diagnostics.push(`pageerror ${error.message}`));
  page.on("requestfailed", (request) =>
    diagnostics.push(`requestfailed ${request.url()} ${request.failure()?.errorText}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      diagnostics.push(`console ${message.type()} ${message.text()}`);
  });
  page.on("websocket", (socket) => {
    diagnostics.push(`websocket ${socket.url()}`);
    socket.on("framereceived", ({ payload }) => {
      // Keep protocol metadata, not streamed page data or session payloads.
      if (typeof payload !== "string" || !payload.startsWith("{")) return;
      try {
        const message = JSON.parse(payload);
        if (["reloadPage", "serverComponentChanges", "turbopack-connected"].includes(message.type))
          diagnostics.push(`hmr ${message.type}`);
      } catch {
        // Non-JSON websocket frames are normal in the development protocol.
      }
    });
  });
  await page.addInitScript(() => {
    // This counter survives reloads but is independent of the product's theme.
    const key = "foundation-document-count";
    sessionStorage.setItem(key, String(Number(sessionStorage.getItem(key) ?? 0) + 1));
  });
  test.info().annotations.push({ type: "origin", description: test.info().project.use.baseURL });
  diagnosticLogs.set(page, diagnostics);
});

test.afterEach(async ({ page }, testInfo) => {
  await testInfo.attach("browser-origin-and-reloads", {
    body: (diagnosticLogs.get(page) ?? []).join("\n"),
    contentType: "text/plain",
  });
  expect((diagnosticLogs.get(page) ?? []).filter((message) =>
    message.startsWith("pageerror ") || message.startsWith("console error ") ||
    (message.startsWith("console warning ") && /hydrat/i.test(message)),
  ), "No console errors, hydration warnings or uncaught page errors").toEqual([]);
});

for (const locale of ["ar", "en"] as const) {
  for (const theme of ["dark", "light"] as const) {
    test(`styleguide ${locale} ${theme}: screenshots and accessible components`, async ({
      page,
    }, testInfo) => {
      await page.addInitScript(
        (t) => localStorage.setItem("suhail-theme", t),
        theme,
      );
      await page.goto(locale === "ar" ? "/styleguide" : "/en/styleguide");
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        locale === "ar" ? "rtl" : "ltr",
      );
      if (theme === "dark")
        await expect(page.locator("html")).toHaveClass(/dark/);
      else await expect(page.locator("html")).not.toHaveClass(/dark/);
      await expect(
        page.getByRole("button", {
          name: locale === "ar" ? "تغيير المظهر" : "Change theme",
        }),
      ).toBeEnabled();
      await expectNoAutomaticReloads(page);
      await page.evaluate(() => document.fonts.ready);
      for (const surface of ["dark", "light"]) {
        const section = page.getByTestId(`surface-${surface}`);
        await expect(section.locator(".status-pass svg")).toHaveClass(
          /lucide-check/,
        );
        await expect(section.locator(".status-fail svg")).toHaveClass(
          /lucide-x/,
        );
        await expect(section.locator(".status-review svg")).toHaveClass(
          /lucide-triangle-alert/,
        );
        await expect(section.locator(".status-insufficient svg")).toHaveClass(
          /lucide-circle-help/,
        );
        const styles = await section
          .locator(".status-review")
          .evaluate((node) => ({
            border: getComputedStyle(node).borderWidth,
            fill: getComputedStyle(node).backgroundColor,
          }));
        expect(styles).toEqual({ border: "2px", fill: "rgba(0, 0, 0, 0)" });
      }
      const scan = await new AxeBuilder({ page }).analyze();
      expect(
        scan.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact ?? ""),
        ),
      ).toEqual([]);
      await mkdir("generated-artifacts/styleguide", { recursive: true });
      const screenshot = path.resolve(
        `generated-artifacts/styleguide/${locale}-${theme}.png`,
      );
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach(`styleguide-${locale}-${theme}`, {
        path: screenshot,
        contentType: "image/png",
      });
      await testInfo.attach("axe-results", {
        body: JSON.stringify(scan, null, 2),
        contentType: "application/json",
      });
    });
  }
}
test("same-path locale switching, persisted theme and full disclaimer", async ({
  page,
}) => {
  await page.goto("/styleguide");
  await page.getByRole("link", { name: "تغيير اللغة" }).click();
  await expect(page).toHaveURL(/\/en\/styleguide$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.getByRole("button", { name: "Change theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("link", { name: "Change language" }).click();
  await expect(page).toHaveURL(/\/styleguide$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "تغيير المظهر" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("link", { name: "إخلاء المسؤولية الكامل" }).click();
  await expect(page.locator("#full-disclaimer")).toHaveAttribute("open", "");
});
async function expectNoAutomaticReloads(page: Page, expectedDocuments = 1) {
  // Give the development HMR handshake time to settle. Do not suppress it:
  // controls must hydrate and the document must remain the original load.
  await page.waitForTimeout(1_000);
  expect(await page.evaluate(() => Number(sessionStorage.getItem("foundation-document-count")))).toBe(expectedDocuments);
}
test("default theme, home locales, keyboard and no external font requests", async ({
  page,
}) => {
  const externalFonts: string[] = [];
  page.on("request", (req) => {
    if (/fonts\.googleapis|fonts\.gstatic/.test(req.url()))
      externalFonts.push(req.url());
  });
  let documentCount = 0;
  for (const [url, locale, dir] of [
    ["/", "ar", "rtl"],
    ["/en", "en", "ltr"],
  ]) {
    await page.goto(url);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", dir);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(
      page.getByRole("button", {
        name: locale === "ar" ? "تغيير المظهر" : "Change theme",
      }),
    ).toBeEnabled();
    await expectNoAutomaticReloads(page, ++documentCount);
    await page.keyboard.press("Tab");
    await expect(page.locator('a[href="#content"]')).toBeFocused();
  }
  expect(externalFonts).toEqual([]);
});
