import React from "react";
import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import ar from "../../src/i18n/messages/ar.json";
import { AdminShell, SettingsAdminScreen, AuditAdminScreen } from "../../src/components/accounts/AdminScreens";
import { AdminFixture } from "../browser-fixture/AdminFixture";
import { FinancialAdmin } from "../../src/components/financial/FinancialAdmin";
import { MethodologyFixture } from "../browser-fixture/MethodologyFixture";
import { fixtureData,screeningData,runDetail } from "../browser-fixture/FinancialFixture";
import { ScreeningRunDetail } from "../../src/components/financial/ScreeningControls";
import { financialFixture } from "../browser-fixture/financial-actions";
import { screeningFixture } from "../browser-fixture/screening-actions";
import type { FinancialAdminData } from "../../src/lib/financial/contracts";
import type { ScreeningAdminData } from "../../src/screening/contracts";

// Dedicated test-only bundle. No auth adapter or mock is imported by the app.
const data = structuredClone(fixtureData) as FinancialAdminData;
const base = data.securities[0], company = data.companies[0];
data.securities = ["ZED","ALP","MID"].map((ticker,index)=>({...base,id:index ? `11111111-1111-4111-8111-11111111111${index+1}`:base.id,ticker,slug:`nasdaq-${ticker.toLowerCase()}`,company_id:index ? `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index+1}`:company.id}));
data.companies = data.securities.map((security,index)=>({...company,id:security.company_id!,name:["Zed Systems","Alpha Commerce","Middle Industries"][index],name_ar:["شركة زد","شركة ألفا","الشركة الوسطى"][index]}));
data.facts = data.facts.map(fact=>({...fact,label:"تسمية غير معروفة"}));
data.facts.push({...data.facts[0],id:"abcdefab-aaaa-4aaa-8aaa-aaaaaaaaaaaa",line_item:"analyst_custom_metric",label:"Unmapped analyst measure",is_current:true});
data.jobs = [{...data.jobs[0],job_name:"ingest-sec",status:"failed",counts:{processed:3,failed:1,inserted:2},cursor:{ids:data.securities.map(s=>s.id),next:3},errors:[{securityId:base.id,message:"Fixture filing could not be fetched."}]}];
const screening:ScreeningAdminData = {...structuredClone(screeningData),versions:[
  {id:"version-old",version:"1.0",label:"Version 1.0 · Draft",methodologyName:"Al Rajhi Adapted"},
  {id:"version-default",version:"1.1",label:"Version 1.1",methodologyName:"Al Rajhi Adapted"},
],defaultVersionId:"version-default",stockCount:3,bulkVersionIds:["version-old","version-default"],jobs:data.jobs};
const mode = window.location.pathname.split("/").filter(Boolean)[1] ?? "methodologies";
const params = new URLSearchParams(window.location.search);
if(params.has("running")) data.jobs[0].status="running";
const versions = [{id:"version-old",version:"1.0",version_label:"Version 1.0 · Draft"},{id:"version-default",version:"1.1",version_label:"Version 1.1"},{id:"example",version:"0.1",version_label:"Example Methodology",isExample:true}];
const audit:React.ComponentProps<typeof AuditAdminScreen>["initialRows"] = [{id:"audit-1",event_type:"user_role_change",entity_name:"users",entity_id:"fixture-user",summary:"Unknown stored audit summary",occurred_at:"2026-11-04T10:00:00Z",details:{count:3}}];
Object.assign(window,{uiNine:{financialFixture,screeningFixture,saves:[] as unknown[]}});
function Screen() {
  if(mode==="securities" || mode==="ingestion") return <FinancialAdmin data={data} screening={screening} role={params.get("role")==="editor"?"editor":"admin"} view={mode}/>;
  if(mode==="settings") return <SettingsAdminScreen locale="ar" settings={{default_shariah_methodology_version_id:params.has("example")?"example":"version-default",featured_security_slug:params.has("missing")?"saved-not-in-picker":params.has("featured")?"nasdaq-alp":null,allow_ineligible_editor_pick:false}} versions={versions} securities={data.securities.map((s,index)=>({slug:s.slug,ticker:s.ticker,name:data.companies[index].name,nameAr:data.companies[index].name_ar}))}
    saveSettings={async(...args)=>{(window as unknown as {uiNine:{saves:unknown[]}}).uiNine.saves.push(args);return{ok:true};}}/>;
  if(mode==="audit") return <AuditAdminScreen locale="ar" initialRows={audit} initialPage={1} initialTotal={1} eventOptions={["user_role_change","settings_change"]} entityOptions={["users","security"]}/>;
  if(mode==="methodologies" || mode==="") return <MethodologyFixture locale="ar"/>;
  if(mode==="runs") return <ScreeningRunDetail detail={runDetail} role="admin"/>;
  return <AdminFixture locale="ar" mode={mode} bare/>;
}
createRoot(document.getElementById("root")!).render(<NextIntlClientProvider locale="ar" messages={ar} timeZone="Asia/Riyadh">
  <AdminShell locale="ar" role="admin" currentPath={`/admin/${mode}`} userLabel="Local fixture"><Screen/></AdminShell>
</NextIntlClientProvider>);
