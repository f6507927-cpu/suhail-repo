import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { reviewText } from "../src/components/accounts/types";

const founderCategories = readFileSync("tests/fixtures/arabic-follow-up-founder.txt", "utf8")
  .split("\n").find(line => line.startsWith("conventional_finance "))!
  .replace(/\.$/, "").split("; ").map(value => {
    const [, key, en, ar] = /^(\w+) (.*?) \/ (.*)$/.exec(value)!;
    return { key, en, ar };
  });

for (const locale of ["ar", "en"] as const) {
  const prefix = locale === "en" ? "/en" : "";
  const label = (value: string) => reviewText(locale, value);
  test(`D-138 ${locale}: exact activity options, input states, CIK and unchanged submission`, async ({ page }) => {
    await page.goto(`${prefix}/admin/securities?screen=financial&role=admin`);
    await page.getByRole("button", { name: label("Segments"), exact: true }).click();
    await page.getByRole("button", { name: label("Edit"), exact: true }).click();
    const category = page.getByLabel(label("Activity category"), { exact: true });
    for (const row of founderCategories) {
      await expect(category.locator(`option[value="${row.key}"]`)).toHaveText(row[locale]);
    }
    await category.selectOption("interest_based_lending");
    await page.getByLabel(label("Category basis"), { exact: true }).fill("Synthetic filing classification evidence");
    const state = page.getByLabel(label("Input state"), { exact: true });
    await expect(state.locator('option[value="estimated"]')).toHaveText(locale === "ar" ? "تقديرية" : "Estimated");
    await state.selectOption("estimated");
    await page.getByRole("button", { name: label("Save segment"), exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.financialFixture.calls)).toHaveLength(1);
    expect((await page.evaluate(() => window.financialFixture.calls))[0]).toMatchObject({
      operation: "segment", data: { activity_category: "interest_based_lending", input_state: "estimated" },
    });
    await page.getByLabel(label("Ticker"), { exact: true }).fill("FIX");
    await page.getByRole("button", { name: label("Preview"), exact: true }).click();
    const cik = page.locator("dt").filter({ hasText: "CIK" });
    await expect(cik).toHaveText(locale === "ar" ? "\u2066CIK\u2069" : "CIK");
    await expect(cik.locator("..").locator('dd bdi[dir="ltr"]')).toHaveText("0000000001");
  });
  test(`D-138 ${locale}: verification failure and unsupported replay preserve Arabic direction`, async ({ page }) => {
    for (const mode of ["fail", "unsupported"]) {
      await page.goto(`${prefix}/admin/runs/fixture?screen=financial&role=admin&verify=${mode}`);
      await page.getByRole("button", { name: label("Verify"), exact: true }).click();
      const expected = mode === "fail" ? label("Verification failed.") : label("replay not supported for engine");
      await expect(page.getByText(expected, { exact: mode === "fail" })).toBeVisible();
      if (mode === "fail") {
        await expect(page.locator('[role="status"]').filter({ hasText: expected })).not.toHaveAttribute("lang", "en");
      } else {
        await expect(page.getByText(expected).locator('bdi[dir="ltr"]')).toHaveText("engine-0.9.0");
      }
    }
  });
}

const securitiesUrl = "/en/admin/securities?screen=financial";
const readCalls = () => window.financialFixture.calls;
const readScreeningCalls = () => window.screeningFixture.calls;

test("adapted support shows missing quarter evidence and submits only explicitly attested closes", async ({ page }) => {
  await page.goto(`${securitiesUrl}&role=admin`);
  await page.getByRole("button", { name: "Prices", exact: true }).click();
  await expect(page.getByText("2026 Q3", { exact: true })).toBeVisible();
  for (const end of ["2026-07-31", "2026-08-31", "2026-09-30"])
    await expect(page.getByText(end, { exact: true })).toBeVisible();
  await expect(page.getByText("Missing attested observation", { exact: true })).toHaveCount(3);
  await page.getByLabel("Date", { exact: true }).fill("2026-05-29");
  await page.getByLabel("Close", { exact: true }).fill("12");
  await page.getByLabel("Month-end represented", { exact: true }).fill("2026-06-30");
  await page.getByLabel("Source label", { exact: true }).fill("Synthetic source month-end assertion");
  await page.getByLabel("Source URL", { exact: true }).fill("https://example.invalid/month-end");
  await page.getByRole("button", { name: "Save close", exact: true }).click();
  expect(await page.evaluate(readCalls)).toEqual([]);
  await page.getByLabel("Month-end represented", { exact: true }).fill("2026-05-31");
  await page.getByRole("button", { name: "Save close", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(1);
  expect((await page.evaluate(readCalls))[0]).toMatchObject({ operation: "price",
    data: { date: "2026-05-29", month_end_for: "2026-05-31", close: "12" } });
});

test("only admins can add sourced prohibited income for the displayed annual period", async ({ page }) => {
  await page.goto(`${securitiesUrl}&role=editor`);
  await expect(page.getByRole("button", { name: "Add prohibited income", exact: true })).toHaveCount(0);
  await page.goto(`${securitiesUrl}&role=admin`);
  await page.getByRole("button", { name: "Add prohibited income", exact: true }).click();
  await page.getByLabel("Value", { exact: true }).fill("100");
  await page.getByLabel("Input state", { exact: true }).selectOption("estimated");
  await page.getByLabel("Source label", { exact: true }).fill("Synthetic conservative annual total");
  await page.getByLabel("Source URL", { exact: true }).fill("https://example.invalid/annual");
  await page.getByLabel("Filing note reference", { exact: true }).fill("SYNTHETIC-GROSS-TOTAL");
  await page.getByLabel("Reason (required)", { exact: true }).fill("Synthetic conservative annual estimate");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(1);
  expect((await page.evaluate(readCalls))[0]).toMatchObject({ operation: "addProhibitedIncome",
    data: { value: "100", input_state: "estimated", confidence_tier: "Estimated",
      period_start: "2025-01-01", period_end: "2025-12-31",
      source: { document_reference: "SYNTHETIC-GROSS-TOTAL" } } });
});

test("admin can preview a fixture ticker and confirm it for ingestion", async ({ page }) => {
  await page.goto(`${securitiesUrl}&role=admin`);
  await page.getByLabel("Ticker").fill("NEWF");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByText("0000000001")).toBeVisible();
  await expect(page.getByText("Fixture Research Systems").first()).toBeVisible();
  await page.getByRole("button", { name: "Confirm and ingest", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(2);
  const calls = await page.evaluate(readCalls);
  expect(calls[0]).toMatchObject({ operation: "lookup", data: { ticker: "NEWF" } });
  expect(calls[1]).toMatchObject({ operation: "add", data: { ticker: "NEWF" } });
});

test("editor can inspect records but cannot invoke financial mutations", async ({ page }) => {
  await page.goto(`${securitiesUrl}&role=editor`);
  await expect(page.getByRole("button", { name: "Preview", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Override", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm from filing", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accept SEC", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Segments", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add segment", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Prices", exact: true }).click();
  await expect(page.getByLabel("Close", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save close", exact: true })).toHaveCount(0);
  expect(await page.evaluate(readCalls)).toEqual([]);
});

test("admin can override, confirm from a filing, and accept a retained SEC alternative", async ({ page }) => {
  await page.goto(`${securitiesUrl}&role=admin`);
  await page.getByRole("button", { name: "Override", exact: true }).first().click();
  await page.getByLabel("Value", { exact: true }).fill("260000");
  await page.getByLabel("Reason (required)", { exact: true }).fill("Fixture correction review");
  await page.getByLabel("Source label", { exact: true }).fill("Fixture internal review");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Confirm from filing", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm from filing", exact: true }).click();
  await page.getByLabel("Source label", { exact: true }).fill("Fixture note confirmation");
  await page.getByLabel("Filing note reference", { exact: true }).fill("FIXTURE-NOTE-01");
  await page.getByLabel("Source URL", { exact: true }).fill("https://example.invalid/fixture-note");
  await page.getByLabel("Reason (required)", { exact: true }).fill("Fixture filing note verified");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(2);
  await page.getByRole("button", { name: "Accept SEC", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(3);
  const calls = await page.evaluate(readCalls);
  expect(calls[0]).toMatchObject({ operation: "override", data: { factId: "77777777-7777-4777-8777-777777777777", value: "260000", reason: "Fixture correction review" } });
  expect(calls[1]).toMatchObject({ operation: "confirm", data: { factId: "55555555-5555-4555-8555-555555555555", reason: "Fixture filing note verified", source: { source_type: "regulatory_filing", document_reference: "FIXTURE-NOTE-01" } } });
  expect(calls[2]).toMatchObject({ operation: "accept", data: { factId: "66666666-6666-4666-8666-666666666666" } });
});

test("admin can create, edit, and delete a latest-period segment", async ({ page }) => {
  await page.goto(`${securitiesUrl}&role=admin`);
  await page.getByRole("button", { name: "Segments", exact: true }).click();
  await page.getByRole("button", { name: "Add segment", exact: true }).click();
  await page.getByLabel("Segment name", { exact: true }).fill("Fixture new segment");
  await page.getByLabel("Revenue amount", { exact: true }).fill("18000");
  await page.getByLabel("Source label", { exact: true }).fill("Fixture segment filing");
  await page.getByLabel("Filing note reference", { exact: true }).fill("FIXTURE-SEGMENT-01");
  await page.getByLabel("Source URL", { exact: true }).fill("https://example.invalid/fixture-segment");
  await page.getByRole("button", { name: "Save segment", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(1);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Segment name", { exact: true }).fill("Fixture services revised");
  await page.getByRole("button", { name: "Save segment", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(2);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(3);
  const calls = await page.evaluate(readCalls);
  expect(calls[0]).toMatchObject({ operation: "segment", data: { segment_name: "Fixture new segment", activity_category: "unclassified", source: { source_type: "regulatory_filing" } } });
  expect(calls[1]).toMatchObject({ operation: "segment", data: { id: "99999999-9999-4999-8999-999999999999", segment_name: "Fixture services revised" } });
  expect(calls[2]).toMatchObject({ operation: "deleteSegment", data: { id: "99999999-9999-4999-8999-999999999999" } });
});

test("admin can save manual price, coverage, company fields, and confirm removal", async ({ page }) => {
  await page.goto(`${securitiesUrl}&role=admin`);
  await page.getByRole("button", { name: "Prices", exact: true }).click();
  await page.getByLabel("Date", { exact: true }).fill("2026-01-16");
  await page.getByLabel("Close", { exact: true }).fill("48.75");
  await page.getByLabel("Source label", { exact: true }).fill("Fixture manual close");
  await page.getByLabel("Source URL", { exact: true }).fill("https://example.invalid/fixture-close");
  await page.getByRole("button", { name: "Save close", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(1);
  await page.getByRole("button", { name: "Coverage", exact: true }).click();
  await page.getByLabel("Assigned analyst", { exact: true }).selectOption("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  await page.getByRole("button", { name: "Save coverage", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(2);
  await page.getByRole("button", { name: "Company", exact: true }).click();
  await page.getByLabel("Arabic name", { exact: true }).fill("Fixture Arabic issuer");
  await page.getByLabel("Arabic description", { exact: true }).fill("Fixture Arabic description");
  await page.getByLabel("English description", { exact: true }).fill("Fixture English description");
  await page.getByRole("button", { name: "Save company fields", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(3);
  await page.getByRole("button", { name: "Remove from universe", exact: true }).click();
  await expect(page.getByRole("group", { name: "Confirm removal" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm removal", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(4);
  const calls = await page.evaluate(readCalls);
  expect(calls[0]).toMatchObject({ operation: "price", data: { date: "2026-01-16", close: "48.75", currency: "USD", source_label: "Fixture manual close", source_url: "https://example.invalid/fixture-close" } });
  expect(calls[1]).toMatchObject({ operation: "coverage", data: { analystId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } });
  expect(calls[2]).toMatchObject({ operation: "company", data: { name_ar: "Fixture Arabic issuer", description_ar: "Fixture Arabic description", description_en: "Fixture English description" } });
  expect(calls[3]).toMatchObject({ operation: "remove", data: { confirm: true } });
});

test("ingestion controls start, resume, and retry fixture jobs", async ({ page }) => {
  await page.goto("/en/admin/ingestion?screen=financial&view=ingestion&role=admin");
  await page.getByRole("button", { name: "Ingest now", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(1);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(2);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect.poll(async () => page.evaluate(readCalls)).toHaveLength(3);
  const calls = await page.evaluate(readCalls);
  expect(calls[0]).toMatchObject({ operation: "runJob" });
  expect(calls[0].data).toBeUndefined();
  expect(calls[1]).toMatchObject({ operation: "resumeJob", data: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" } });
  expect(calls[2]).toMatchObject({ operation: "ingest", securityId: "11111111-1111-4111-8111-111111111111" });
});

test("historical verification is hash-only, not a replay mismatch", async ({ page }) => {
  for (const prefix of ["/en", ""]) {
    const locale = prefix ? "en" : "ar";
    await page.goto(`${prefix}/admin/runs/33333333-3333-4333-8333-333333333333?screen=financial&verify=unsupported`);
    await page.getByRole("button", { name: reviewText(locale, "Verify"), exact: true }).click();
    await expect(page.getByRole("status")).toContainText(reviewText(locale, "Hash verified."));
    await expect(page.getByText(reviewText(locale, "replay not supported for engine"))).toContainText("engine-0.9.0");
    await expect(page.getByText(reviewText(locale, "Verification failed."), { exact: true })).toHaveCount(0);
    await expect(page.getByText("Verification passed.", { exact: true })).toHaveCount(0);
    await page.goto(`${prefix}/admin/runs/33333333-3333-4333-8333-333333333333?screen=financial&verify=unsupported-tampered`);
    await page.getByRole("button", { name: reviewText(locale, "Verify"), exact: true }).click();
    await expect(page.getByRole("status")).toContainText(reviewText(locale, "Verification failed."));
    await expect(page.getByText(reviewText(locale, "replay not supported for engine"))).toContainText("engine-0.9.0");
    await expect(page.getByText("$.immutable_hash", { exact: true })).toBeVisible();
    await expect(page.getByText("Hash verified.", { exact: true })).toHaveCount(0);
  }
});

test("screening admin can run a selected version, inspect unchanged evidence, and verify a stored run", async ({ page }) => {
  await page.goto(`${securitiesUrl}&role=admin&screening=1`);
  await expect(page.getByText("Unchanged", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Methodology version").selectOption("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await page.getByRole("button", { name: "Run screening now", exact: true }).click();
  await expect(page.getByText("Unchanged result", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Run details", exact: true }).last().click();
  await expect(page).toHaveURL(/\/en\/admin\/runs\/33333333-3333-4333-8333-333333333333/);
  await expect(page.getByText(/Data freshness/).first()).toBeVisible();
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByText("Verification passed.", { exact: true })).toBeVisible();
  const calls = await page.evaluate(readScreeningCalls);
  expect(calls[0]).toMatchObject({ action: "runScreenAction", args: [{ securityId: "11111111-1111-4111-8111-111111111111", methodologyVersionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] });
  expect(calls[1]).toMatchObject({ action: "verifyScreenAction", args: ["33333333-3333-4333-8333-333333333333"] });
});

test("verification failure presents detailed difference feedback", async ({ page }) => {
  await page.goto("/en/admin/runs/33333333-3333-4333-8333-333333333333?screen=financial&verify=fail");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByText("Verification failed.", { exact: true })).toBeVisible();
  await expect(page.getByText("outputs.status", { exact: true })).toBeVisible();
  await expect(page.getByText("fedcba9876543210fedcba9876543210", { exact: true })).toBeVisible();
});

test("bulk screening reports its universe summary and gates a missing production methodology", async ({ page }) => {
  await page.goto("/en/admin/ingestion?screen=financial&view=ingestion&role=admin&screening=1");
  await page.getByRole("button", { name: "Screen all", exact: true }).click();
  await expect(page.getByText("Job summary", { exact: true })).toBeVisible();
  const jobSummary = page.getByRole("heading", { name: "Job summary", exact: true }).locator("..").locator("dl");
  await expect(jobSummary.getByText("8", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume screen job", exact: true })).toBeVisible();
  await page.goto("/en/admin/ingestion?screen=financial&view=ingestion&role=admin&screening=1&bulk=gate");
  await page.getByRole("button", { name: "Screen all", exact: true }).click();
  await expect(page.getByText("No production methodology to screen with", { exact: true })).toBeVisible();
  const calls = await page.evaluate(readScreeningCalls);
  expect(calls).toContainEqual({ action: "runUniverseAction", args: ["screen", undefined] });
});

test("cancelled bulk work shows the existing failure and releases UI pending state", async ({ page }) => {
  await page.goto("/en/admin/ingestion?screen=financial&view=ingestion&role=admin&screening=1&bulk=cancel");
  const submit = page.getByRole("button", { name: "Screen all", exact: true });
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(page.getByText("Screening operation failed. Check the inputs and methodology, then try again.", { exact: true })).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(submit).toBeEnabled();
});

test("editor can inspect screening history and detail but has no screening or bulk actions", async ({ page }) => {
  await page.goto(`${securitiesUrl}&role=editor&screening=1`);
  await expect(page.getByRole("button", { name: "Run screening now", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Run details/ })).toBeVisible();
  await page.goto("/en/admin/runs/33333333-3333-4333-8333-333333333333?screen=financial&role=editor");
  await expect(page.getByRole("button", { name: "Verify", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByText("Verification passed.", { exact: true })).toBeVisible();
  await page.goto("/en/admin/ingestion?screen=financial&view=ingestion&role=editor&screening=1");
  await expect(page.getByRole("button", { name: "Screen all", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ingest all", exact: true })).toHaveCount(0);
  const calls = await page.evaluate(readScreeningCalls);
  expect(calls).toContainEqual({ action: "verifyScreenAction", args: ["33333333-3333-4333-8333-333333333333"] });
  expect(calls.some((call) => call.action !== "verifyScreenAction")).toBe(false);
});
