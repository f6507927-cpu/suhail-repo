import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { methodology, methodologyVersion, methodologyCriterion, methodologyVersionReport } from "../../db/schema/methodology";
import { source, security, company, financialPeriod, financialFact, businessSegment } from "../../db/schema/market";
import { editorialSetting } from "../../db/schema/editorial";
import { audit, type Tx, type AppUser } from "../auth/audit";
import { criterionSchema, engineCriterion, requiredInputs, metadataSchema, versionSchema, analystCasesSchema, type AnalystCase } from "./contracts";
import { nextStage, requireGate, requirePublicProduction, requireVisibilityChange, GovernanceError } from "./gates";
import { testReport, impactReport, type ImpactEvidence } from "./reports";
import { screen, ENGINE_VERSION, CALCULATION_VERSION } from "../../engine";
import type { JsonObject } from "../../db/schema/types";
import { refreshMarketValue, securityFacts } from "../financial/market-value-persistence";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function identity(id:string) {requireGate(uuid.test(id),"Invalid record identity");return id;}
function payload(value:unknown):JsonObject { return JSON.parse(JSON.stringify(value)) as JsonObject; }
async function lock(tx:Tx) {
  // D-93: take the existing prerequisite lock BEFORE reading, at READ COMMITTED.
  await tx.execute(sql`select pg_advisory_xact_lock(66420020)`);
}
async function versionRow(tx:Tx,id:string) {
  const [v]=await tx.select().from(methodologyVersion).where(eq(methodologyVersion.id,identity(id))).for("update");
  requireGate(v,"Version not found");return v;
}
async function parentRow(tx:Tx,id:string) {
  const [m]=await tx.select().from(methodology).where(eq(methodology.id,identity(id)));
  requireGate(m,"Methodology not found");return m;
}
export async function candidateDefinition(tx:Tx,id:string) {
  const v=await versionRow(tx,id);
  const rows=await tx.select().from(methodologyCriterion).where(eq(methodologyCriterion.methodology_version_id,id)).orderBy(methodologyCriterion.sort_order,methodologyCriterion.id);
  const criteria=rows.map(c => engineCriterion({...criterionSchema.parse({
    criterion_type:c.criterion_type,label:c.label,definition:c.definition,formula_text:c.formula_text,
    numerator_definition:c.numerator_definition,denominator_definition:c.denominator_definition,
    numerator_line_items:c.numerator_line_items,denominator_line_items:c.denominator_line_items,
    threshold:c.threshold,threshold_unit:c.threshold_unit,threshold_direction:c.threshold_direction,
    borderline_margin:c.borderline_margin,treatment_rules:c.treatment_rules,treatment_rule_data:c.treatment_rule_data,
    edge_cases:c.edge_cases,source_reference:c.source_reference,effective_date:c.effective_date,sort_order:c.sort_order,notes:c.notes,
  }),id:c.id}));
  requireGate(criteria.length,"Add at least one valid criterion");
  return {id:v.id,label:v.version_label??v.version,criteria};
}
export async function saveMethodology(tx:Tx,actor:AppUser,id:string|null,data:unknown) {
  await lock(tx);
  const values=metadataSchema.parse(data);
  if(id) {
    const before=await parentRow(tx,id);
    await tx.update(methodology).set({...values,updated_at:new Date()}).where(eq(methodology.id,id));
    await audit(tx,actor,{event_type:"methodology_update",entity_name:"methodology",entity_id:id,summary:"Metadata updated",details:payload({before,after:values})});
    return id;
  }
  const [m]=await tx.insert(methodology).values({...values,is_demo:false,production_enabled:false,created_by:actor.id}).returning();
  await audit(tx,actor,{event_type:"methodology_create",entity_name:"methodology",entity_id:m.id,summary:"Explicit non-demo methodology created",details:payload(values)});
  return m.id;
}
export async function saveVersion(tx:Tx,actor:AppUser,methodologyId:string,id:string|null,cloneId:string|null,data:unknown) {
  await lock(tx);
  const m=await parentRow(tx,methodologyId);
  const values=versionSchema.parse(data);
  if(id) {
    const v=await versionRow(tx,id);
    requireGate(v.methodology_id===m.id,"Version belongs to another methodology");
    requireGate(v.workflow_status==="draft","Finalized content is immutable; create a new draft");
    await tx.update(methodologyVersion).set({...values,updated_at:new Date()}).where(eq(methodologyVersion.id,id));
    await audit(tx,actor,{event_type:"methodology_update",entity_name:"methodology_version",entity_id:id,summary:"Draft content updated",details:payload(values)});
    return id;
  }
  const clone=cloneId?await versionRow(tx,cloneId):null;
  requireGate(!clone || clone.methodology_id===m.id,"Clone must belong to this methodology");
  const [v]=await tx.insert(methodologyVersion).values({
    ...values,methodology_id:m.id,methodology_name:m.name,created_by:actor.id,created_by_name:actor.full_name,
    supersedes_version_id:clone?.id??null,is_demo:m.is_demo || !!clone?.is_demo,
    production_blocked:m.production_blocked || !!clone?.production_blocked,
  }).returning();
  if(clone) {
    const criteria=await tx.select().from(methodologyCriterion).where(eq(methodologyCriterion.methodology_version_id,clone.id));
    if(criteria.length) await tx.insert(methodologyCriterion).values(criteria.map(c=>({
      ...c,id:randomUUID(),created_at:new Date(),updated_at:new Date(),created_by:actor.id,
      methodology_id:m.id,methodology_version_id:v.id,
    })));
    // Cases intentionally start empty: expectations must target the NEW UUIDs (D-100).
  }
  await audit(tx,actor,{event_type:"methodology_version_create",entity_name:"methodology_version",entity_id:v.id,summary:"Draft version created",details:payload({cloneId,...values})});
  return v.id;
}
export async function saveCriterion(tx:Tx,actor:AppUser,versionId:string,id:string|null,data:unknown) {
  await lock(tx);
  const v=await versionRow(tx,versionId);
  requireGate(v.workflow_status==="draft","Finalized criteria are immutable; create a new draft");
  const c=criterionSchema.parse(data),eventType=id?"criterion_update":"criterion_create";
  if(id) {
    const [old]=await tx.select().from(methodologyCriterion).where(eq(methodologyCriterion.id,identity(id)));
    requireGate(old?.methodology_version_id===v.id,"Criterion does not belong to this version");
    await tx.update(methodologyCriterion).set({...c,required_inputs:requiredInputs(c),updated_at:new Date()}).where(eq(methodologyCriterion.id,id));
  } else {
    const [row]=await tx.insert(methodologyCriterion).values({...c,required_inputs:requiredInputs(c),methodology_id:v.methodology_id,methodology_version_id:v.id,created_by:actor.id,is_demo:v.is_demo}).returning();
    id=row.id;
  }
  await audit(tx,actor,{event_type:eventType,entity_name:"methodology_criterion",entity_id:id,summary:"Draft criterion saved",details:payload(c)});
  return id;
}
export async function deleteCriterion(tx:Tx,actor:AppUser,versionId:string,id:string) {
  await lock(tx);const v=await versionRow(tx,versionId);
  requireGate(v.workflow_status==="draft","Finalized criteria are immutable");
  const [c]=await tx.delete(methodologyCriterion).where(and(eq(methodologyCriterion.id,identity(id)),eq(methodologyCriterion.methodology_version_id,v.id))).returning();
  requireGate(c,"Criterion not found");
  await audit(tx,actor,{event_type:"criterion_update",entity_name:"methodology_criterion",entity_id:id,summary:"Draft criterion deleted",details:payload(c)});
}
export async function saveCases(tx:Tx,actor:AppUser,versionId:string,data:unknown) {
  await lock(tx);const v=await versionRow(tx,versionId);
  requireGate(v.workflow_status==="draft","Finalized analyst cases are immutable");
  const cases=analystCasesSchema.parse(data);
  const definition=await candidateDefinition(tx,v.id);
  for(const c of cases) {
    requireGate(Object.keys(c.expected.criteria).every(id=>definition.criteria.some(d=>d.id===id)),"Expected results reference a criterion outside this version");
    // Typed contract errors must be refused while authoring, not assumed away.
    screen({...c.inputs,methodologyVersion:definition,engineVersion:ENGINE_VERSION,calculationVersion:CALCULATION_VERSION});
  }
  await tx.update(methodologyVersion).set({analyst_test_cases:cases as unknown as JsonObject[],updated_at:new Date()}).where(eq(methodologyVersion.id,v.id));
  await audit(tx,actor,{event_type:"methodology_update",entity_name:"methodology_version",entity_id:v.id,summary:"Draft analyst cases saved",details:{count:cases.length}});
}
export async function associateSource(tx:Tx,actor:AppUser,versionId:string,sourceId:string) {
  await lock(tx);const v=await versionRow(tx,versionId);const m=await parentRow(tx,v.methodology_id);
  requireGate(v.workflow_status==="draft","Source associations are immutable after draft");
  const [s]=await tx.select().from(source).where(eq(source.id,identity(sourceId)));
  requireGate(s && !s.is_demo && !s.is_synthetic && !s.production_blocked && s.confidence_tier==="Verified" && s.source_type==="methodology_document" && s.document_title?.trim() && s.source_url?.startsWith("https://") && s.source_url===m.source_url,"Select a genuine verified methodology document matching the methodology HTTPS URL");
  await tx.update(methodologyVersion).set({source_ids:[...new Set([...v.source_ids,s.id])]}).where(eq(methodologyVersion.id,v.id));
  await audit(tx,actor,{event_type:"methodology_update",entity_name:"methodology_version",entity_id:v.id,summary:"Verified methodology document associated",details:{sourceId:s.id}});
}
async function sourceVerified(tx:Tx,v:typeof methodologyVersion.$inferSelect,m:typeof methodology.$inferSelect) {
  requireGate(m.source_url?.startsWith("https://") && m.source_title?.trim() && m.verified_by?.trim() && m.verification_date,"Complete HTTPS source title/URL, verifier and verification date");
  const sources=await tx.select().from(source);
  const linked=sources.filter(s=>v.source_ids.includes(s.id));
  requireGate(linked.length===v.source_ids.length && linked.length>0 && linked.every(s=>!s.is_demo && !s.is_synthetic && !s.production_blocked && s.confidence_tier==="Verified" && s.source_type!=="internal" && s.source_url?.startsWith("https://")) && linked.some(s=>s.source_type==="methodology_document" && s.source_url===m.source_url && s.document_title?.trim()),"Associate a genuine verified methodology document; metadata alone is insufficient");
}
async function persistReport(tx:Tx,actor:AppUser,v:typeof methodologyVersion.$inferSelect,kind:"test"|"impact",report:unknown) {
  const [r]=await tx.insert(methodologyVersionReport).values({methodology_version_id:v.id,kind,payload:payload(report),author_id:actor.id,created_by:actor.id,is_demo:v.is_demo}).returning();
  await tx.update(methodologyVersion).set(kind==="test"?{test_report_id:r.id}:{impact_report_id:r.id}).where(eq(methodologyVersion.id,v.id));
  await audit(tx,actor,{event_type:"methodology_update",entity_name:"methodology_version_report",entity_id:r.id,summary:`${kind} report recorded`,details:{versionId:v.id,kind}});
  return r.id;
}
async function impact(tx:Tx,v:typeof methodologyVersion.$inferSelect) {
  const asOf=new Date().toISOString().slice(0,10);
  const definition=await candidateDefinition(tx,v.id);
  const [settings]=await tx.select().from(editorialSetting).where(eq(editorialSetting.setting_key,"editorial"));
  const universe=await tx.select().from(security).where(eq(security.in_universe,true)).orderBy(security.id);
  let baseline:null|typeof definition=null;
  let baselineError:string|null=null;
  if(settings?.default_shariah_methodology_version_id) {
    try { baseline=await candidateDefinition(tx,settings.default_shariah_methodology_version_id); }
    catch { baselineError="The default baseline has unusable rules"; }
  }
  const evidence:ImpactEvidence[]=[];
  for(const s of universe) {
    const [period]=await tx.select().from(financialPeriod).where(and(eq(financialPeriod.company_id,s.company_id??"00000000-0000-0000-0000-000000000000"),eq(financialPeriod.period_type,"annual"))).orderBy(sql`${financialPeriod.period_end} desc nulls last`,desc(financialPeriod.reported_date),financialPeriod.id).limit(1);
    if(!period?.period_end || !s.company_id) {evidence.push({securityId:s.id,ticker:s.ticker,inputs:null,error:"No usable annual period"});continue;}
    await tx.select().from(company).where(eq(company.id,s.company_id)).for("update");
    await refreshMarketValue(tx,null,s.company_id,s.id,asOf);
    const facts=await tx.select().from(financialFact).where(and(eq(financialFact.company_id,s.company_id),eq(financialFact.period_id,period.id),eq(financialFact.is_current,true),securityFacts(s.id)));
    const segments=await tx.select().from(businessSegment).where(and(eq(businessSegment.company_id,s.company_id),eq(businessSegment.period_id,period.id)));
    // D-99: same evidence object for both versions; missing states remain unavailable.
    evidence.push({securityId:s.id,ticker:s.ticker,error:null,inputs:{
      securityId:s.id,asOf,period:{id:period.id,label:period.fiscal_period_label,periodEnd:period.period_end},
      facts:facts.map(f=>({lineItem:f.line_item,value:f.input_state==="missing"?null:f.value,inputState:f.input_state==="missing"?"unknown":f.input_state,confidenceTier:f.confidence_tier,sourceId:f.source_id??""})),
      segments:segments.map(b=>({segmentName:b.segment_name,activityCategory:b.activity_category,revenueAmount:b.revenue_amount,revenueShare:b.revenue_share,inputState:b.input_state==="missing"?"unknown":b.input_state,confidenceTier:b.confidence_tier,sourceId:b.source_id??""})),
    }});
  }
  return impactReport(definition,baseline,evidence,asOf,baselineError);
}
export async function transition(tx:Tx,actor:AppUser,id:string,target:string,note:string) {
  await lock(tx);const v=await versionRow(tx,id);const m=await parentRow(tx,v.methodology_id);
  requireGate(typeof note==="string" && note.length<=20000,"Invalid workflow note");
  requireGate(nextStage(v.workflow_status)===target,"Workflow must advance exactly one stage; reload this version");
  let reportId:string|null=null;
  if(target==="source_verified") await sourceVerified(tx,v,m);
  if(target==="rules_normalized") await candidateDefinition(tx,v.id);
  if(target==="tests_passed") {
    const definition=await candidateDefinition(tx,v.id);
    const report=testReport(definition,analystCasesSchema.parse(v.analyst_test_cases) as AnalystCase[]);
    reportId=await persistReport(tx,actor,v,"test",report);
    // Refusal is a normal committed result so coverage evidence is never rolled back.
    if(!report.passed) return {ok:false,error:"Tests failed or mandatory criterion coverage is missing; see the persisted report",reportId};
  }
  if(target==="universe_tested") {
    const report=await impact(tx,v);reportId=await persistReport(tx,actor,v,"impact",report);
    if(!report.passed) return {ok:false,error:"Impact comparison is incomplete; see the persisted report",reportId};
  }
  if(target==="human_reviewed") requireGate(note.trim(),"A human reviewer note is required");
  let approval:Partial<typeof methodologyVersion.$inferInsert>={};
  if(target==="approved") {
    const [test]=await tx.select().from(methodologyVersionReport).where(eq(methodologyVersionReport.id,v.test_report_id??"00000000-0000-0000-0000-000000000000"));
    const [impact]=await tx.select().from(methodologyVersionReport).where(eq(methodologyVersionReport.id,v.impact_report_id??"00000000-0000-0000-0000-000000000000"));
    requireGate(test?.methodology_version_id===v.id && test.kind==="test" && test.payload.passed===true && impact?.methodology_version_id===v.id && impact.kind==="impact" && impact.payload.passed===true,"Same-version passing reports are required");
    requireGate(v.workflow_history.some(h=>h.to==="human_reviewed" && h.note?.trim()),"Recorded human review is required");
    const approvalId=randomUUID(),at=new Date();
    await audit(tx,actor,{id:approvalId,event_type:"approval_recorded",entity_name:"methodology_version",entity_id:v.id,summary:"Methodology version approved",details:{from:v.workflow_status,to:target,note}});
    approval={approval_id:approvalId,approved_by:actor.id,approved_at:at};
  } else {
    await audit(tx,actor,{event_type:"methodology_update",entity_name:"methodology_version",entity_id:v.id,summary:"Workflow transition",details:{from:v.workflow_status,to:target,note,reportId}});
  }
  await tx.update(methodologyVersion).set({...approval,workflow_status:target as typeof v.workflow_status,workflow_history:[...v.workflow_history,{from:v.workflow_status,to:target,actor:actor.id,at:new Date().toISOString(),note}],updated_at:new Date()}).where(eq(methodologyVersion.id,v.id));
  return {ok:true,reportId};
}
export async function enableProduction(tx:Tx,actor:AppUser,id:string,note:string) {
  await lock(tx);const v=await versionRow(tx,id);const m=await parentRow(tx,v.methodology_id);
  requireGate(!v.production_enabled,"Production is already enabled");
  requireGate(!v.is_demo && !m.is_demo && !v.production_blocked && !m.production_blocked && m.official_or_inspired!=="internal_example","Demo, internal example or permanently blocked provenance cannot be enabled");
  requireGate(v.workflow_status==="approved" && v.approved_by && v.approved_at && v.approval_id,"Approval is required");
  requireGate(!["internal","unknown"].includes(m.licensing_status),"Set an eligible licensing status");
  requirePublicProduction(v.is_public);
  await sourceVerified(tx,v,m);
  const definition=await candidateDefinition(tx,v.id);
  requireGate(testReport(definition,analystCasesSchema.parse(v.analyst_test_cases) as AnalystCase[]).passed,"All tests and mandatory analyst criterion coverage must pass");
  requireGate(typeof note==="string" && note.length<=20000,"Invalid production note");
  // D-97: approved remains the stored status; SQL retains every D-93 prerequisite.
  await tx.update(methodology).set({production_enabled:true}).where(eq(methodology.id,m.id));
  await tx.update(methodologyVersion).set({production_enabled:true,workflow_history:[...v.workflow_history,{from:"approved",to:"approved",operation:"production_enable",actor:actor.id,at:new Date().toISOString(),note}]}).where(eq(methodologyVersion.id,v.id));
  await audit(tx,actor,{event_type:"methodology_version_production_enable",entity_name:"methodology_version",entity_id:v.id,summary:"Production enabled; stored workflow remains approved",details:{note}});
}
export async function setVisibility(tx:Tx,actor:AppUser,id:string,isPublic:boolean) {
  await lock(tx);const v=await versionRow(tx,id);
  requireGate(typeof isPublic==="boolean","Invalid visibility");
  const [defaultSetting]=await tx.select({id:editorialSetting.id}).from(editorialSetting)
    .where(eq(editorialSetting.default_shariah_methodology_version_id,v.id)).limit(1);
  requireVisibilityChange(v.production_enabled,isPublic,!!defaultSetting);
  await tx.update(methodologyVersion).set({is_public:isPublic}).where(eq(methodologyVersion.id,v.id));
  await audit(tx,actor,{event_type:"methodology_update",entity_name:"methodology_version",entity_id:v.id,summary:"Public visibility changed",details:{before:v.is_public,after:isPublic}});
}
export { GovernanceError };
