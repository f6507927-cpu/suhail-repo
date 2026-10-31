import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { presentationLabels, displayLabel, publicUiCopy } from "../src/i18n/presentation";
import { inputState, confidenceTier, workflowStatus, thresholdUnit, thresholdDirection, criterionType } from "../src/db/schema/core";
import { sourceType } from "../src/db/schema/market";
import { dataAdequacy, confidence, criterionResult, unknownSeverity } from "../src/db/schema/screening";
import { methodologyType, licensingStatus, officialOrInspired } from "../src/db/schema/methodology";
import { candidates } from "../src/ingest/sec/mapping";
import { categories, lineItems } from "../src/lib/methodology/selectors";
import { Bilingual, CriteriaTable, ReasonList } from "../src/components/stock/StockVerdictParts";
import type { StockCriterion } from "../src/stock/types";
import { publicUiAmendments } from "./fixtures/public-ui-approval";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
import { reviewText } from "../src/components/accounts/types";
vi.mock("server-only", () => ({}));

describe("explicit public display contracts", () => {
  const enums = { inputState, tier: confidenceTier, workflow: workflowStatus, thresholdUnit,
    direction: thresholdDirection, criterionType, sourceType, adequacy: dataAdequacy, confidence,
    result: criterionResult, severity: unknownSeverity, methodType: methodologyType, licence: licensingStatus, methodSource: officialOrInspired };
  for (const [family, enumeration] of Object.entries(enums)) {
    it(`exhaustively labels ${family}`, () => {
      expect(Object.keys(presentationLabels[family as keyof typeof presentationLabels]).sort()).toEqual([...enumeration.enumValues].sort());
      for (const value of enumeration.enumValues) for (const locale of ["ar", "en"] as const) {
        const label = displayLabel(family as keyof typeof presentationLabels, value, locale);
        expect(label).not.toContain("⟦AR-REVIEW⟧");
        expect(label).not.toContain("_");
        expect(label).not.toBe("Unrecognized label");
      }
    });
  }
  it("covers all SEC fundamentals plus derived market values; unknown/prototype names fail explicitly", () => {
    for (const key of [...Object.keys(candidates), ...lineItems, "market_cap", "market_value_basis"]) {
      expect(presentationLabels.lineItem).toHaveProperty(key);
    }
    for (const family of [...Object.keys(presentationLabels), "structured"] as const) {
      for (const key of ["future_machine_key", "constructor", "toString"]) {
        expect(displayLabel(family as keyof typeof presentationLabels | "structured", key, "en")).toBe("Unrecognized label");
      }
    }
    expect(reviewText("ar", "Future unknown phrase")).toBe("⟦AR-REVIEW⟧ Future unknown phrase");
  });
  it("keeps the D-131 supplemental labels exhaustive, approved and distinguishable", () => {
    expect(Object.keys(presentationLabels.activity).sort()).toEqual([...categories].sort());
    expect(new Set(categories.map(value => displayLabel("activity", value, "en"))).size).toBe(categories.length);
    for (const value of categories) {
      expect(displayLabel("activity", value, "en")).not.toContain("_");
      expect(displayLabel("activity", value, "ar")).toMatch(/[\u0600-\u06ff]/);
      expect(displayLabel("activity", value, "ar")).not.toContain("⟦AR-REVIEW⟧");
    }
    for (const value of ["ebitda", "prior_year_revenue", "prior_year_net_income", "business_segments"]) {
      expect(displayLabel("lineItem", value, "ar")).not.toContain("⟦AR-REVIEW⟧");
    }
  });
  it("retains D-131 history; D-138 explicitly supersedes seven activity pairs", () => {
    const approvedTable = readFileSync(new URL("../docs/PUBLIC_UI_LABEL_REVIEW.md", import.meta.url), "utf8").split("## Supplemental inventory")[1];
    const rows = [...approvedTable.matchAll(/^\| (\w+) \| ([^|]+) \| ([^|]+) \|$/gm)];
    expect(rows).toHaveLength(23);
    const superseded = new Set(["interest_based_lending", "pork_related", "conventional_media",
      "generic_permissible", "real_estate_permissible", "retail_permissible", "industrials"]);
    for (const [, key, english, arabic] of rows) {
      if (superseded.has(key)) continue; // Exact replacements pinned in follow-up fixture.
      const family = Object.hasOwn(presentationLabels.activity, key) ? "activity" : "lineItem";
      expect(displayLabel(family, key, "en")).toBe(english.trim());
      expect(displayLabel(family, key, "ar")).toBe(arabic.trim());
    }
  });
  it("pins all founder amendments without rewriting historical batch-2 drafts", () => {
    for (const [key, expected] of Object.entries(publicUiAmendments)) {
      const [namespace, field] = key.split(".");
      expect((ar as Record<string, Record<string, string>>)[namespace][field]).toBe(expected);
      expect(reviewText("ar", (en as Record<string, Record<string, string>>)[namespace][field])).toBe(expected);
    }
    expect(displayLabel("inputState", "missing", "ar")).toBe("غير متوفرة");
    expect(displayLabel("lineItem", "prohibited_income", "ar")).toBe("الإيرادات غير المباحة");
    expect(publicUiCopy["All recorded criteria passed. No additional status reasons were recorded."]).toBe("اجتاز السهم جميع المعايير المسجلة. لم تُسجّل أسباب إضافية.");
  });
});

describe("bidi-safe evidence presentation", () => {
  it("isolates missing-language narrative without attaching per-value language tags", () => {
    const html = renderToStaticMarkup(<Bilingual locale="ar" english="EX-A" arabic={null} />);
    expect(html).toContain('<bdi lang="en" dir="ltr">EX-A</bdi>');
    expect(html).not.toContain("English only");
    expect(html).not.toContain("⟦AR-REVIEW⟧");
  });
  it.each(["ar", "en"] as const)("passing/no-reasons and yes/no criteria in %s do not invent ratio evidence", locale => {
    const passing = renderToStaticMarkup(<ReasonList reasons={[]} locale={locale} passing />);
    expect(passing).toContain(locale === "ar" ? "اجتاز السهم جميع المعايير المسجلة" : "All recorded criteria passed");
    const criterion = { id: "boolean", criterion_label: "Activity", threshold_unit: "boolean", result: "pass", input_states: ["reported"], confidence_tier: "Verified", source_ids: [] } as unknown as StockCriterion;
    const html = renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="Asia/Riyadh"><CriteriaTable criteria={[criterion]} sources={new Map()} locale={locale} /></NextIntlClientProvider>);
    for (const text of ["Numerator", "Denominator", "Ratio", "—:", " · ", "reported"]) expect(html).not.toContain(text);
    expect(html).toContain("<dt>");
    expect(html).toContain("<dd>");
    expect(html).toContain("<bdi>");
    expect(html).toContain(displayLabel("result", "pass", locale));
  });
});
