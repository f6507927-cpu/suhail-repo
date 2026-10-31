import { screen, EngineInputError, ENGINE_VERSION, CALCULATION_VERSION, type Criterion, type EngineInput } from "../../engine";
import { goldenInput } from "../../engine/__fixtures__/synthetic";
import { evidenceCases, evidenceGoldenInput } from "../../engine/__fixtures__/evidence";
import type { AnalystCase } from "./contracts";
function executionError(error:unknown) {
  return error instanceof EngineInputError ? error.message : "Engine execution failed; no result produced";
}

// D-98: unchanged shared regression hashes, pinned to existing engine snapshots.
export const goldenHashes = {
  "A-pass":"582b4654230ed31614853a0d169fbb993fc31d8bf7822b763b7eca02f35f5a6b",
  "A-review":"6ebb4c7cab9114b3c751168d4cbd745e4486ff9a1489cb91111e3ac9601fdb51",
  "A-fail":"a108304db70958a7d2a12ab048fc20c21e1975bf89b203be090d66c49f11297d",
  "A-insufficient":"fa8e0e131533b70577fdb5a455b5ceca82f903d060d5a8db2961437ebe50c597",
  "B-pass":"dff159ec39b7f00d450be3bea32db95ae58e559fc12f488016c7fb02923a0d59",
  "B-review":"31420311bb329c782753973120aa55e0790d7ba9a5dbab849f3d29b4dd135fed",
  "B-fail":"668fd9a207abf7cee98533ce5af68a50dc0e2360d62e0753f2016faf1c0f6fd7",
  "B-insufficient":"8d24c1ba871b460f6ed5723940e574c04016b8d509bffce979caa30691887c87",
  prohibited_primary:"c5b90991954d87849537d6986f98525982b0ec2412da2b5cc3583bac7eb1d8e6",
  estimated_input:"35adcb08b50a8a27a1bd3d841b2566632d18ee287ed47b9ca16fc05c5068f7fe",
  stale_period:"44a9c38756f95a7fbc2b9d19a97dcb11d7cbc75fe7186e19bf1df58d2b86fb03",
  missing_numerator:"6f2e7a169d40e94382f21f99bf759d24e91019efdb5e1df8d257a9699ff73412",
  prohibited_primary_tie:"0188035a3b6abbe428a6c5214b769c63b30afa26886e4efae15ddbd68f1ef44f",
};
export function runSharedGoldens() {
  const inputs:[keyof typeof goldenHashes,EngineInput][] = [];
  for(const example of ["A","B"] as const) for(const outcome of ["pass","review","fail","insufficient"] as const)
    inputs.push([`${example}-${outcome}`,goldenInput(example,outcome)]);
  for(const name of evidenceCases) inputs.push([name,evidenceGoldenInput(name)]);
  return inputs.map(([name,input]) => {
    try {
      const actual = screen(input);
      // D-125/D-98: preserve historical hash checks AND exercise current rules.
      // These exact-value examples have unchanged outputs under new precision.
      const current = screen({...input,engineVersion:ENGINE_VERSION,calculationVersion:CALCULATION_VERSION});
      const currentPassed = JSON.stringify(current.hashPayload.outputs) === JSON.stringify(actual.hashPayload.outputs);
      return {name,passed:actual.immutableHash === goldenHashes[name] && currentPassed,
        expectedHash:goldenHashes[name],actualHash:actual.immutableHash,actualStatus:actual.status,
        currentPassed,currentEngineVersion:ENGINE_VERSION,currentCalculationVersion:CALCULATION_VERSION,
        currentHash:current.immutableHash,error:null};
    } catch(error) { return {name,passed:false,expectedHash:goldenHashes[name],actualHash:null,actualStatus:null,error:executionError(error)}; }
  });
}
export function testReport(version:{id:string;label:string;criteria:Criterion[]},cases:AnalystCase[]) {
  const covered = new Map(version.criteria.map(c => [c.id,new Set<string>()]));
  const sharedEngineGoldens = runSharedGoldens();
  const analystCases = cases.map(test => {
    try {
      const result = screen({...test.inputs,methodologyVersion:version,engineVersion:ENGINE_VERSION,calculationVersion:CALCULATION_VERSION});
      const outcomes = result.criteria.map(c => {
        const expected = test.expected.criteria[c.criterionId] ?? null;
        const matched = expected === c.result;
        // D-100 counts only executed matching criterion outcomes, not aggregate status.
        if(matched) covered.get(c.criterionId)!.add(c.result);
        return {id:c.criterionId,label:c.label,expected,actual:c.result,matched};
      });
      const unexpectedIds = Object.keys(test.expected.criteria).filter(id => !covered.has(id));
      const passed = outcomes.every(c=>c.matched) && unexpectedIds.length===0 && result.status===test.expected.status;
      return {name:test.name,passed,expectedStatus:test.expected.status,actualStatus:result.status,outcomes,unexpectedIds,error:null};
    } catch(error) {
      return {name:test.name,passed:false,expectedStatus:test.expected.status,actualStatus:null,outcomes:[],unexpectedIds:[],error:executionError(error)};
    }
  });
  const coverage = version.criteria.map(c => {
    const required = ["pass","fail",...(c.borderlineMargin !== null?["borderline"]:[])];
    return {id:c.id,label:c.label,required,observed:[...covered.get(c.id)!],missing:required.filter(outcome=>!covered.get(c.id)!.has(outcome))};
  });
  const coverageGaps = coverage.filter(c=>c.missing.length);
  return {
    reportSchema:"methodology-test-1",engineVersion:ENGINE_VERSION,calculationVersion:CALCULATION_VERSION,
    versionId:version.id,sharedEngineGoldens,analystCases,coverage,coverageGaps,
    passed:version.criteria.length>0 && cases.length>0 && !coverageGaps.length && sharedEngineGoldens.every(c=>c.passed) && analystCases.every(c=>c.passed),
  };
}
export type ImpactEvidence = {
  securityId:string;ticker:string;inputs:AnalystCase["inputs"]|null;error:string|null;
};
export function impactReport(candidate:{id:string;label:string;criteria:Criterion[]},baseline:typeof candidate|null,evidence:ImpactEvidence[],asOf:string,baselineError:string|null=null) {
  const matrix:Record<string,Record<string,number>> = {};
  const drivers = new Map<string,{id:string;label:string;count:number}>();
  const securities = evidence.map(e => {
    if(e.error || !e.inputs) return {securityId:e.securityId,ticker:e.ticker,error:e.error || "No usable annual period",oldStatus:null,newStatus:null,criteria:[],borderline:[],inputs:e.inputs};
    try {
      const common = {...e.inputs,engineVersion:ENGINE_VERSION,calculationVersion:CALCULATION_VERSION};
      const old = baseline ? screen({...common,methodologyVersion:baseline}) : null;
      const next = screen({...common,methodologyVersion:candidate});
      if(old) {
        matrix[old.status] ??= {};
        matrix[old.status][next.status]=(matrix[old.status][next.status]??0)+1;
      }
      // Criterion identity differs between versions: document candidate drivers by
      // type/label and preserve both full result sets rather than equating UUIDs.
      const criteria = next.criteria.filter(c => {
        const matches = (old?.criteria ?? []).filter(o=>o.criterionType===c.criterionType && o.label===c.label && o.sortOrder===c.sortOrder);
        const previous = matches.length===1?matches[0]:null;
        return !previous || previous.result!==c.result || previous.ratio!==c.ratio || previous.threshold!==c.threshold;
      });
      const removedCriteria = (old?.criteria ?? []).filter(o=>!next.criteria.some(c=>c.criterionType===o.criterionType && c.label===o.label && c.sortOrder===o.sortOrder));
      if(old && old.status!==next.status) for(const c of criteria) {
        const d=drivers.get(c.criterionId)??{id:c.criterionId,label:c.label,count:0};d.count++;drivers.set(d.id,d);
      }
      if(old && old.status!==next.status) for(const c of removedCriteria) {
        const d=drivers.get(c.criterionId)??{id:c.criterionId,label:`${c.label} (removed from candidate)`,count:0};d.count++;drivers.set(d.id,d);
      }
      return {securityId:e.securityId,ticker:e.ticker,error:null,oldStatus:old?.status??null,newStatus:next.status,
        criteria,removedCriteria,oldCriteria:old?.criteria??[],newCriteria:next.criteria,
        oldUnknowns:old?.unknowns??[],newUnknowns:next.unknowns,
        borderline:next.criteria.filter(c=>c.result==="borderline"),oldBorderline:old?.criteria.filter(c=>c.result==="borderline")??[],inputs:e.inputs};
    } catch(error) { return {securityId:e.securityId,ticker:e.ticker,error:executionError(error),oldStatus:null,newStatus:null,criteria:[],borderline:[],inputs:e.inputs}; }
  });
  return {reportSchema:"methodology-impact-1",engineVersion:ENGINE_VERSION,calculationVersion:CALCULATION_VERSION,
    versionId:candidate.id,baselineId:baseline?.id??null,baselineLabel:baseline?.label??null,asOf,
    baselineError,baselineNote:!baseline && !baselineError?"baseline: none (first production methodology)":null,
    evidencePolicy:"latest annual period; current facts; matching-period segments",
    message:evidence.length===0?"no securities":null,transitionMatrix:matrix,
    drivingCriteria:[...drivers.values()].sort((a,b)=>b.count-a.count),
    securities,passed:!baselineError && securities.every(s=>!s.error)};
}
