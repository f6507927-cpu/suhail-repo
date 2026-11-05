import React from "react";
import { describe,it,expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { uiNineLabels } from "../src/i18n/approved-arabic-ui-nine";
import { uiNineText,adminFactLabel,adminInputCounts,adminVersionLabel } from "../src/i18n/admin-presentation";
import { AdminRecordSection } from "../src/components/financial/AdminRecordSection";
describe("UI-9 presentation approval",()=>{
  const attachment=readFileSync("attached_assets/Pasted-Step-UI-9-Scope-admin-UX-only-Do-not-change-any-status-_1793900661946.txt","utf8");
  const rows=attachment.split("Approved table (Arabic | English):")[1].trim().split("\n").filter(row=>row.includes(" | ")).map(row=>row.split(" | ").map(value=>value.trim()));
  it("covers every exact approved table pair in both languages",()=>{
    expect(rows.length).toBeGreaterThan(25);
    for(const [ar,en] of rows){expect(uiNineLabels[en as keyof typeof uiNineLabels]).toBe(ar);expect(uiNineText("ar",en)).toBe(ar);expect(uiNineText("en",en)).toBe(en);}
  });
  it("keeps distinct input counts and Western digits",()=>{
    expect(adminInputCounts("ar",2,7)).toBe("2 غير معروف · 7 تقديري");
    expect(adminInputCounts("en",2,7)).toBe("2 unknown · 7 estimated");
  });
  it("maps known keys before bad stored labels and keeps distinct unknown names",()=>{
    expect(adminFactLabel("interest_bearing_debt","تسمية غير معروفة","ar")).toBe("الديون بفوائد");
    expect(adminFactLabel("analyst_custom_metric","Unmapped analyst measure","ar")).toBe("Unmapped analyst measure");
    expect(adminFactLabel("analyst_custom_metric",null,"ar")).toBe("analyst_custom_metric");
  });
  it("uses version number first and does not change frozen input",()=>{
    const version=Object.freeze({version:"1.1",label:"Version 1.1",methodologyName:"Stored methodology"});
    const snapshot=JSON.stringify(version);
    for(const locale of ["ar","en"] as const) expect(adminVersionLabel(version,locale,{isDefault:true})).toMatch(/^1\.1 ·/);
    expect(adminVersionLabel(version,"ar",{isDefault:true})).toContain("(الافتراضي)");
    expect(JSON.stringify(version)).toBe(snapshot);
  });
  it("server-renders section content closed except the first company section",()=>{
    const closed=renderToStaticMarkup(<AdminRecordSection name="Financial data" locale="ar"><p>Retained immutable field</p></AdminRecordSection>);
    expect(closed).toContain("Retained immutable field");expect(closed).not.toContain('open=""');
    expect(renderToStaticMarkup(<AdminRecordSection name="Company details" locale="ar" first>Company</AdminRecordSection>)).toContain('open=""');
  });
});
