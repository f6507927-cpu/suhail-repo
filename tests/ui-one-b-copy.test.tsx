import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { discover, leaves } from "../scripts/ar-review";
import { approvedArabicCopy } from "../src/i18n/approved-arabic";
import { uiOneBArabic } from "../src/i18n/approved-arabic-ui-one-b";
import { uiOneBReviewProposals } from "../src/i18n/ui-one-b-review-proposals";
import { accountCopyDictionary, reviewText } from "../src/components/accounts/types";
import { LocalizedText, PublicLocalizedText } from "../src/components/foundation/shared";
import { semanticPairs } from "../src/lib/palette";
import ar from "../src/i18n/messages/ar.json";

const arabic = /[\u0621-\u064a\u066e-\u06d3]/;
// Established brand / regulatory identifiers are not translation gaps.
const identifiers = new Set(["Google", "CIK"]);
function assertArabic(source: string, text: string | undefined) {
  expect(text, source).toBeTruthy();
  expect(text, source).not.toContain("⟦");
  if (!identifiers.has(source)) expect(text, source).toMatch(arabic);
}

describe("UI-1B complete interface copy boundary", () => {
  it("pins every supplied pair independently and preserves the two earlier approvals", () => {
    const table = readFileSync("attached_assets/Pasted-Step-UI-1B-Scope-labels-only-on-every-page-including-ac_1793885319007.txt", "utf8")
      .split(/Approved table \(English \| Arabic\):\s*/)[1]!.trim().split(/\r?\n/).map(line => line.split(" | "));
    expect(table).toHaveLength(107);
    expect(uiOneBArabic).toEqual(Object.fromEntries(table));
    const prior: Record<string, string> = {
      "Unlabelled criterion": "معيار بلا تسمية",
      "Methodology records": "سجلات المنهجيات",
    };
    for (const [source, text] of table) {
      expect(reviewText("ar", source!)).toBe(prior[source!] ?? text);
      expect(reviewText("en", source!)).toBe(source);
    }
  });
  it("walks all finite copy-helper callers, metadata, registries and Arabic JSON leaves", () => {
    const audit = discover();
    expect(audit.errors).toEqual([]);
    expect(audit.unresolved).toEqual([]);
    expect(audit.copySources.length).toBeGreaterThan(530);
    for (const source of audit.copySources) assertArabic(source, approvedArabicCopy[source]);
    for (const [key, text] of Object.entries(leaves(ar))) assertArabic(key, text);
    for (const [source, copy] of Object.entries(accountCopyDictionary)) assertArabic(source, copy.ar);
    for (const source of Object.keys(uiOneBReviewProposals)) assertArabic(source, reviewText("ar", source));
    for (const pair of semanticPairs) assertArabic(pair.mapping, reviewText("ar", pair.mapping));
  }, 60000);
  it("keeps arbitrary unapproved text English and isolates public and private fallbacks", () => {
    const source = "Future unknown interface sentence.";
    const text = reviewText("ar", source);
    expect(text).toBe(source);
    expect(text).not.toContain("⟦");
    expect(text).not.toMatch(arabic);
    expect(approvedArabicCopy[source]).toBeUndefined();
    for (const Component of [LocalizedText, PublicLocalizedText]) {
      const html = renderToStaticMarkup(<Component>{text}</Component>);
      expect(html).toContain('lang="en" dir="ltr"');
      expect(html).toContain(source);
      expect(html).not.toContain("⟦");
      // Historical annotation removal is presentation-only.
      expect(renderToStaticMarkup(<Component>{`⟦AR-REVIEW⟧ ${source}`}</Component>)).not.toContain("⟦");
    }
  });
  it("removes marker construction/detection from the requested runtime helpers", () => {
    for (const file of ["src/components/accounts/types.ts", "src/i18n/presentation.ts",
      "src/i18n/bidi.ts", "src/components/foundation/shared.tsx",
      "src/components/foundation/ThemeToggle.tsx", "src/components/foundation/LocaleSwitcher.tsx"])
      expect(readFileSync(file, "utf8"), file).not.toContain("⟦");
  });
});
