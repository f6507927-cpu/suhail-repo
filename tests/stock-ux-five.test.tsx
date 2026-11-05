import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { StockVerdict } from "../src/components/stock/StockVerdict";
import { StockFigures, StockSummary } from "../src/components/stock/StockSummary";
import { StockShare } from "../src/components/stock/StockShare";
import type { PublicStockData, StockCriterion } from "../src/stock/types";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
import { readFileSync } from "node:fs";
import { criterionSchema, engineCriterion } from "../src/lib/methodology/contracts";
import { stockUxFiveArabic } from "../src/i18n/approved-arabic-stock-ux-five";
import { reviewText } from "../src/components/accounts/types";
import { checkRegister } from "../src/lib/copy-register";
vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/" }));
vi.stubGlobal("React", React);

const criterion:StockCriterion = { id:"criterion", criterion_label:"Debt", criterion_type:"custom_ratio", result:"pass",
  ratio:15, threshold:30, threshold_unit:"percent_of_total_assets", threshold_direction:"max",
  numerator_value:98_657_000_000, denominator_value:4_664_202_633_466.667, sort_order:0,
  source_ids:[],input_states:["reported"],confidence_tier:"Verified",
  screening_run_id:"run",criterion_id:null,numerator_definition:null,denominator_definition:null,
  borderline_margin:null,calculation_trace:null,result_reason:null,source_reference:null,
};
function fixture(): PublicStockData {
  return { company:{id:"company",name:"SEC RAW /CO",name_ar:null,display_name_en:"Curated Company",description_ar:null,description_en:null,sector_label:null,is_demo:false},
    security:{id:"security",company_id:"company",exchange_id:null,coverage_analyst_id:null,display_symbol:null,ticker:"FIX",slug:"fixture",is_demo:false},
    run:{id:"run",status:"passes_selected_methodology",status_reasons:[],immutable_hash:"a".repeat(64),confidence:"High",
      data_as_of:"2025-12-31",generated_at:new Date("2026-01-01"),methodology_name:"Stored method",
      data_adequacy:"adequate",calculation_version:"calc-test",engine_version:"engine-test",financial_period_id:"period",
      financial_period_label:"FY2025",methodology_version_label:"1",is_demo:false},
    version:{id:"v",version:"1",version_label:null,production_enabled:false,is_demo:false,workflow_status:"draft"},
    methodology:{name:"Method",slug:"method",scope:null,official_or_inspired:"adapted",is_demo:false},
    period:{id:"period",fiscal_period_label:"FY2025",period_end:"2025-12-31",reported_date:null,source_id:null},
    criteria:[{...criterion}],unknowns:[],priorRuns:[],
    facts:[],sources:[],explanation:null,analyst:null,exchange:null,
  };
}
function render(element: React.ReactNode, locale:"ar"|"en"="ar") {
  return renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale==="ar"?ar:en} timeZone="UTC">{element}</NextIntlClientProvider>);
}
describe("UX-5 answer-first record", () => {
  it.each(["ar","en"] as const)("keeps the entire immutable record in closed server HTML in %s",locale=>{
    const data=fixture();const original=structuredClone(data);
    const html=render(<StockVerdict data={data} locale={locale} canonicalUrl="https://public.example/stock/fixture"/>,locale);
    expect(html.indexOf("data-section=\"why\"")).toBeLessThan(html.indexOf("data-section=\"full-record\""));
    expect(html).toMatch(/<details[^>]*data-section="full-record">/);
    expect(html).toContain("a".repeat(64));
    expect(html).toContain("data-section=\"fundamentals\"");
    expect(html).toContain("data-section=\"disclaimer\"");
    // D-157 supersedes UX-5 item 4 only; closed/full immutable record assertions stay.
    expect(html).toContain((locale==="ar"?ar:en).disclaimer.short);
    expect(html).not.toContain((locale==="ar"?en:ar).disclaimer.short);
    // UI-1B translates the remaining empty-record prose; identity titles alone are not narrative.
    expect(html.match(/data-language-notice=/g)?.length??0).toBe(0);
    expect(html).not.toContain("⟦AR-REVIEW⟧");
    expect(html).toContain("Curated Company");
    expect(html).not.toContain("SEC RAW");
    expect(html).toContain("data-section=\"search-again\"");
    expect(data).toEqual(original);
  });
  it.each(["passes_selected_methodology","fails_selected_methodology","requires_review","insufficient_data"] as const)(
    "uses a fixed approved meaning independently of stored reasons for %s",status=>{
      const data=fixture(); data.run!.status=status;
      data.run!.status_reasons=[{kind:"review_unknown",reason_code:"stale_data",field:"Stored freshness reason",
        criterion_id:null,criterion_label:null,ratio:null,threshold:null}];
      const html=render(<StockSummary data={data} locale="ar"/>);
      expect(html).toContain("Stored freshness reason");
      expect(html).toContain("ماذا تعني هذه النتيجة؟");
      expect(html).toContain("متى تتغير؟");
      expect(html).toContain("قد تتغير النتيجة مع إفصاح جديد");
      expect(html).not.toContain("⟦AR-REVIEW⟧");
      expect(checkRegister(render(<StockSummary data={data} locale="en"/>,"en"),"en").hardBans).toEqual([]);
  });
  it("uses the real ratio scale and limit marker, including min, unknown and pass-only",()=>{
    const data=fixture();
    data.criteria=[
      {...criterion,id:"over",result:"fail",ratio:41.3},
      {...criterion,id:"unknown",ratio:null,result:"unknown"},
      {...criterion,id:"boolean",threshold_unit:"boolean",ratio:null,threshold:null},
      {...criterion,id:"minimum",threshold_direction:"min",ratio:60},
    ];
    const html=render(<StockSummary data={data} locale="en"/>,"en");
    const markers=[...html.matchAll(/inset-inline-start:([\d.]+)%/g)].map(match=>Number(match[1]));
    expect(markers).toContainEqual(expect.closeTo(72.639225,5));
    expect(html).toContain("11.30");
    expect(html).toContain('data-unknown="true"');
    expect(html).toContain('width:100%');
    expect(html).toContain('inset-inline-start:50%');
  });
  it("does not round a positive failed excess to zero or invent missing explanations",()=>{
    const data=fixture();data.criteria[0]={...criterion,ratio:30.004,result:"fail",explanation_en:"Stored explanation",explanation_ar:null};
    expect(render(<StockSummary data={data} locale="en"/>,"en")).toContain("&gt; 0.00");
    expect(render(<StockSummary data={data} locale="en"/>,"en")).toContain("Stored explanation");
    expect(render(<StockSummary data={data} locale="ar"/>)).not.toContain("Stored explanation");
    expect(render(<StockSummary data={data} locale="ar"/>)).not.toContain("ما هذا المعيار؟");
  });
  it("marks a maximum-limit exceedance without rewriting a borderline result",()=>{
    const data=fixture();data.criteria[0]={...criterion,ratio:30.1,result:"borderline"};
    const html=render(<StockSummary data={data} locale="en"/>,"en");
    expect(html).toContain('data-result="fail"');
    expect(html).toContain("Borderline");
    expect(html).toContain("0.10");
    expect(data.criteria[0].result).toBe("borderline");
  });
  it("keeps covered passing seals without inventing an inactive analyst identity",()=>{
    const data=fixture();data.security.coverage_analyst_id="inactive";
    const html=render(<StockSummary data={data} locale="ar"/>);
    expect(html).toContain("data-coverage-seal");
    expect(html).not.toContain("data-coverage-byline");
    expect(html).not.toContain("Analyst profile unavailable");
    data.run!.status="requires_review";
    expect(render(<StockSummary data={data} locale="ar"/>)).not.toContain("data-coverage-seal");
  });
  it("uses scaled USD facts, their periods and em dashes instead of invented market data",()=>{
    const data=fixture();data.facts=[{line_item:"total_revenue",value:416161,unit_scale:"millions",currency:"USD"}] as PublicStockData["facts"];
    const html=render(<StockFigures data={data} locale="ar"/>);
    expect(html).toContain("$416B"); expect(html).toContain("FY2025");
    expect((html.match(/>—</g)||[])).toHaveLength(3);
    data.facts[0].unit_scale="unrecognised";
    expect(render(<StockFigures data={data} locale="ar"/>)).not.toContain("$416B");
  });
  it("uses only the canonical URL for WhatsApp, with a polite copy announcement region",()=>{
    const url="https://public.example/en/stock/fixture";
    const html=render(<StockShare canonicalUrl={url} locale="ar"/>);
    expect(html).toContain(`https://wa.me/?text=${encodeURIComponent(url)}`);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("نسخ الرابط");
  });
  it("limits the approval to UI wording and gives earlier translations precedence",()=>{
    for(const source of Object.keys(stockUxFiveArabic).filter(key=>key.startsWith("The stock")||key.startsWith("A criterion")||key.startsWith("The result"))) {
      expect(reviewText("ar",source)).toBe(stockUxFiveArabic[source]);
    }
    expect(stockUxFiveArabic[en.disclaimer.short]).toBeUndefined();
    expect(stockUxFiveArabic[en.disclaimer.full]).toBeUndefined();
    const migration=readFileSync("drizzle/0017_methodology_criterion_explanations.sql","utf8");
    expect(migration).toContain("GRANT SELECT (explanation_ar, explanation_en)");
    expect(migration).not.toMatch(/^\s*(?:UPDATE|INSERT INTO|DROP)\b/im);
    expect(criterionSchema.shape.explanation_ar.safeParse(null).success).toBe(true);
    expect(criterionSchema.shape.explanation_en.safeParse("x".repeat(20001)).success).toBe(false);
    expect(engineCriterion.toString()).not.toContain("explanation_ar");
  });
});
