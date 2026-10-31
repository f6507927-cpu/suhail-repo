import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const management = readFileSync(new URL("./AdminMethodologies.tsx", import.meta.url), "utf8");
const reports = readFileSync(new URL("./MethodologyReports.tsx", import.meta.url), "utf8");

describe("methodology navigation", () => {
  it("keeps a single selection-aware breadcrumb and uses in-page section jumps", () => {
    expect((management.match(/<AdminBreadcrumbs\b/g) ?? [])).toHaveLength(1);
    expect(management).toContain('href="#criteria-record"');
    expect(management).toContain('href="#reports-title"');
    expect(management).toContain("methodologyHref(locale, { ...methodSelection, version: currentVersion?.id }");
  });

  it("does not add nested breadcrumb or BackLink controls to report content", () => {
    expect(management).not.toContain("<BackLink");
    expect(reports).not.toContain("<BackLink");
    expect(reports).not.toContain("<AdminBreadcrumbs");
  });
  it("shows the persisted first-production baseline note and unusable baseline error", () => {
    expect(reports).toContain("<ErrorText value={payload.baselineNote} />");
    expect(reports).toContain("<ErrorText value={payload.baselineError} />");
  });
});
