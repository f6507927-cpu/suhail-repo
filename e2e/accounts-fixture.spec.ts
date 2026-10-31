import { expect, test } from "@playwright/test";
import { approvedArabicCopy } from "../src/i18n/approved-arabic";
import { fixtureQr } from "../tests/browser-fixture/auth";

for (const locale of ["ar", "en"] as const) {
  for (const screen of ["settings", "users"] as const) {
    test(`${locale} ${screen} suppresses same-turn submissions and keeps focus after thrown failures`, async ({ page }) => {
      const text = (english: string) => locale === "ar" ? approvedArabicCopy[english] : english;
      await page.goto(`${locale === "en" ? "/en" : ""}/?screen=${screen}`);
      const opener = page.getByRole("button", { name: text("Change role"), exact: true });
      if (screen === "users") {
        await opener.click();
        await page.getByRole("textbox", { name: text("Reason (required)"), exact: true }).fill("  Fixture reason  ");
      }
      const submit = screen === "users"
        ? page.getByRole("dialog").locator("form button").last()
        : page.locator("main form button");
      await submit.focus();
      await page.evaluate(() => {
        window.accountFixture.hold = true;
        window.accountFixture.throwFailure = true;
      });
      // Exercise reentrant submissions before React can commit pending state.
      await submit.evaluate((element) => {
        const button = element as HTMLButtonElement;
        button.click();
        button.form?.requestSubmit();
        button.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      await expect(submit).toHaveAttribute("aria-disabled", "true");
      await expect(submit).toBeFocused();
      expect(await page.evaluate(() => window.accountFixture.calls)).toEqual([
        screen === "users"
          ? { action: "changeRole", args: ["fixture-user", "editor", "  Fixture reason  "] }
          : { action: "saveSettings", args: [null, false] },
      ]);
      await page.evaluate(() => window.accountFixture.release?.());
      await expect(page.getByRole("status")).toContainText(
        text(screen === "users" ? "Role could not be updated. Try again." : "Settings could not be saved. Try again."),
      );
      await expect(submit).toBeFocused();
      await expect(submit).toHaveAttribute("aria-disabled", "false");
      await page.evaluate(() => {
        window.accountFixture.throwFailure = false;
        window.accountFixture.hold = false;
      });
      await page.keyboard.press("Enter");
      await expect(page.getByRole("status")).toContainText(text(screen === "users" ? "Role updated." : "Settings saved."));
      expect(await page.evaluate(() => window.accountFixture.calls.length)).toBe(2);
      if (screen === "users") {
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(opener).toBeFocused();
      } else {
        await expect(submit).toBeFocused();
      }
    });
  }
}

for (const prefix of ["", "/en"]) {
  test(`${prefix || "ar"} embedded sign-in directs users to a separate tab without starting OAuth`, async ({
    page,
  }) => {
    let starts = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/auth/start")) starts++;
    });
    await page.route("**/embed-parent", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<iframe title="Isolated embedded sign-in" src="${prefix}/?screen=signin"></iframe>`,
      }),
    );
    await page.route(`**${prefix}/?screen=signin`, async (route) => {
      const response = await route.fetch();
      const headers = response.headers();
      // Test transport only: runtime frame-ancestors 'none' remains intact.
      // Permit the isolated component to render inside a same-origin harness.
      expect(headers["content-security-policy"]).toContain(
        "frame-ancestors 'none'",
      );
      headers["content-security-policy"] = headers[
        "content-security-policy"
      ].replace("frame-ancestors 'none'", "frame-ancestors 'self'");
      await route.fulfill({ response, headers });
    });
    await page.goto("/embed-parent");
    const frame = page.frameLocator("iframe");
    await frame.getByRole("button", { name: prefix ? "Continue with Google" : approvedArabicCopy["Continue with Google"], exact: true }).click();
    await expect(frame.getByRole("alert")).toContainText(
      prefix ? "separate browser tab" : approvedArabicCopy["Google sign-in needs a separate browser tab. Open sign-in in a new tab, then continue with Google."],
    );
    await expect(
      frame.getByRole("link", { name: prefix ? "Open sign-in in a new tab" : approvedArabicCopy["Open sign-in in a new tab"], exact: true }),
    ).toHaveAttribute("target", "_blank");
    await expect(
      frame.getByRole("link", { name: prefix ? "Open sign-in in a new tab" : approvedArabicCopy["Open sign-in in a new tab"], exact: true }),
    ).toHaveAttribute("href", `${prefix}/auth/sign-in`);
    expect(starts).toBe(0);
  });
}
test("anonymous header makes zero private profile requests; browser sessions clear old roles", async ({
  page,
}) => {
  let count = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/account/profile")) count++;
  });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "تسجيل الدخول" })).toBeVisible();
  expect(count).toBe(0);
  await page.evaluate(() =>
    window.fixture.session({
      access_token: "fixture-admin",
      user: { id: "admin" },
    }),
  );
  await expect(page.locator("summary")).toBeVisible();
  await page.locator("summary").click();
  await expect(page.getByRole("link", { name: "الإدارة" })).toBeVisible();
  expect(count).toBeGreaterThan(0);
  await page.evaluate(() =>
    window.fixture.session({
      access_token: "fixture-user",
      user: { id: "user" },
    }),
  );
  await expect(page.getByRole("link", { name: "الإدارة" })).toHaveCount(0);
  await expect(page.locator("summary")).toHaveText(/OU/);
  await page.evaluate(() => window.fixture.session(null));
  await expect(page.getByRole("link", { name: "تسجيل الدخول" })).toBeVisible();
  await expect(page.locator("summary")).toHaveCount(0);
});
test("late prior-session response cannot restore privileged menu; sign-out uses POST", async ({
  page,
}) => {
  await page.goto("/en");
  const slowRequest = page.waitForRequest("**/api/account/profile");
  await page.evaluate(() =>
    window.fixture.session({
      access_token: "slow",
      user: { id: "slow-admin" },
    }),
  );
  await slowRequest;
  await page.evaluate(() => window.fixture.session(null));
  await page.waitForTimeout(500);
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.fixture.session({ access_token: "admin", user: { id: "admin" } }),
  );
  await page.locator("summary").click();
  const request = page.waitForRequest(
    (r) => r.url().endsWith("/en/auth/sign-out") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await request;
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
test("consent and authenticator enrollment/verification use real UI with mocked auth boundary", async ({
  page,
}) => {
  await page.goto("/en?screen=consent");
  await expect(
    page.getByRole("link", { name: "Terms of Use", exact: true }),
  ).toHaveAttribute("href", "/en/terms");
  await page.getByRole("button", { name: "Accept and continue" }).click();
  await expect(page.locator("body")).toContainText("decision=accept");
  await page.goto("/en?screen=consent");
  await page.getByRole("button", { name: "Decline and sign out" }).click();
  await expect(page.locator("body")).toContainText("decision=decline");
  await page.goto("/en?screen=enroll");
  await page.getByRole("button", { name: "Begin setup" }).click();
  await expect(
    page.getByRole("img", { name: "Authenticator setup QR code" }),
  ).toBeVisible();
  await expect(page.locator("code")).toContainText("FIXTURESETUPKEY");
  await page
    .getByRole("textbox", { name: "Enter the six-digit code" })
    .fill("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/done$/);
  await page.goto("/en?screen=verify");
  await page
    .getByRole("textbox", { name: "Authenticator code" })
    .fill("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/done$/);
});
test("production nonce CSP permits fixture scripts and early light restoration without violations", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to execute/.test(message.text()))
      violations.push(message.text());
  });
  await page.addInitScript(() => localStorage.setItem("suhail-theme", "light"));
  const response = await page.goto("/en?screen=signin");
  expect(response?.headers()["content-security-policy"]).toContain(
    "'strict-dynamic'",
  );
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  expect(violations).toEqual([]);
});
test("minimal account supports null email, language preference and typed deletion; privileged UI refuses deletion", async ({
  page,
}) => {
  await page.goto("/en?screen=account");
  await expect(page.getByText("Not provided", { exact: true })).toBeVisible();
  await expect(page.getByText("Google", { exact: true })).toBeVisible();
  await page.getByRole("combobox").selectOption("en");
  await page.getByRole("button", { name: "Save language" }).click();
  await expect(page.getByRole("status")).toContainText("Language saved");
  const remove = page.getByRole("button", { name: "Delete my account" });
  await expect(remove).toBeDisabled();
  await page
    .getByRole("textbox", { name: 'Type "DELETE" to confirm' })
    .fill("DELETE");
  await expect(remove).toBeEnabled();
  await page.goto("/en?screen=account&role=admin");
  await expect(page.getByText(/Ask another admin/)).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: 'Type "DELETE" to confirm' }),
  ).toHaveCount(0);
});

test("Supabase SVGo SVG with a generated comment is decoded without page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en?screen=enroll");
  await page.getByRole("button", { name: "Begin setup", exact: true }).click();
  const image = page.getByRole("img", { name: "Authenticator setup QR code", exact: true });
  await expect(image).toHaveAttribute("src", `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fixtureQr.slice(fixtureQr.indexOf(",") + 1).trim())}`);
  await expect(image).toHaveAttribute("width", "144");
  await expect(image).toHaveAttribute("height", "144");
  await image.evaluate((element) => (element as HTMLImageElement).decode());
  expect(await image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(160);
  await expect(page.locator("code")).toHaveText("FIXTURESETUPKEY");
  expect(errors).toEqual([]);
});

for (const source of [null, "", "data:image/png,abc", "https://example.test/qr.svg",
  "data:image/svg+xml-fake,<svg></svg>", "data:image/svg+xml<svg></svg>",
  "data:image/svg+xml,not svg", "data:image/svg+xml,<svg><broken></svg>"]) {
  test(`unusable QR retains the setup key: ${source}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/en?screen=enroll");
    await page.evaluate((qrCode) => { window.fixture.mfa.qrCode = qrCode; }, source);
    await page.getByRole("button", { name: "Begin setup", exact: true }).click();
    await expect(page.getByText("QR code unavailable. Use the setup key instead.", { exact: true })).toBeVisible();
    await expect(page.getByRole("img")).toHaveCount(0);
    await expect(page.locator("code")).toHaveText("FIXTURESETUPKEY");
    await expect(page.getByRole("textbox", { name: "Enter the six-digit code" })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

for (const count of [1, 3]) {
  test(`recovers ${count} abandoned factors before enrollment, preserving verified and other types`, async ({ page }) => {
    await page.goto("/en?screen=enroll");
    const protectedFactors = [
      { id: "verified", factor_type: "totp", status: "verified" },
      { id: "phone-unverified", factor_type: "phone", status: "unverified" },
      { id: "phone-verified", factor_type: "phone", status: "verified" },
      { id: "other", factor_type: "webauthn", status: "unverified" },
    ];
    const abandoned = Array.from({ length: count }, (_, index) => ({
      id: `abandoned-${index}`, factor_type: "totp", status: "unverified",
    }));
    await page.evaluate((factors) => { window.fixture.mfa.factors = factors; }, [...protectedFactors, ...abandoned]);
    await page.getByRole("button", { name: "Begin setup", exact: true }).click();
    await expect(page.getByRole("img", { name: "Authenticator setup QR code" })).toBeVisible();
    const state = await page.evaluate(() => window.fixture.mfa);
    expect(state.calls).toEqual([
      { action: "listFactors" },
      ...abandoned.map((factor) => ({ action: "unenroll", factorId: factor.id })),
      { action: "enroll" },
    ]);
    expect(state.factors).toEqual([...protectedFactors, { id: "factor-fixture", factor_type: "totp", status: "unverified" }]);
  });
}

for (const failureControl of ["listFailure", "unenrollFailure"] as const) {
  for (const failure of ["error", "throw", ...(failureControl === "listFailure" ? ["missing"] as const : [])] as const) {
    test(`${failureControl} ${failure} stops enrollment and permits retry`, async ({ page }) => {
      await page.goto("/en?screen=enroll");
      await page.evaluate(({ failureControl, failure }) => {
        window.fixture.mfa.factors = [{ id: "abandoned", factor_type: "totp", status: "unverified" }];
        window.fixture.mfa[failureControl] = failure;
      }, { failureControl, failure });
      const begin = page.getByRole("button", { name: "Begin setup", exact: true });
      await begin.click();
      await expect(page.getByRole("alert")).toHaveText("Could not prepare authenticator enrollment. Try again.");
      await expect(begin).toBeEnabled();
      expect(await page.evaluate(() => window.fixture.mfa.calls)).toEqual([
        { action: "listFactors" },
        ...(failureControl === "unenrollFailure" ? [{ action: "unenroll", factorId: "abandoned" }] : []),
      ]);
      expect(await page.evaluate(() => window.fixture.mfa.factors)).toEqual([
        { id: "abandoned", factor_type: "totp", status: "unverified" },
      ]);
      await page.evaluate((control) => { window.fixture.mfa[control] = null; window.fixture.mfa.calls = []; }, failureControl);
      await begin.click();
      await expect(page.getByRole("img", { name: "Authenticator setup QR code" })).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      expect(await page.evaluate(() => window.fixture.mfa.calls)).toEqual([
        { action: "listFactors" }, { action: "unenroll", factorId: "abandoned" }, { action: "enroll" },
      ]);
    });
  }
}
