import React from "react";
import { describe,expect,it,vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { HomePage } from "../src/components/home/HomePage";
import { SiteFooter } from "../src/components/foundation/SiteFooter";
import { SettingsAdminScreen } from "../src/components/accounts/AdminScreens";
import { checkRegister } from "../src/lib/copy-register";
import { readFileSync } from "node:fs";
import type { PublicHomeData } from "../src/home/types";
import type { PublicStockData,StockCriterion } from "../src/stock/types";
import en from "../src/i18n/messages/en.json";
import ar from "../src/i18n/messages/ar.json";
vi.mock("server-only",()=>({}));
vi.mock("../src/i18n/navigation",()=>({usePathname:()=>"/",getPathname:()=>"/"}));
vi.stubGlobal("React",React);
const empty:PublicHomeData={featured:null,methodology:null,editorPick:null};
const criterion:StockCriterion={id:"c",screening_run_id:"r",criterion_id:null,criterion_type:"custom_ratio",
  criterion_label:"Stored criterion",result:"pass",numerator_value:15,denominator_value:100,ratio:15,threshold:30,
  threshold_unit:"percent_of_total_assets",threshold_direction:"max",borderline_margin:null,numerator_definition:null,
  denominator_definition:null,input_states:[],confidence_tier:"Verified",source_ids:[],calculation_trace:null,
  result_reason:null,source_reference:null,sort_order:1};
function featured():PublicStockData {
  // Every field used by this server-only projection is synthetic, never a live Apple assessment.
  return {company:{id:"company",name:"RAW SEC CORP",display_name_en:"Curated fixture",name_ar:null,is_demo:true,
      description_ar:null,description_en:null,sector_label:null},
    security:{id:"security",company_id:"company",exchange_id:null,coverage_analyst_id:null,display_symbol:null,is_demo:true,slug:"demo-fixa",ticker:"FIXA"},
    exchange:{code:"NASDAQ",name:"NASDAQ"},
    run:{id:"r",status:"passes_selected_methodology",data_as_of:"2026-01-31",status_reasons:[],
      immutable_hash:"a".repeat(64),confidence:"High",data_adequacy:"adequate",calculation_version:"fixture",engine_version:"fixture",
      financial_period_id:null,financial_period_label:null,methodology_name:null,methodology_version_label:null,
      generated_at:new Date("2026-02-01"),is_demo:true},
    criteria:[{...criterion},{...criterion,id:"b",sort_order:2},{...criterion,id:"a",sort_order:0}],
    facts:[],unknowns:[],sources:[],priorRuns:[],analyst:null,explanation:null,
    methodology:null,version:null,period:null,
  };
}
function render(node:React.ReactNode,locale:"ar"|"en"="ar") {
  return renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale==="ar"?ar:en} timeZone="Asia/Riyadh">{node}</NextIntlClientProvider>);
}
describe("UX-6 homepage rendering",()=>{
  it.each(["ar","en"] as const)("renders ordered SSR sections and no invented feature or analyst in %s",locale=>{
    const html=render(<HomePage data={empty} locale={locale}/>,locale);
    expect(html).toContain('id="content"');
    expect(html).toContain(locale==="ar"?"دليلك في السوق.":"Your bearing in the market.");
    expect(html.indexOf('id="home-outcomes-title"')).toBeLessThan(html.indexOf('id="home-how-title"'));
    expect(html.indexOf('id="home-how-title"')).toBeLessThan(html.indexOf('id="home-editorial-title"'));
    expect(html.match(/Example Co\./g)).toHaveLength(3);
    expect(html).not.toContain("/stock/");
    expect(html).not.toContain("authorPortrait");
    expect(html).not.toContain("RAW SEC");
    expect(html).not.toContain("⟦AR-REVIEW⟧");
    expect(html).toContain(locale==="ar"?"لم تُحدَّد منهجية افتراضية بعد.":"No default methodology has been set yet.");
    expect(html).toContain("SEC EDGAR · 10-K · 10-Q");
    expect(html).toContain("<ol");
    expect(html).toContain(`${locale==="en"?"/en":""}/search?q=KO`);
    expect(checkRegister(html,locale).hardBans).toEqual([]);
  });
  it("uses the revised founder sentence, not a claim that Al Rajhi is active",()=>{
    const html=render(<HomePage data={empty} locale="ar"/>);
    expect(html).toContain("اكتب رمز السهم، لترى نتيجة الفحص وفق المنهجية المختارة، والأرقام التي بُنيت عليها.");
    expect(html).not.toContain("الراجحي");
  });
  it("one whole card links to the selected stock, retaining at most two sorted evidence bars",()=>{
    const data={...empty,featured:featured()};
    const before=structuredClone(data);
    const html=render(<HomePage data={data} locale="en"/>,"en");
    expect(html.match(/href="\/en\/stock\/demo-fixa"/g)).toHaveLength(1);
    expect(html).toContain("Curated fixture");
    expect(html).not.toContain("RAW SEC CORP");
    expect(html.match(/role="img"/g)?.length).toBeGreaterThanOrEqual(2);
    expect((html.match(/Stored criterion/g)||[])).toHaveLength(2);
    expect(html).toContain("15.00%");
    expect(html).toContain("30.00");
    expect(html).toContain("2026");
    expect(data).toEqual(before);
    const noRun={...data,featured:{...data.featured!,run:null}};
    expect(render(<HomePage data={noRun} locale="en"/>,"en")).not.toContain("/stock/");
  });
  it("uses actual methodology metadata rather than the mockup's hardcoded version",()=>{
    const html=render(<HomePage data={{...empty,methodology:{name:"Public fixture methodology",version:"9.2",slug:"fixture"}}} locale="en"/>,"en");
    expect(html).toContain("Public fixture methodology");
    expect(html).toContain("9.2");
    expect(html).not.toContain("Al Rajhi");
  });
  it.each([false,true])("published research does not acquire an invented author; active=%s",active=>{
    const data:PublicHomeData={...empty,editorPick:{slug:"demo-fixa",ticker:"FIXA",company_name:"Curated issuer",company_name_ar:null,
      thesis_ar:"⟦AR-REVIEW⟧ من الإفصاح إلى النتيجة.",thesis_en:"Stored research",published_at:null,
      analyst:active?{name_ar:"Fixture author",name_en:"Fixture author",credentials:"CFA",portrait_url:"https://media.example.invalid/author.jpg"}:null}};
    const html=render(<HomePage data={data} locale="ar"/>);
    expect(html).toContain("Curated issuer");
    expect(html.includes("Fixture author")).toBe(active);
    expect(html.includes("authorPortrait")).toBe(active);
    expect(html).not.toContain("⟦AR-REVIEW⟧");
  });
  it.each(["ar","en"] as const)("footer keeps the exact legal text in closed server HTML in %s",locale=>{
    const dictionary=locale==="ar"?ar:en;
    const html=render(<SiteFooter locale={locale}/>,locale);
    expect(html).toContain(dictionary.disclaimer.short);
    expect(html).toContain(dictionary.disclaimer.full);
    expect(html).not.toContain("<details");
    expect(readFileSync("src/components/foundation/SiteFooter.module.css","utf8")).toContain(".fullDisclosure:target");
    expect(html).toContain('href="#full-disclaimer"');
    expect(html).toContain('id="full-disclaimer"');
    expect(html).toContain(`href="${locale==="en"?"/en":""}/terms"`);
    expect(html).toContain(`href="${locale==="en"?"/en":""}/privacy"`);
    expect(html).not.toContain("⟦AR-REVIEW⟧");
  });
  it("exposes an empty slug input to admins, not a code-selected AAPL value",()=>{
    const html=render(<SettingsAdminScreen locale="ar" settings={null} versions={[]} saveSettings={vi.fn()}/>);
    expect(html).toContain("السهم المميّز في الصفحة الرئيسية");
    expect(html).toMatch(/id="settings-featured-security"[^>]*value=""/);
    expect(html).toContain('placeholder="nasdaq-aapl"');
    expect(readFileSync("drizzle/0018_home_featured_security.sql","utf8")).not.toMatch(/^\s*(UPDATE|INSERT INTO)\b/im);
  });
  it("preserves cookie/header-free ISR and uses only the public loader",()=>{
    const page=readFileSync("src/app/[locale]/(public)/page.tsx","utf8");
    expect(page).toContain("revalidate = 900");
    expect(page).toContain('"force-static"');
    expect(page).toContain("getPublicHome()");
    expect(page).not.toMatch(/\b(cookies|headers)\s*\(/);
  });
});
