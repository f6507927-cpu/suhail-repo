import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
vi.mock("server-only",()=>({}));
import { criterionSchema, requiredInputs, engineCriterion, analystCasesSchema } from "../src/lib/methodology/contracts";
import { testReport, impactReport, goldenHashes } from "../src/lib/methodology/reports";
import { nextStage } from "../src/lib/methodology/gates";
import { input, criterion, fact } from "../src/engine/__fixtures__/synthetic";
import type { AnalystCase } from "../src/lib/methodology/contracts";
export const criterionData = {
  criterion_type:"custom_ratio" as const,label:"Candidate debt",definition:"Defined by analyst",
  formula_text:"debt / assets",numerator_definition:"Debt",denominator_definition:"Assets",
  numerator_line_items:["interest_bearing_debt"] as ("interest_bearing_debt")[],
  denominator_line_items:["total_assets"] as ("total_assets")[],threshold:33,
  threshold_unit:"percent_of_total_assets" as const,threshold_direction:"max" as const,
  borderline_margin:null as number|null,treatment_rules:null,treatment_rule_data:null,
  edge_cases:null,source_reference:"Analyst document",effective_date:"2026-01-01",sort_order:0,notes:null,
};
function caseFor(id:string,value:number,outcome:"pass"|"fail"|"borderline"):AnalystCase {
  const i=input({facts:[fact("interest_bearing_debt",value),fact("total_assets",100)]});
  const {methodologyVersion:_,engineVersion:__,calculationVersion:___,...inputs}=i;
  void _;void __;void ___;
  return {name:outcome,inputs,expected:{criteria:{[id]:outcome},status:outcome==="pass"?"passes_selected_methodology":outcome==="fail"?"fails_selected_methodology":"requires_review"}};
}
describe("governed criterion validation",()=>{
  it("preserves null margins and derives operands",()=>{
    const c=criterionSchema.parse(criterionData);
    expect(c.borderline_margin).toBeNull();expect(requiredInputs(c)).toEqual(["interest_bearing_debt","total_assets"]);
  });
  it.each([
    {threshold:null},{borderline_margin:-1},{borderline_margin:Infinity},
    {numerator_line_items:[]},{denominator_line_items:[]},{criterion_type:"unregistered"},
    {numerator_line_items:["unregistered"]},{threshold_unit:"boolean"},
    {effective_date:"2026-02-30"},{numerator_line_items:["interest_bearing_debt","interest_bearing_debt"]},
  ])("refuses invalid criterion %j",data=>expect(criterionSchema.safeParse({...criterionData,...data}).success).toBe(false));
  it("boolean business rules need no threshold and derive segments",()=>{
    const c=criterionSchema.parse({...criterionData,criterion_type:"business_activity",threshold:null,threshold_direction:"boolean",threshold_unit:"boolean",numerator_line_items:["business_segments"],denominator_line_items:[],treatment_rule_data:{prohibited_categories:["alcohol"]}});
    expect(requiredInputs(c)).toEqual(["business_segments"]);
  });
  it("registered ratio evaluators also support boolean direction with no threshold",()=>{
    expect(criterionSchema.safeParse({...criterionData,threshold:null,threshold_direction:"boolean",threshold_unit:"boolean"}).success).toBe(true);
  });
  it("rejects non-finite test input and injected candidate criteria",()=>{
    const c=caseFor(randomUUID(),20,"pass");
    expect(analystCasesSchema.safeParse([c]).success).toBe(true);
    expect(analystCasesSchema.safeParse([{...c,inputs:{...c.inputs,methodologyVersion:{}}}]).success).toBe(false);
    c.inputs.facts[0].value=NaN;expect(analystCasesSchema.safeParse([c]).success).toBe(false);
  });
});
describe("D-100 candidate-only coverage",()=>{
  const id=randomUUID(),candidate={id:randomUUID(),label:"Candidate",criteria:[engineCriterion({...criterionData,id})]};
  it("goldens-only empty suite persists named pass and fail gaps",()=>{
    const r=testReport(candidate,[]);expect(r.sharedEngineGoldens).toHaveLength(13);
    expect(r.sharedEngineGoldens.every(g=>g.passed)).toBe(true);expect(r.passed).toBe(false);
    expect(r.coverageGaps).toEqual([expect.objectContaining({id,label:"Candidate debt",missing:["pass","fail"]})]);
  });
  it.each([["pass",20,"fail"],["fail",60,"pass"]] as const)("missing counterpart %s", (outcome,value,missing)=>{
    const r=testReport(candidate,[caseFor(id,value,outcome)]);expect(r.passed).toBe(false);expect(r.coverageGaps[0].missing).toEqual([missing]);
  });
  it.each([3,0])("non-null margin %s requires borderline",margin=>{
    const c={...candidate,criteria:[{...candidate.criteria[0],borderlineMargin:margin}]};
    const cases=[caseFor(id,20,"pass"),caseFor(id,60,"fail")];
    expect(testReport(c,cases).coverageGaps[0].missing).toEqual(["borderline"]);
    expect(testReport(c,[...cases,caseFor(id,33,"borderline")]).passed).toBe(true);
  });
  it("collective cases complete coverage, not each case separately",()=>{
    expect(testReport(candidate,[caseFor(id,20,"pass"),caseFor(id,60,"fail")]).passed).toBe(true);
  });
  it("mismatching expectations do not count; aggregate status cannot count",()=>{
    const wrong=caseFor(id,60,"pass");
    const r=testReport(candidate,[wrong]);
    expect(r.analystCases[0].passed).toBe(false);expect(r.coverageGaps[0].missing).toEqual(["pass","fail"]);
    const declared=caseFor(id,20,"pass");declared.expected.criteria={};
    expect(testReport(candidate,[declared]).coverageGaps[0].observed).toEqual([]);
  });
  it("execution failures count nothing",()=>{
    const bad=caseFor(id,20,"pass");bad.inputs.facts.push(bad.inputs.facts[0]);
    const r=testReport(candidate,[bad]);expect(r.analystCases[0].error).toBeTruthy();expect(r.coverageGaps[0].observed).toEqual([]);
  });
  it("newly cloned identities cannot reuse old coverage",()=>{
    const c={...candidate,criteria:[{...candidate.criteria[0],id:randomUUID()}]};
    expect(testReport(c,[caseFor(id,20,"pass"),caseFor(id,60,"fail")]).passed).toBe(false);
    expect(testReport(c,[caseFor(id,20,"pass")]).coverageGaps[0].missing).toEqual(["pass","fail"]);
  });
  it("unreachable business borderline remains blocking, not exempted",()=>{
    const c={...candidate,criteria:[criterion({id,criterionType:"business_activity",numeratorLineItems:["business_segments"],denominatorLineItems:[],thresholdDirection:"boolean",thresholdUnit:"boolean",threshold:null,borderlineMargin:0,treatmentRuleData:{prohibited_categories:["alcohol"]}})]};
    const pass=caseFor(id,20,"pass"),fail=caseFor(id,60,"fail");fail.inputs.segments[0].activityCategory="alcohol";
    const r=testReport(c,[pass,fail]);expect(r.coverageGaps[0].missing).toEqual(["borderline"]);
  });
  it("pins shared hash constants to existing snapshots without changing them",()=>{
    const snapshots=readFileSync("src/engine/__snapshots__/hash.test.ts.snap","utf8")+readFileSync("src/engine/__snapshots__/completeness.test.ts.snap","utf8");
    for(const hash of Object.values(goldenHashes)) expect(snapshots).toContain(hash);
  });
});
describe("workflow and dry-run report contracts",()=>{
  it("sequential stages end at approved; production stays separate",()=>{
    expect(["draft","source_verified","rules_normalized","tests_passed","universe_tested","human_reviewed"].map(nextStage)).toEqual(["source_verified","rules_normalized","tests_passed","universe_tested","human_reviewed","approved"]);
    expect(nextStage("approved")).toBeNull();
    expect(nextStage("production")).toBeNull();
    expect(nextStage("unregistered")).toBeNull();
  });
  const definition={id:"candidate",label:"Candidate",criteria:[criterion()]};
  it("empty universe explicitly permits impact step without inventing a baseline",()=>{
    expect(impactReport(definition,null,[],"2026-10-14")).toMatchObject({passed:true,message:"no securities",securities:[]});
  });
  it("no baseline permits successful candidate evaluations without inventing comparisons",()=>{
    const c=caseFor("fixture-ratio",20,"pass");
    const r=impactReport(definition,null,[{securityId:"x",ticker:"X",inputs:c.inputs,error:null}],"2026-10-14");
    expect(r).toMatchObject({passed:true,baselineId:null,baselineError:null,
      baselineNote:"baseline: none (first production methodology)",transitionMatrix:{},drivingCriteria:[]});
    expect(r.securities[0]).toMatchObject({error:null,oldStatus:null,newStatus:"passes_selected_methodology",oldCriteria:[]});
    expect(r.securities[0].newCriteria).toHaveLength(1);
  });
  it("no baseline with one evidence error still fails and preserves that error",()=>{
    const c=caseFor("fixture-ratio",20,"pass");
    const r=impactReport(definition,null,[
      {securityId:"x",ticker:"X",inputs:c.inputs,error:null},
      {securityId:"y",ticker:"Y",inputs:null,error:"No usable annual period"},
    ],"2026-10-14");
    expect(r.passed).toBe(false);
    expect(r.securities[0].error).toBeNull();
    expect(r.securities[1].error).toBe("No usable annual period");
  });
  it("a configured but unusable baseline fails even with evaluable or empty evidence",()=>{
    const c=caseFor("fixture-ratio",20,"pass");
    for(const evidence of [[],[{securityId:"x",ticker:"X",inputs:c.inputs,error:null}]]) {
      const r=impactReport(definition,null,evidence,"2026-10-14","The default baseline has unusable rules");
      expect(r).toMatchObject({passed:false,baselineNote:null,baselineError:"The default baseline has unusable rules"});
    }
  });
  it("candidate engine errors still fail without a baseline",()=>{
    const c=caseFor("fixture-ratio",20,"pass");
    const r=impactReport({...definition,criteria:[{...criterion(),threshold:NaN}]},null,
      [{securityId:"x",ticker:"X",inputs:c.inputs,error:null}],"2026-10-14");
    expect(r.passed).toBe(false);
    expect(r.securities[0].error).toBeTruthy();
  });
  it("absent annual evidence is an explicit refusal with or without a baseline",()=>{
    const evidence=[{securityId:"x",ticker:"X",inputs:null,error:"No annual period"}];
    expect(impactReport(definition,null,evidence,"2026-10-14").passed).toBe(false);
    expect(impactReport(definition,definition,evidence,"2026-10-14").securities[0].error).toBe("No annual period");
  });
  it("identical evidence produces transition matrix and explicit unknowns",()=>{
    const c=caseFor("fixture-ratio",60,"fail");c.inputs.facts=[];
    const r=impactReport(definition,definition,[{securityId:"x",ticker:"X",inputs:c.inputs,error:null}],"2026-10-14");
    expect(r.passed).toBe(true);expect(r.securities[0].newStatus).toBe("insufficient_data");
    expect(r.securities[0].newUnknowns?.length).toBeGreaterThan(0);
  });
});
