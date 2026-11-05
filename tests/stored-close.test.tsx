import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { StoredMonthlyClose } from "../src/components/stock/StoredMonthlyClose";
import type { StoredClose } from "../src/ingest/prices/selection";
import { formatCalendarDate } from "../src/lib/format";
vi.stubGlobal("React", React);

const close: StoredClose = { id: "price", created_at: "2026-10-01", date: "2026-09-30",
  month_end_for: "2026-09-30", close: 123.45, currency: "USD", source_id: "source",
  price_provider: "API Ninjas", source_label: "API Ninjas" };
describe("stored month-end close presentation", () => {
  it.each(["ar", "en"] as const)("server renders stored-only attribution, Western digits and isolated date in %s", locale => {
    const html = renderToStaticMarkup(<StoredMonthlyClose close={close} locale={locale} />);
    expect(html).toContain('href="https://api-ninjas.com"');
    expect(html).toContain(locale === "ar" ? "الأسعار: API Ninjas" : "Prices: API Ninjas");
    expect(html).toContain(locale === "ar" ? "سعر الإغلاق في" : "Closing price on");
    expect(html).toContain('<time dateTime="2026-09-30"');
    expect(html.replace(/<[^>]*>/g, "")).toContain(formatCalendarDate(close.date, locale));
    expect(html).toContain("$123.45");
    expect(html).not.toContain("US$");
    expect(html).not.toMatch(/[٠-٩]|⟦AR-REVIEW⟧|%|<svg|<canvas|live/i);
    expect(html).toContain("font-mono");
  });
  it("keeps missing data absent and manual evidence distinct", () => {
    expect(renderToStaticMarkup(<StoredMonthlyClose locale="en" />)).toBe("");
    const html = renderToStaticMarkup(<StoredMonthlyClose locale="en"
      close={{ ...close, price_provider: "manual", source_label: "Analyst filing note" }} />);
    expect(html).toContain("Analyst filing note"); expect(html).not.toContain("API Ninjas");
  });
  it("links available stored manual provenance without inventing or accepting unsafe URLs", () => {
    const manual = { ...close, price_provider: "manual", source_label: "Stored document",
      source_url: "https://example.test/stored-close" };
    expect(renderToStaticMarkup(<StoredMonthlyClose close={manual} locale="ar" />))
      .toContain('href="https://example.test/stored-close"');
    expect(renderToStaticMarkup(<StoredMonthlyClose close={{ ...manual, source_url: "javascript:alert(1)" }} locale="ar" />))
      .not.toContain("href=");
  });
});
