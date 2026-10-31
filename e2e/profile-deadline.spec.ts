import { expect, test } from "@playwright/test";

for (const stage of ["headers", "body"] as const) {
  test(`profile ${stage} stall ends at eight seconds and late roles cannot return`, async ({ page }) => {
    await page.addInitScript((stage) => {
      const original = window.fetch.bind(window);
      let finish!: (value: unknown) => void;
      const hold = new Promise(resolve => { finish = resolve; });
      Object.assign(window, {
        profileStarted: false,
        releaseProfile: () => finish({
          id: "admin", role: "admin", full_name: "Late Admin",
        }),
      });
      window.fetch = async (input, init) => {
        if (!String(input).includes("/api/account/profile")) return original(input, init);
        if (!(window as unknown as { profileStarted: boolean }).profileStarted) {
          (window as unknown as { profileStarted: boolean }).profileStarted = true;
          // Deliberately ignore abort to exercise generation safety, not just
          // the browser fetch implementation's normal cancellation behavior.
          if (stage === "headers") {
            const body = await hold;
            return Response.json(body);
          }
          return { ok: true, json: () => hold } as Response;
        }
        return Response.json({ id: "user", role: "user", full_name: "Ordinary User" });
      };
    }, stage);
    await page.clock.install({ time: new Date("2026-10-18T12:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-18T12:00:01Z"));
    await page.goto("/en");
    await page.evaluate(() => window.fixture.session({
      access_token: "fixture-admin", user: { id: "admin" },
    }));
    await expect(page.getByLabel("Checking account")).toBeVisible();
    await page.clock.fastForward(7999);
    await expect(page.getByLabel("Checking account")).toBeVisible();
    await page.clock.fastForward(1);
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Profile is temporarily unavailable.");
    await page.evaluate(() => window.fixture.session({
      access_token: "fixture-user", user: { id: "user" },
    }));
    await expect(page.locator("summary")).toHaveText("OU");
    await page.evaluate(() => (window as unknown as { releaseProfile: () => void }).releaseProfile());
    await expect(page.locator("summary")).toHaveText("OU");
    await page.locator("summary").click();
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
  });
}

test("an older profile deadline cannot cancel a newer request, and sign-out cancels pending work", async ({ page }) => {
  await page.addInitScript(() => {
    window.fetch = async () => new Promise(() => {});
  });
  await page.clock.install({ time: new Date("2026-10-18T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-18T12:00:01Z"));
  await page.goto("/en");
  await page.evaluate(() => window.fixture.session({ access_token: "old", user: { id: "admin" } }));
  await page.clock.fastForward(4000);
  await page.evaluate(() => window.fixture.session({ access_token: "new", user: { id: "user" } }));
  await page.clock.fastForward(4000);
  await expect(page.getByLabel("Checking account")).toBeVisible();
  await page.clock.fastForward(4000);
  await expect(page.getByRole("status")).toHaveText("Profile is temporarily unavailable.");
  await page.evaluate(() => window.fixture.session({ access_token: "again", user: { id: "admin" } }));
  await page.evaluate(() => window.fixture.session(null));
  await page.clock.fastForward(9000);
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("unmount aborts a body-stalled profile and clears its deadline", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    Object.assign(window, { profileAborted: false });
    window.fetch = async (input, init) => {
      if (!String(input).includes("/api/account/profile")) return original(input, init);
      init?.signal?.addEventListener("abort", () => {
        (window as unknown as { profileAborted: boolean }).profileAborted = true;
      });
      return { ok: true, json: () => new Promise(() => {}) } as Response;
    };
  });
  await page.clock.install({ time: new Date("2026-10-18T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-18T12:00:01Z"));
  await page.goto("/en");
  await page.evaluate(() => window.fixture.session({ access_token: "admin", user: { id: "admin" } }));
  await expect(page.getByLabel("Checking account")).toBeVisible();
  // Fixture-only root handle; no application route or auth bypass.
  await page.evaluate(() => window.accountFixture.unmount?.());
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { profileAborted: boolean }).profileAborted)).toBe(true);
  await page.clock.fastForward(9000);
  await expect(page.getByRole("status")).toHaveCount(0);
});
