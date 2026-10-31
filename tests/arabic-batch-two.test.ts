import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "next-intl";
import { readFileSync } from "node:fs";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
import batch from "./fixtures/arabic-batch-two-approval.json";
import { reviewText } from "../src/components/accounts/types";
import { governedText } from "../src/components/methodology/GovernedCopy";
import { isolateArabicCode } from "../src/i18n/bidi";
import { leaves } from "../scripts/ar-review";
import { publicUiAmendments } from "./fixtures/public-ui-approval";

// Governed text is pure; the foundation barrel also loads Next-only navigation.
vi.mock("../src/components/foundation", () => ({ LocalizedText: () => null }));

describe("D-107 founder Arabic approval, batch 2", () => {
  it("pins all 275 approved rows and excludes exactly the two legal bodies", () => {
    expect(batch.decision).toBe("D-107");
    expect(batch.rows).toHaveLength(277);
    expect(batch.rows.filter((row) => row.approved)).toHaveLength(275);
    const arabic = leaves(ar), english = leaves(en);
    for (const row of batch.rows.filter((item) => item.approved)) {
      if (row.id.startsWith("J-")) {
        expect(english[row.key], row.id).toBe(row.source);
        expect(arabic[row.key], row.id).toBe(publicUiAmendments[row.key] ?? row.applied);
      } else {
        const amended = batch.rows.find(item => item.source === row.source && publicUiAmendments[item.key]);
        expect(reviewText("ar", row.source), row.id).toBe(amended ? publicUiAmendments[amended.key] : row.applied);
        expect(reviewText("en", row.source), row.id).toBe(row.source);
      }
      expect(row.applied, row.id).not.toContain("⟦AR-REVIEW⟧");
    }
    expect(batch.rows.filter((row) => !row.approved).map((row) => row.id)).toEqual(["L-privacy-body", "L-terms-body"]);
    for (const kind of ["privacy", "terms"]) {
      const body = readFileSync(`content/legal/${kind}.ar.md`, "utf8");
      expect(body).toContain("⟦LEGAL-REVIEW⟧");
      expect(body).toContain("⟦AR-REVIEW⟧");
    }
  });
  it.each([
    [0, "لا توجد قواعد"], [1, "قاعدة واحدة"], [2, "قاعدتان"],
    [3, "3 قواعد"], [10, "10 قواعد"], [11, "11 قاعدة"],
    [99, "99 قاعدة"], [100, "100 قاعدة"], [102, "102 قاعدة"],
  ])("formats %i rules with correct Arabic morphology and Western digits", (count, expected) => {
    const t = createTranslator({ locale: "ar", messages: ar });
    expect(t("methodologies.rules", { count, displayCount: String(count) })).toBe(expected);
  });
  it("keeps workflow approval, finalization, publication and production distinct", () => {
    expect(reviewText("ar", "approved")).toBe("موافَق عليه");
    expect(reviewText("ar", "Approval is required")).toBe("الموافقة مطلوبة.");
    expect(governedText("ar", "publicVisible")).toBe("منشور");
    expect(governedText("ar", "notPublic")).toBe("غير منشور");
    expect(governedText("ar", "visibilityControl")).toBe("الإتاحة العامة");
    expect(governedText("ar", "enableProduction")).toBe("اعتماد للاستخدام الفعلي");
    for (const row of batch.rows.filter((item) => item.approved && /finaliz/i.test(item.source))) {
      expect(row.applied, row.id).not.toMatch(/مثبّت|تُثبّت/);
      expect(row.applied, row.id).toMatch(/نهائي/);
    }
    expect(governedText("en", "publicVisible")).toBe(en.governed.publicVisible);
  });
  it("isolates identifiers without touching ICU arguments, spelling or confirmation tokens", () => {
    const text = "استخدم business_segments وtotal_revenue وJSON وnull وDELETE مع {business_segments}";
    const isolated = isolateArabicCode(text);
    for (const token of ["business_segments", "total_revenue", "JSON", "null", "DELETE"]) {
      expect(isolated).toContain(`\u2066${token}\u2069`);
    }
    expect(isolated).toContain("{business_segments}");
    expect(isolateArabicCode(isolated)).toBe(isolated);
    expect(isolated.replace(/[\u2066\u2069]/g, "")).toBe(text);
  });
  it("keeps unknown future values unapproved, including object-prototype names", () => {
    for (const value of ["Unknown future phrase", "toString", "constructor"]) {
      expect(reviewText("ar", value)).toBe(`⟦AR-REVIEW⟧ ${value}`);
      expect(reviewText("en", value)).toBe(value);
    }
  });
});
