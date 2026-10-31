import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
// Only the external transport is isolated: the real Next start route and Supabase
// SDK generate the PKCE URL/cookies. No runtime auth bypass or real Google grant.
for (const prefix of ["", "/en"]) {
  test(`${prefix || "ar"} Google click leaves self-only CSP via a document redirect chain`, async ({
    page,
    context,
  }) => {
    test.skip(
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "Real start-route integration requires a configured Supabase project; no account authorization occurs.",
    );
    const violations: string[] = [];
    const chain: string[] = [];
    // A real HTTP destination is needed: Playwright's route interception only
    // handles the first request of a redirect chain. This is a Google stand-in,
    // never a claim that Google's live project configuration was validated.
    const provider = createServer((_request, response) => {
      chain.push("google-authorization-fixture");
      response.setHeader("Content-Type", "text/html");
      response.end("<h1>Isolated Google authorization</h1>");
    });
    await new Promise<void>((resolve) =>
      provider.listen(0, "127.0.0.1", resolve),
    );
    const address = provider.address();
    if (!address || typeof address === "string")
      throw new Error("provider_fixture_not_listening");
    const providerUrl = `http://127.0.0.1:${address.port}/google/authorize`;
    try {
      page.on("console", (message) => {
        if (/Content Security Policy/.test(message.text()))
          violations.push(message.text());
      });
      await page.route("**/auth/v1/authorize?**", async (route) => {
        const url = new URL(route.request().url());
        chain.push(url.pathname);
        expect(url.searchParams.get("provider")).toBe("google");
        expect(url.searchParams.get("code_challenge")).toBeTruthy();
        expect(
          url.searchParams.get("code_challenge_method")?.toLowerCase(),
        ).toBe("s256");
        const callback = new URL(url.searchParams.get("redirect_to")!);
        expect(callback.origin).toBe("http://127.0.0.1:3100");
        expect(callback.pathname).toBe(`${prefix}/auth/callback`);
        expect(callback.searchParams.get("next")).toBe(`${prefix}/account`);
        await route.fulfill({
          status: 302,
          headers: { location: providerUrl },
        });
      });
      // Hold the actual response briefly so visible progress/duplicate-click protection is testable.
      await page.route(`**${prefix}/auth/start`, async (route) => {
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        expect(response.headers()["cache-control"]).toBe("private, no-store");
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.fulfill({ response });
      });
      const response = await page.goto(
        `${prefix}/auth/sign-in?next=${encodeURIComponent(prefix + "/account")}`,
      );
      expect(response?.headers()["content-security-policy"]).toContain(
        "form-action 'self'",
      );
      await page
        .getByRole("button", {
          name: prefix ? "Continue with Google" : "المتابعة باستخدام Google",
        })
        .click();
      await expect(page.getByRole("status")).toContainText(
        prefix ? "Connecting to Google" : "جارٍ الاتصال بـ Google",
      );
      await expect(
        page.getByRole("button", {
          name: prefix ? "Connecting to Google" : "جارٍ الاتصال بـ Google",
        }),
      ).toBeDisabled();
      await expect(
        page.getByRole("heading", { name: "Isolated Google authorization" }),
      ).toBeVisible();
      expect(chain).toEqual([
        "/auth/v1/authorize",
        "google-authorization-fixture",
      ]);
      expect(violations).toEqual([]);
      const cookies = await context.cookies("http://127.0.0.1:3100");
      expect(
        cookies.some((cookie) => cookie.name.includes("code-verifier")),
      ).toBe(true);
      expect(
        cookies.find((cookie) => cookie.name === "suhail-consent"),
      ).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    } finally {
      await new Promise<void>((resolve, reject) =>
        provider.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
  test(`${prefix || "ar"} Google start and browser failures are actionable`, async ({
    page,
  }) => {
    await page.route(`**${prefix}/auth/start`, (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "oauth_start_failed" }),
      }),
    );
    await page.goto(`${prefix}/auth/sign-in`);
    await page
      .getByRole("button", {
        name: prefix ? "Continue with Google" : "المتابعة باستخدام Google",
      })
      .click();
    await expect(page.locator("p[role=alert]")).toContainText(
      prefix ? "contact the site owner" : "فتواصل مع مالك الموقع",
    );
    await expect(
      page.getByRole("link", { name: prefix ? "Open sign-in in a new tab" : "فتح تسجيل الدخول في علامة تبويب جديدة" }),
    ).toHaveAttribute("rel", "noopener noreferrer");
    await expect(
      page.getByRole("button", {
        name: prefix ? "Continue with Google" : "المتابعة باستخدام Google",
      }),
    ).toBeEnabled();
    await page.unroute(`**${prefix}/auth/start`);
    await page.route(`**${prefix}/auth/start`, (route) =>
      route.abort("failed"),
    );
    await page
      .getByRole("button", {
        name: prefix ? "Continue with Google" : "المتابعة باستخدام Google",
      })
      .click();
    await expect(page.locator("p[role=alert]")).toContainText(
      prefix ? "Check your connection" : "تحقّق من اتصالك",
    );
  });
}
test("AR/EN Google-only sign-in, linked consent, friendly provider errors and private noindex", async ({
  page,
  request,
}) => {
  test.setTimeout(240000);
  for (const [prefix, lang, dir] of [
    ["", "ar", "rtl"],
    ["/en", "en", "ltr"],
  ]) {
    const response = await page.goto(
      `${prefix}/auth/sign-in?next=${encodeURIComponent(prefix + "/account")}`,
    );
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator("html")).toHaveAttribute("dir", dir);
    await expect(
      page.getByRole("button", {
        name:
          lang === "ar" ? "المتابعة باستخدام Google" : "Continue with Google",
      }),
    ).toHaveCount(1);
    await expect(
      page.locator('input[type="email"],input[type="password"]'),
    ).toHaveCount(0);
    await expect(page.locator('form input[name="next"]')).toHaveValue(
      prefix + "/account",
    );
    const consent = page.locator("form").locator("..");
    await expect(
      consent.getByRole("link", { name: prefix ? "Terms of Use" : "شروط الاستخدام" }),
    ).toBeVisible();
    await expect(
      consent.getByRole("link", { name: prefix ? "Privacy Policy" : "سياسة الخصوصية" }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    expect(response?.headers()["content-security-policy"]).toContain("'nonce-");
    expect(response?.headers()["x-robots-tag"]).toContain("noindex");
    for (const route of [
      "/account",
      "/admin",
      "/admin/users",
      "/admin/settings",
      "/admin/audit",
      "/admin/mfa/enroll",
      "/admin/mfa/verify",
    ]) {
      const result = await request.get(`${prefix}${route}`, {
        maxRedirects: 0,
      });
      expect(result.status()).toBe(307);
      expect(result.headers().location).toContain(
        `${prefix}/auth/sign-in?next=`,
      );
      expect(result.headers()["x-robots-tag"]).toContain("noindex");
    }
  }
});
test("cookie-free public/legal pages and unauthorized profile are never shared cached", async ({
  page,
  request,
}) => {
  let profiles = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/account/profile")) profiles++;
  });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "تسجيل الدخول" })).toBeVisible({
    timeout: 30000,
  });
  expect(profiles).toBe(0);
  for (const route of [
    "/",
    "/en",
    "/terms",
    "/privacy",
    "/en/terms",
    "/en/privacy",
  ]) {
    const response = await request.get(route);
    expect(response.ok()).toBe(true);
    expect(response.headers()["set-cookie"]).toBeUndefined();
    expect(response.headers()["content-security-policy"]).toBeUndefined();
  }
  const response = await request.get("/api/account/profile");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(response.headers()["cloudflare-cdn-cache-control"]).toBe("no-store");
  expect(await (await request.get("/robots.txt")).text()).toContain(
    "Disallow: /en/admin",
  );
});
