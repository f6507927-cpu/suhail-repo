import { describe, expect, it } from "vitest";
import { EngineInputError, screen, verify } from "./index";
import { hash } from "./canonical";
import { input, criterion, fact, segment } from "./__fixtures__/synthetic";
import { decimal, finite, roundRatio } from "./math";
import { validateShares } from "./shares";

describe("D-83/D-92 contract boundaries", () => {
  it.each(["engineVersion","calculationVersion"])("historic payload %s is hashed and independently verifiable without current-version validation",key=>{
    const payload={engineVersion:"historic-engine",calculationVersion:"historic-calculation",result:"unknown"};
    const stored=hash(payload);
    expect(verify(payload,stored)).toBe(true);
    expect(verify({...payload,[key]:"other-historic-version"},stored)).toBe(false);
  });
  it.each([
    input({methodologyVersion:{id:"x",label:"x",criteria:[]}}),
    input({engineVersion:"engine-1.0.0"}),
    input({calculationVersion:"made-up"}),
    input({methodologyVersion:{id:"x",label:"x",criteria:[criterion({borderlineMargin:-1})]}}),
  ])("rejects unsupported contracts", value => expect(() => screen(value)).toThrow(EngineInputError));
  it.each([-0.001, 40, 1.000001])("rejects fractional range %s", revenueShare =>
    expect(() => screen(input({segments:[segment({revenueShare})]}))).toThrow(EngineInputError));
  it.each([[0.9,0.9],[0.4,0.4],[0.7,0.3],[0.500001,0.499999]])("rejects contradictory shares %s/%s", (a,b) =>
    expect(() => screen(input({segments:[segment({revenueAmount:50,revenueShare:a}),segment({segmentName:"B",revenueAmount:50,revenueShare:b})]}))).toThrow(EngineInputError));
  it("allows thirds and exact half-unit rounding, but not an extra arbitrary tolerance", () => {
    for (const shares of [[0.333333,0.333333,0.333333]]) {
      expect(() => validateShares(shares.map((revenueShare,i)=>segment({segmentName:String(i), revenueShare,revenueAmount:1})))).not.toThrow();
    }
    expect(() => validateShares([segment({revenueShare:0.5000005, revenueAmount:1}),segment({revenueShare:0.4999995,revenueAmount:1})])).not.toThrow();
    expect(() => validateShares([segment({revenueShare:0.5000005001, revenueAmount:1}),segment({revenueShare:0.4999994999,revenueAmount:1})])).toThrow(EngineInputError);
  });
  it("does not invent missing shares/amounts or use unknown-state numbers", () => {
    for (const segments of [
      [], [segment({revenueShare:null})],
      [segment({revenueShare:0.3,revenueAmount:null}),segment({inputState:"unknown",revenueAmount:999,revenueShare:1})],
      [segment({revenueShare:null,revenueAmount:0})],
      [segment({revenueShare:1,revenueAmount:0})],
      [segment({revenueShare:1,revenueAmount:-1})],
    ]) expect(() => validateShares(segments)).not.toThrow();
    expect(() => validateShares([segment({revenueShare:0.6,revenueAmount:null}),segment({revenueShare:0.6,revenueAmount:null}),segment({inputState:"unknown"})])).toThrow(EngineInputError);
  });
  it("rejects a bank made smaller than its available revenue proportions", () => {
    const i = input({segments:[segment({activityCategory:"conventional_finance",revenueAmount:90,revenueShare:0.1}),segment({segmentName:"tech",revenueAmount:10,revenueShare:0.9})]});
    i.methodologyVersion.criteria=[criterion({criterionType:"business_activity",treatmentRuleData:{prohibited_categories:["conventional_finance"]}})];
    expect(()=>screen(i)).toThrow(EngineInputError);
  });
  it("rejects finite-input overflow and non-finite conversions with typed errors", () => {
    const i=input({facts:[fact("a",Number.MAX_VALUE),fact("b",Number.MAX_VALUE),fact("total_assets",1)]});
    i.methodologyVersion.criteria[0].numeratorLineItems=["a","b"];
    expect(()=>screen(i)).toThrow(EngineInputError);
    expect(()=>screen(input({facts:[fact("interest_bearing_debt",Number.MAX_VALUE),fact("total_assets",Number.MIN_VALUE)]}))).toThrow(EngineInputError);
    expect(()=>validateShares([segment({revenueAmount:Number.MAX_VALUE,revenueShare:0.5}),segment({revenueAmount:Number.MAX_VALUE,revenueShare:0.5})])).toThrow(EngineInputError);
    for(const value of [NaN, Infinity, -Infinity]) {
      expect(()=>decimal(value)).toThrow(EngineInputError);
      expect(()=>roundRatio(value)).toThrow(EngineInputError);
      expect(()=>finite(value,"fixture")).toThrow(EngineInputError);
    }
  });
});
