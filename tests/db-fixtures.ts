import type { Sql } from "postgres";
import { randomUUID } from "node:crypto";

export const tables = [
  "users",
  "analyst_profile",
  "audit_event",
  "exchange",
  "company",
  "security",
  "source",
  "financial_period",
  "financial_fact",
  "business_segment",
  "price_bar",
  "methodology",
  "methodology_version",
  "methodology_criterion",
  "methodology_version_report",
  "screening_run",
  "screening_criterion_result",
  "screening_unknown",
  "explanation_object",
  "edition",
  "pick",
  "editorial_approval",
  "edition_revision",
  "editorial_setting",
  "job_run",
  "unmet_search",
] as const;
export const appendOnly = [
  "screening_run",
  "screening_criterion_result",
  "screening_unknown",
  "explanation_object",
  "audit_event",
  "edition_revision",
  "editorial_approval",
  "methodology_version_report",
];
export const privateTables = [
  "users",
  "audit_event",
  "editorial_approval",
  "editorial_setting",
  "methodology_version_report",
  "job_run",
  "unmet_search",
];
export const publicTables = tables.filter(
  (table) => !privateTables.includes(table),
);

export async function fixtureRows(sql: Sql) {
  const user = randomUUID();
  await sql`insert into app.users (id,full_name) values (${user},'Fixture user')`;
  const profiles =
    await sql`insert into app.analyst_profile (name_ar,user_id,active,created_by) values ('Fixture',${user},true,${user}),('Inactive',null,false,null) returning id,active`;
  const src =
    await sql`insert into app.source (label,source_type,notes) select 'provenance-' || n,'internal','private note' from generate_series(1,12) n returning id`;
  const sources = src.map((row) => row.id as string);
  const companies =
    await sql`insert into app.company (name,created_by) values ('Public',${user}),('Outside',null),('Suspended',null) returning id,name`;
  const securities: string[] = [];
  const periods: string[] = [],
    facts: string[] = [],
    segments: string[] = [],
    prices: string[] = [];
  for (let n = 0; n < 3; n++) {
    const [sec] =
      await sql`insert into app.security (company_id,ticker,slug,in_universe,listing_status) values (${companies[n].id},${"F" + n},${"fixture-" + n},${n !== 1},${n === 2 ? "suspended" : "listed"}) returning id`;
    securities.push(sec.id);
    const [period] =
      await sql`insert into app.financial_period (company_id,fiscal_year,fiscal_period_label,is_latest,source_id) values (${companies[n].id},2026,'FY2026',true,${sources[n]}) returning id`;
    periods.push(period.id);
    const [fact] =
      await sql`insert into app.financial_fact (company_id,period_id,line_item,value,source_id,input_state) values (${companies[n].id},${period.id},'total_assets',100,${sources[n + 3]},'missing') returning id`;
    facts.push(fact.id);
    const [segment] =
      await sql`insert into app.business_segment (company_id,period_id,segment_name,source_id) values (${companies[n].id},${period.id},'Fixture',${sources[n + 6]}) returning id`;
    segments.push(segment.id);
    const [price] =
      await sql`insert into app.price_bar (security_id,date,close) values (${sec.id},'2026-01-01',10) returning id`;
    prices.push(price.id);
  }
  const [method] =
    await sql`insert into app.methodology (name,slug) values ('Private methodology','fixture-private') returning id`;
  const [privateVersion] =
    await sql`insert into app.methodology_version (methodology_id,version,is_public,source_ids) values (${method.id},'1.0',false,${sql.array([sources[11]])}::uuid[]) returning id`;
  const [publicVersion] =
    await sql`select id,methodology_id from app.methodology_version where version_label = 'EX-A v1.0'`;
  await sql`update app.methodology_version set source_ids = ${sql.array([sources[9]])}::uuid[],created_by=${user},approved_by=${user} where id = ${publicVersion.id}`;
  await sql`update app.methodology_criterion set created_by=${user} where methodology_version_id=${publicVersion.id}`;
  const [privateCriterion] =
    await sql`insert into app.methodology_criterion (methodology_version_id,criterion_type,label) values (${privateVersion.id},'business_activity','Private') returning id`;
  const runs: string[] = [],
    results: string[] = [],
    unknowns: string[] = [],
    explanations: string[] = [];
  for (const sec of securities) {
    for (const version of [publicVersion.id, privateVersion.id]) {
      const [run] =
        await sql`insert into app.screening_run (security_id,methodology_version_id,status,hash_payload,immutable_hash,created_by) values (${sec},${version},'requires_review','{}','fixture',${user}) returning id`;
      runs.push(run.id);
      const [result] =
        await sql`insert into app.screening_criterion_result (screening_run_id,criterion_type,result,source_ids,created_by) values (${run.id},'business_activity','unknown',${sql.array([sources[10]])}::uuid[],${user}) returning id`;
      results.push(result.id);
      const [unknown] =
        await sql`insert into app.screening_unknown (screening_run_id,field_or_input,created_by) values (${run.id},'business_segments',${user}) returning id`;
      unknowns.push(unknown.id);
      const [explanation] =
        await sql`insert into app.explanation_object (screening_run_id,created_by) values (${run.id},${user}) returning id`;
      explanations.push(explanation.id);
    }
  }
  const editions: string[] = [],
    picks: string[] = [],
    revisions: string[] = [];
  const [pickOnlySource] =
    await sql`insert into app.source (label,source_type) values ('pick-only','internal') returning id`;
  const [evidenceOnlySource] =
    await sql`insert into app.source (label,source_type) values ('evidence-only','internal') returning id`;
  const [draftOnlySource] =
    await sql`insert into app.source (label,source_type) values ('draft-pick-only','internal') returning id`;
  for (const [n, status] of [
    "draft",
    "published_live",
    "published_demo",
    "superseded",
  ].entries()) {
    const [ed] =
      await sql`insert into app.edition (edition_id,week_start,week_end,status,created_by,published_by,published_by_email) values (${"fixture-" + n},'2026-01-01','2026-01-07',${status},${user},${user},'internal@example.test') returning id`;
    editions.push(ed.id);
    const [pick] =
      await sql`insert into app.pick (edition_id,slot_key,security_id,editor_author_email,source_ids,editor_evidence) values (${ed.id},'fixture',${securities[0]},'internal@example.test',${sql.array([n === 0 ? draftOnlySource.id : pickOnlySource.id])}::uuid[],${JSON.stringify([{ claim_ar: "Fixture", source_id: evidenceOnlySource.id, value: 1 }])}::jsonb) returning id`;
    picks.push(pick.id);
    const [revision] =
      await sql`insert into app.edition_revision (edition_id,reason,created_by,created_by_email,picks_added) values (${ed.id},'Fixture',${user},'internal@example.test',${sql.array([pick.id])}::uuid[]) returning id`;
    revisions.push(revision.id);
  }
  const [audit] =
    await sql`insert into app.audit_event (event_type,summary,actor_id,created_by) values ('approval_recorded','Fixture',${user},${user}) returning id`;
  const [approval] =
    await sql`insert into app.editorial_approval (edition_id,approver_id,created_by) values (${editions[1]},${user},${user}) returning id`;
  const [report] =
    await sql`insert into app.methodology_version_report (methodology_version_id,kind,payload,author_id,created_by) values (${publicVersion.id},'impact','{}',${user},${user}) returning id`;
  const [job] =
    await sql`insert into app.job_run (job_name,status) values ('Fixture','fixture') returning id`;
  return {
    user,
    profiles,
    sources,
    companies,
    securities,
    periods,
    facts,
    segments,
    prices,
    privateMethodology: method.id as string,
    privateVersion: privateVersion.id as string,
    publicVersion: publicVersion.id as string,
    publicMethodology: publicVersion.methodology_id as string,
    privateCriterion: privateCriterion.id as string,
    runs,
    results,
    unknowns,
    explanations,
    editions,
    picks,
    revisions,
    pickOnlySource: pickOnlySource.id as string,
    evidenceOnlySource: evidenceOnlySource.id as string,
    draftOnlySource: draftOnlySource.id as string,
    audit: audit.id as string,
    approval: approval.id as string,
    report: report.id as string,
    job: job.id as string,
  };
}
