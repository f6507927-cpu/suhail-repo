import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ratioDisplay } from "../src/components/stock/ratio-display";
import { EvidenceValue } from "../src/components/stock/StockVerdictParts";
vi.mock("server-only", () => ({}));

it.each(["en", "ar"] as const)("reveals failing ratios without changing numbers (%s)", locale => {
  expect(ratioDisplay(30.004, 30, true, locale)).not.toBe(ratioDisplay(30, 30, false, locale));
  expect(ratioDisplay(0.000001, 0, true, locale)).not.toMatch(/^0$/);
  expect(ratioDisplay(0.000000001, 0, true, locale)).toMatch(/^> /);
  expect(ratioDisplay(30.00000000001, 30, true, locale)).toMatch(/^> /);
  expect(ratioDisplay(29.99999999999, 30, true, locale)).toMatch(/^< /);
  expect(ratioDisplay(30, 30, true, locale)).not.toMatch(/[<>]/);
  expect(ratioDisplay(12.345, 30, false, locale)).toBe("12.35");
});
it.each(["en", "ar"] as const)("does not fabricate a missing evidence definition beside a number (%s)", locale => {
  const numeric = renderToStaticMarkup(<EvidenceValue definition={null} value={123} locale={locale} />);
  expect(numeric).toContain("123");
  expect(numeric).not.toMatch(/Not recorded|AR-REVIEW/);
  expect(renderToStaticMarkup(<EvidenceValue definition={null} value={null} locale={locale} />)).toContain("—");
});
