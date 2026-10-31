import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const forms = readFileSync(new URL("./MethodologyForms.tsx", import.meta.url), "utf8");
const admin = readFileSync(new URL("./AdminMethodologies.tsx", import.meta.url), "utf8");
const reports = readFileSync(new URL("./MethodologyReports.tsx", import.meta.url), "utf8");

describe("methodology admin presentation labels", () => {
  it("localizes enum option text without changing the persisted option values", () => {
    for (const family of ["methodType", "methodSource", "licence", "criterionType", "thresholdUnit", "direction", "lineItem"]) {
      expect(forms).toContain(`family="${family}"`);
    }
    expect(forms).toContain('value={option}');
    expect(forms).toContain("<EnumLabel family={family} value={option} locale={locale} />");
    expect(forms).toContain('displayLabel("workflow", version.workflow_status');
  });

  it("formats dates and presents line-item requirements as labels", () => {
    expect(admin).toContain('formatTimestamp(currentMethod.verification_date, locale, { dateStyle: "medium" })');
    expect(admin).toContain('enumDisplayLabel("lineItem", input, locale)');
    expect(admin).toContain('displayLabel("workflow", event.from ?? event.status, locale)');
  });

  it("localizes result codes and routes screening statuses through translated status messages", () => {
    expect(reports).toContain('displayLabel("result", value, locale)');
    expect(reports).toContain("function isScreeningStatus(value: string)");
    expect(reports).toContain("statusText(value)");
    expect(reports).toContain('<ResultValue value={security.oldStatus} />');
    expect(reports).toContain('<ResultValue value={criterion.result} />');
  });
});
