import { expect, test } from "@playwright/test";

test("phone review: dirty text blocks approval and reason-coded edits submit only model prose", async ({ page }) => {
  await page.goto("/?locale=en");
  const approval = page.getByRole("button", { name: "Approve draft", exact: true });
  await expect(approval).toBeDisabled();
  const boxes = page.locator('input[type="checkbox"]');
  // Seven edit reasons precede the six approval answers.
  await expect(boxes).toHaveCount(13);
  for (let i = 7; i < 13; i++) await boxes.nth(i).check();
  await expect(approval).toBeEnabled();
  const firstText = page.locator("textarea").first();
  await firstText.fill((await firstText.inputValue()) + " — analyst edit");
  await expect(approval).toBeDisabled();
  await boxes.first().check();
  await page.getByRole("button", { name: "Save editorial changes", exact: true }).click();
  await expect(page.locator("#recording")).toContainText("edit_reasons");
  const fields = Object.fromEntries(JSON.parse(await page.locator("#recording").textContent() ?? "[]"));
  expect(JSON.parse(String(fields.text))).not.toHaveProperty("shariah_context");
  expect(fields.edit_reasons).not.toContain("[");
});
for (const mode of ["review", "settings", "list"]) test(`Arabic phone ${mode}: no page overflow and primary controls remain visible`, async ({ page }) => {
  await page.goto(`/?locale=ar&mode=${mode}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("h1")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `generated-artifacts/research-ui/phone-ar-${mode}.png`, fullPage: true });
});
test("settings start off and leave unconfigured thresholds blank", async ({ page }) => {
  await page.goto("/?locale=en&mode=settings");
  for (const checkbox of await page.locator('input[type="checkbox"]').all()) await expect(checkbox).not.toBeChecked();
  await expect(page.locator('[name="max_packet_age_days"]')).toHaveValue("");
  await expect(page.locator('[name="monthly_token_budget"]')).toHaveValue("0");
});
test("admin list offers explicit reconciliation only for a requested draft", async ({ page }) => {
  await page.goto("/?locale=en&mode=list");
  const button = page.getByRole("button", { name: "Mark abandoned and release reservation", exact: true });
  await expect(button).toHaveCount(1);
  await button.click();
  await expect(page.locator("#recording")).toContainText("abandoned-fixture");
  const fields = Object.fromEntries(JSON.parse(await page.locator("#recording").textContent() ?? "[]"));
  expect(fields.draft_id).toBe("abandoned-fixture");
});
for (const locale of ["ar", "en"]) {
  test(`${locale} phone queue shows counts and records only the explicitly requested draft`, async ({ page }) => {
    await page.goto(`/?locale=${locale}&mode=queue`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { name: "Research refresh queue" })).toBeVisible();
    await expect(page.locator("dt").filter({ hasText: "New filing" }).locator("..").locator("dd")).toHaveText("2");
    await expect(page.locator("dt").filter({ hasText: "Approval aged" }).locator("..").locator("dd")).toHaveText("0");
    await expect(page.getByRole("button", { name: "Refresh in progress" })).toBeDisabled();
    await expect(page.locator("#recording")).toBeEmpty();
    await page.getByRole("button", { name: "Request refresh", exact: true }).click();
    expect(Object.fromEntries(JSON.parse(await page.locator("#recording").textContent() ?? "[]")))
      .toEqual({ draft_id: "approved-fixture" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `generated-artifacts/research-ui/phone-${locale}-queue.png` });
  });
  test(`${locale} phone review highlights revised prose and ties unchanged passages to changed evidence`, async ({ page }) => {
    await page.goto(`/?locale=${locale}&mode=refresh`);
    const highlights = page.getByRole("region", { name: "Changed passages", exact: true });
    await expect(highlights.getByRole("heading", { name: "Changed passages" })).toBeVisible();
    await expect(highlights.locator('p[lang="en"] mark')).toContainText("A recent filing changed the available evidence.");
    await expect(highlights.locator('p[lang="ar"] mark')).toContainText("غيّر التقرير الجديد البيانات المتاحة.");
    expect(await highlights.locator("[data-refresh-passage]").count()).toBeGreaterThan(1);
    await expect(highlights.getByText("Changed evidence:").first()).toBeVisible();
    await highlights.getByText("Packet changes").click();
    await expect(highlights.locator("details").getByText("fin.total_revenue.FY2025", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `generated-artifacts/research-ui/phone-${locale}-refresh.png` });
  });
}
