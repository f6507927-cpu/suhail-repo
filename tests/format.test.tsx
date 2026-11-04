import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { englishCompanyName, formatCompactMoney, formatNumber, formatPercent } from "../src/lib/format";
import { Num } from "../src/components/foundation/Num";
import { CriterionValue, RatioValue } from "../src/components/stock/StockVerdictParts";
import type { StockCriterion } from "../src/stock/types";

describe("UX-2 summary and record formatting", () => {
  it.each([
    [4_664_202_633_466.667, "$4.66T"],
    [416_161_000_000, "$416B"],
    [98_657_000_000, "$98.7B"],
    [null, "—"],
    [0, "$0"],
    [-98_657_000_000, "-$98.7B"],
  ] as const)("compact USD %s → %s", (value, expected) => {
    expect(formatCompactMoney(value)).toBe(expected);
  });
  it.each(["en", "ar"] as const)("keeps summary money isolated and full records unabridged (%s)", locale => {
    const summary = renderToStaticMarkup(createElement(CriterionValue, {
      locale, value: 4_664_202_633_466.667, compactMoney: true,
    }));
    expect(summary).toContain("$4.66T");
    expect(summary).toContain('<bdi dir="ltr" class="font-mono tabular-nums');
    const record = renderToStaticMarkup(createElement(CriterionValue, {
      locale, value: 4_664_202_633_466.667,
    }));
    expect(record).toContain(formatNumber(4_664_202_633_466.667, locale));
    expect(record).not.toMatch(/[TB]/);
    expect(record).not.toContain("667");
    const nullSummary = renderToStaticMarkup(createElement(CriterionValue, { locale, value: null, compactMoney: true }));
    expect(nullSummary).toContain("—");
    expect(nullSummary).toContain("<bdi");
    const percent = renderToStaticMarkup(createElement(Num, null, formatPercent(0.1, locale)));
    expect(percent).toContain("10.00");
    expect(percent).not.toMatch(/[٠-٩]/);
    const criterion = { threshold: 30, threshold_unit: "percent_of_total_assets", result: "fail" } as StockCriterion;
    const ratio = renderToStaticMarkup(createElement(RatioValue, { criterion, value: 30.004, locale }));
    expect(ratio).toContain("&gt; 30.00%");
    expect(ratio).not.toContain("30.004");
  });
  it("defaults table numbers to no more than two decimal places", () => {
    expect(formatNumber(4_664_202_633_466.667, "en")).toBe("4,664,202,633,466.67");
    expect(formatNumber(98_657_000_000, "en")).toBe("98,657,000,000");
    expect(formatPercent(0.05, "en")).toBe("5.00%");
  });
  it.each([null, undefined, "", " \n "])("falls back to SEC identity for an empty display name: %j", display_name_en => {
    expect(englishCompanyName({ name: "COSTCO WHOLESALE CORP /NEW", display_name_en })).toBe("COSTCO WHOLESALE CORP /NEW");
  });
  it("uses curated English identity without rewriting the SEC source", () => {
    const issuer = { name: "COSTCO WHOLESALE CORP /NEW", display_name_en: " Costco Wholesale " };
    expect(englishCompanyName(issuer)).toBe("Costco Wholesale");
    expect(issuer.name).toBe("COSTCO WHOLESALE CORP /NEW");
    expect(issuer.display_name_en).toBe(" Costco Wholesale ");
  });
});
