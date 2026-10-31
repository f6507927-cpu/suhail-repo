import { expect, test } from "@playwright/test";
import { displayLabel } from "../src/i18n/presentation";
import en from "../src/i18n/messages/en.json";
import ar from "../src/i18n/messages/ar.json";
import { reviewText } from "../src/components/accounts/types";
for(const locale of ["ar","en"] as const) {
  const prefix=locale==="en"?"/en":"";
  const copy=locale==="ar"?ar.governed:en.governed;
  test(`${locale} editors can read coverage but cannot author methodology content`,async({page})=>{
    await page.goto(`${prefix}/admin/methodologies?screen=methodologies&role=editor`);
    await expect(page.getByRole("button",{name:copy.createMethodology,exact:true})).toHaveCount(0);
    await expect(page.getByRole("button",{name:copy.editCriterion,exact:true})).toHaveCount(0);
    await expect(page.getByText("Fixture debt",{exact:true}).first()).toBeVisible();
    await page.locator("summary").filter({hasText:copy.testReport}).click();
    await expect(page.getByText(displayLabel("result", "fail", locale),{exact:true}).first()).toBeVisible();
    expect(await page.evaluate(()=>window.methodologyFixture.calls)).toEqual([]);
  });
  test(`${locale} finalized content is visibly read-only`,async({page})=>{
    await page.goto(`${prefix}/admin/methodologies?screen=methodologies&final=1`);
    await expect(page.getByRole("button",{name:copy.editCriterion,exact:true})).toHaveCount(0);
    await expect(page.locator("textarea").filter({hasNot:page.locator("#workflow-note")})).not.toHaveCount(0);
    await expect(page.getByText(copy.finalizedContentReadOnly,{exact:true}).first()).toBeVisible();
  });
  test(`${locale} stale criterion save shows the refusal and keeps entered content`,async({page})=>{
    await page.goto(`${prefix}/admin/methodologies?screen=methodologies`);
    await page.getByRole("button",{name:copy.editCriterion,exact:true}).click();
    await page.locator("#criterion-threshold").fill("25");
    await page.getByRole("button",{name:copy.save,exact:true}).click();
    await expect(page.getByText(reviewText(locale==="ar"?"ar":"en","Finalized criteria are immutable; create a new draft"))).toBeVisible();
    await expect(page.locator("#criterion-threshold")).toHaveValue("25");
    expect((await page.evaluate(()=>window.methodologyFixture.calls))[0].operation).toBe("criterion");
  });
}
