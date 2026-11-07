import React from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { StockVerdict } from "../src/components/stock/StockVerdict";
import { SearchResults } from "../src/components/search/SearchResults";
import { RecentStocks, RecentStocksList } from "../src/components/home/RecentStocks";
import { TermExplain, TermSheet, glossaryDefinition } from "../src/components/foundation/TermExplain";
import { TickerMonogram } from "../src/components/foundation/TickerMonogram";
import { addRecent, parseRecent, RECENT_LIMIT } from "../src/components/foundation/recent-stocks";
import { stockAnswer, stockAnswerText } from "../src/stock/answer-sentence";
import { uxPolishPairs } from "../src/i18n/proposed-arabic-ux-polish";
import { checkRegister } from "../src/lib/copy-register";
import glossary from "../content/glossary/glossary.json";
import { uiThreeFixture, uiThreeStatuses } from "./fixtures/ui-three-stock";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";

vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/" }));
vi.stubGlobal("React", React);

const render = (node: React.ReactNode, locale: "ar" | "en") => renderToStaticMarkup(
  <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">{node}</NextIntlClientProvider>);
const plain = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const bans = (text: string, locale: "ar" | "en") =>
  checkRegister(text, locale).hardBans.filter(term => /^(recommendation|advice|should buy)$/i.test(term));
const approvalDoc = readFileSync("docs/UX_POLISH_ARABIC_APPROVAL.md", "utf8");

describe("one-sentence stock answer (fixed templates, display only)", () => {
  for (const locale of ["ar", "en"] as const) {
    it.each(uiThreeStatuses)(`%s in ${locale} uses the stored status label and never mutates data`, status => {
      const data = uiThreeFixture(status);
      const before = structuredClone(data);
      const answer = stockAnswer(data, locale);
      if (!status) {
        expect(answer).toBeNull();
        return;
      }
      const text = stockAnswerText(answer!);
      expect(text).toContain((locale === "ar" ? ar : en).status[status]);
      expect(text.startsWith(answer!.company)).toBe(true);
      expect(text.endsWith(".")).toBe(true);
      expect(bans(text, locale)).toEqual([]);
      expect(text).not.toMatch(/recommend|advice|\bbuy\b|\bsell\b|توصية|نصيحة|اشتر|بِع/i);
      expect(data).toEqual(before);
    });
  }

  it("explains a failing status from the stored failure reason", () => {
    const data = uiThreeFixture("fails_selected_methodology");
    data.run!.status_reasons = [{ kind: "failure", criterionId: "debt", label: "Interest-bearing debt / market value basis",
      ratio: 41.3, threshold: 30, thresholdUnit: "percent_of_market_cap", reasonCode: "max_exceeded", field: null }] as never;
    expect(stockAnswerText(stockAnswer(data, "en")!)).toBe(
      "UI-3 display fixture: Likely Non-Compliant, because the Interest-bearing debt to market value criterion did not pass.");
    expect(stockAnswerText(stockAnswer(data, "ar")!)).toContain("، لأن معيار ");
    expect(stockAnswerText(stockAnswer(data, "ar")!)).toContain(" لم يجتز الفحص.");
  });

  it("prefers unknown-data reasons over counts and falls back to a plain sentence", () => {
    const data = uiThreeFixture("requires_review");
    data.run!.status_reasons = [
      { kind: "counts", criterionId: null, label: "", ratio: null, threshold: null, thresholdUnit: null, reasonCode: "criterion_counts", field: null, borderlineCount: 0, unknownCount: 1 },
      { kind: "criterion_unknown", criterionId: "income", label: "Prohibited income / total revenue", ratio: null, threshold: 5, thresholdUnit: "percent_of_total_revenue", reasonCode: "numerator_unavailable", field: null },
    ] as never;
    expect(stockAnswerText(stockAnswer(data, "en")!)).toBe(
      "UI-3 display fixture: Requires Review, because data for the Non-permissible income to total revenue criterion is not available.");
    data.run!.status_reasons = [{ not: "a reason" }] as never;
    expect(stockAnswerText(stockAnswer(data, "en")!)).toBe("UI-3 display fixture: Requires Review.");
  });

  it("uses the stored Arabic company name when present", () => {
    const data = uiThreeFixture("passes_selected_methodology");
    data.company.name_ar = "شركة الاختبار";
    const answer = stockAnswer(data, "ar")!;
    expect(answer.companyLang).toBe("ar");
    expect(stockAnswerText(answer)).toBe(`شركة الاختبار: ${ar.status.passes_selected_methodology} وفق المنهجية المختارة.`);
  });

  for (const locale of ["ar", "en"] as const) {
    it(`renders the hero (status bar, large badge, answer, monogram) before the summary in ${locale}`, () => {
      const html = render(<StockVerdict data={uiThreeFixture("requires_review")} locale={locale} canonicalUrl="https://example.test/stock/x" />, locale);
      const header = html.split('data-section="header"')[1].split("</header>")[0];
      expect(html).toContain('data-section="header" data-status="requires_review"');
      expect(header).toContain("data-stock-answer");
      expect(header).toContain("data-ticker-monogram");
      expect(header).toContain("status-review");
      expect(html.indexOf("data-stock-answer")).toBeLessThan(html.indexOf('data-section="why"'));
      // The summary no longer repeats the large badge; the full record keeps its own.
      const why = html.split('data-section="why"')[1].split('data-section="share"')[0];
      expect(why).not.toContain("status-review");
    });
  }

  it("has no hero answer or badge when no run is stored", () => {
    const html = render(<StockVerdict data={uiThreeFixture(null)} locale="en" canonicalUrl="https://example.test/stock/x" />, "en");
    expect(html).toContain('data-status="none"');
    expect(html).not.toContain("data-stock-answer");
  });
});

describe("tap-to-explain glossary", () => {
  it("every glossary term has both languages, is pending approval and is listed for the founder", () => {
    expect(glossary._status).toBe("pending_founder_approval");
    for (const [key, entry] of Object.entries(glossary.terms)) {
      expect(entry.en.trim(), key).not.toBe("");
      expect(entry.ar.trim(), key).toMatch(/[\p{Script=Arabic}]/u);
      expect(approvalDoc, key).toContain(entry.ar);
      expect(approvalDoc, key).toContain(entry.en);
      for (const locale of ["ar", "en"] as const) expect(bans(entry[locale], locale)).toEqual([]);
    }
  });

  it("renders a native popover with server HTML text and leaves unknown terms unchanged", () => {
    const trigger = renderToStaticMarkup(<p><TermExplain term="interest_bearing_debt" idSuffix="c1">الديون بفوائد</TermExplain></p>);
    expect(trigger).toMatch(/^<p><button type="button" class="term-trigger" popovertarget="term-interest_bearing_debt-c1" data-term="interest_bearing_debt">الديون بفوائد<\/button><\/p>$/i);
    const html = renderToStaticMarkup(<TermSheet term="interest_bearing_debt" idSuffix="c1" locale="ar" title="الديون بفوائد" />);
    expect(html).toContain('id="term-interest_bearing_debt-c1"');
    expect(html).toContain('popover="auto"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain(glossary.terms.interest_bearing_debt.ar);
    expect(html).toContain(uxPolishPairs.termClose.ar);
    expect(renderToStaticMarkup(<TermExplain term="total_revenue" idSuffix="x">Total revenue</TermExplain>)).toBe("Total revenue");
    expect(renderToStaticMarkup(<TermSheet term="total_revenue" idSuffix="x" locale="en" title="Total revenue" />)).toBe("");
    expect(glossaryDefinition("non_permissible_revenue", "en")).toBe(glossary.terms.prohibited_income.en);
  });

  it("wraps glossary operands in the stock ratio lines", () => {
    const html = render(<StockVerdict data={uiThreeFixture("passes_selected_methodology")} locale="ar" canonicalUrl="https://example.test/stock/x" />, "ar");
    expect(html).toContain('data-term="interest_bearing_debt"');
    expect(html).toContain('data-term="market_value_basis"');
    expect(html).toContain('data-term="prohibited_income"');
  });
});

describe("recently viewed (browser-only, cacheable)", () => {
  it("keeps only public identity, deduplicates and caps the list", () => {
    const item = (n: number) => ({ slug: `nyse-t${n}`, ticker: `T${n}`, name: `Company ${n}`, nameAr: null });
    let list = parseRecent(null);
    for (let n = 0; n < RECENT_LIMIT + 3; n++) list = addRecent(list, item(n));
    list = addRecent(list, item(RECENT_LIMIT + 1));
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0].slug).toBe(`nyse-t${RECENT_LIMIT + 1}`);
    expect(new Set(list.map(entry => entry.slug)).size).toBe(RECENT_LIMIT);
    expect(Object.keys(list[0]).sort()).toEqual(["name", "nameAr", "slug", "ticker"]);
  });

  it("rejects malformed or hostile stored values", () => {
    expect(parseRecent("not json")).toEqual([]);
    expect(parseRecent(JSON.stringify({ slug: "x" }))).toEqual([]);
    expect(parseRecent(JSON.stringify([{ slug: "javascript:alert(1)", ticker: "X", name: "X", nameAr: null }]))).toEqual([]);
    expect(parseRecent(JSON.stringify([{ slug: "nyse-ko", ticker: "KO", name: "Coca-Cola", nameAr: null, status: "x" }]))).toHaveLength(1);
  });

  it("server-renders nothing so the homepage stays static, and the list is hidden when empty", () => {
    expect(renderToStaticMarkup(<RecentStocks locale="ar" />)).toBe("");
    expect(renderToStaticMarkup(<RecentStocksList locale="en" items={[]} />)).toBe("");
    const html = renderToStaticMarkup(<RecentStocksList locale="ar" items={[{ slug: "nyse-ko", ticker: "KO", name: "COCA COLA CO", nameAr: null }]} />);
    expect(html).toContain('href="/stock/nyse-ko"');
    expect(html).toContain(uxPolishPairs.recentClear.ar);
    expect(html).not.toMatch(/status-(pass|fail|review|insufficient)/);
  });
});

describe("ticker monogram and preview image", () => {
  it("monogram is decorative and shows the ticker only", () => {
    expect(renderToStaticMarkup(<TickerMonogram ticker="brk.b" />)).toBe(
      '<span aria-hidden="true" data-ticker-monogram="true" data-size="md" data-length="5" class="ticker-monogram " dir="ltr">BRK.B</span>');
  });

  it("search results lead each row with a monogram and do not repeat an untranslated name", () => {
    const html = render(<SearchResults locale="ar" valid results={[{ slug: "nyse-ko", ticker: "KO", name: "COCA COLA CO", name_ar: null, display_name_en: null, exchange: "NYSE", status: "passes_selected_methodology" }]} />, "ar");
    expect(html).toContain("data-ticker-monogram");
    expect(plain(html).match(/COCA COLA CO/g)).toHaveLength(1);
  });

  it("preview image routes use public data, ISR and no request state", () => {
    const route = readFileSync("src/app/[locale]/(public)/stock/[slug]/opengraph-image.tsx", "utf8");
    expect(route).toContain("revalidate = 900");
    expect(route).toContain("getPublicStockData");
    expect(route).not.toMatch(/cookies\(|headers\(|dbApp/);
    expect(readFileSync("src/app/[locale]/(public)/stock/[slug]/twitter-image.tsx", "utf8")).toContain('from "./opengraph-image"');
  });
});

describe("pending Arabic is listed for founder approval", () => {
  it("every proposed pair appears in the approval table", () => {
    for (const [key, pair] of Object.entries(uxPolishPairs)) {
      expect(approvalDoc, key).toContain(pair.ar);
      expect(approvalDoc, key).toContain(pair.en);
    }
  });
});
