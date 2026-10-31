import { AdminMethodologies } from "../../src/components/methodology/AdminMethodologies";
import type { MethodologyAdminData } from "../../src/lib/methodology/admin-data";
import type { MethodologyCommand } from "../../src/lib/methodology/commands";
const methodId="11111111-1111-4111-8111-111111111111";
const versionId="22222222-2222-4222-8222-222222222222";
const criterionId="33333333-3333-4333-8333-333333333333";
export const methodologyFixture={calls:[] as MethodologyCommand[],fail:true};
declare global {interface Window{methodologyFixture:typeof methodologyFixture}}
window.methodologyFixture=methodologyFixture;
export function MethodologyFixture({locale}:{locale:"ar"|"en"}) {
  const params=new URLSearchParams(window.location.search),final=params.has("final");
  const data={
    methodologies:[{id:methodId,name:"UI fixture methodology",slug:"ui-fixture",short_label:"UI",type:"equity_screening",
      publisher:"Fixture publisher",source_title:"Fixture source",source_url:"https://fixture.invalid/rules",
      official_or_inspired:"internal_example",licensing_status:"internal",verified_by:null,verification_date:null,
      scope:"UI tests only",notes:null,production_enabled:false,is_demo:true,production_blocked:true}],
    versions:[{id:versionId,methodology_id:methodId,methodology_name:"UI fixture methodology",version:"1",version_label:"UI v1",
      effective_date:"2026-01-01",changelog:"Fixture only",notes:null,purification_treatment:null,
      workflow_status:final?"source_verified":"draft",workflow_history:[],analyst_test_cases:[],
      is_public:false,is_demo:true,production_blocked:true,production_enabled:false,source_ids:[],created_at:new Date("2026-01-01"),
      test_report_id:"44444444-4444-4444-8444-444444444444",impact_report_id:null,approval_id:null,approved_by:null,approved_at:null}],
    criteria:[{id:criterionId,methodology_id:methodId,methodology_version_id:versionId,criterion_type:"custom_ratio",label:"Fixture debt",
      definition:"UI test",formula_text:"Debt/assets",numerator_definition:"Debt",denominator_definition:"Assets",
      numerator_line_items:["interest_bearing_debt"],denominator_line_items:["total_assets"],threshold:33,
      threshold_unit:"percent_of_total_assets",threshold_direction:"max",borderline_margin:null,
      treatment_rules:null,treatment_rule_data:null,edge_cases:null,required_inputs:["interest_bearing_debt","total_assets"],
      source_reference:"UI fixture",effective_date:"2026-01-01",sort_order:1,notes:null}],
    reports:[{id:"44444444-4444-4444-8444-444444444444",methodology_version_id:versionId,kind:"test",
      created_at:new Date("2026-01-01"),payload:{engineVersion:"engine-1.0.1",calculationVersion:"calc-2026.10.1",passed:false,
        coverage:[{id:criterionId,label:"Fixture debt",missing:["fail"]}],coverageGaps:[{id:criterionId,label:"Fixture debt",missing:["fail"]}],
        sharedEngineGoldens:[],analystCases:[]}}],
    sources:[],
  } as unknown as MethodologyAdminData;
  // A second parent catches cross-methodology version leakage in deep links.
  data.versions.push({...data.versions[0],id:"77777777-7777-4777-8777-777777777777",version:"3",version_label:"UI v3"});
  data.methodologies.push({...data.methodologies[0],id:"55555555-5555-4555-8555-555555555555",name:"Second UI methodology",slug:"second-ui"});
  data.versions.push({...data.versions[0],id:"66666666-6666-4666-8666-666666666666",methodology_id:"55555555-5555-4555-8555-555555555555",version_label:"Second v2"});
  return <AdminMethodologies data={data} locale={locale} role={params.get("role")==="editor"?"editor":"admin"}
    selection={{methodology:params.get("methodology")??undefined,version:params.get("version")??undefined}}
    action={async(command)=>{
      methodologyFixture.calls.push(command);
      return methodologyFixture.fail?{ok:false,error:"Finalized criteria are immutable; create a new draft"}:{ok:true};
    }}/>;
}
