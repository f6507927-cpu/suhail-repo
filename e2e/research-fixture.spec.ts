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
