import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql as query } from "drizzle-orm";
import { cliConnection } from "../scripts/db/connection";
import { applyMigrations } from "../scripts/db/migrate";
import { seedDatabase } from "../scripts/db/seed";
import { criteriaFixtures } from "../scripts/db/fixtures";
import {
  fixtureRows,
  tables,
  appendOnly,
  privateTables,
  publicTables,
} from "./db-fixtures";
import * as schema from "../src/db/schema";
import type { Sql, TransactionSql } from "postgres";
vi.mock("server-only", () => ({}));
import {
  insertPick,
  insertEdition,
  insertEditionRevision,
  insertMethodologyVersion,
  insertScreeningCriterionResult,
  validateHistoricalReferences,
} from "../src/db/validate-references";

let sql: Sql;
let f: Awaited<ReturnType<typeof fixtureRows>>;
const rollback = new Error("intentional test rollback");
async function asRole<T>(
  role: "suhail_public" | "suhail_app" | "postgres",
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  let result: T;
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL ROLE ${role}`);
      result = await fn(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  return result!;
}
async function denied(tx: TransactionSql, statement: string) {
  await expect(
    tx.savepoint((sp) => sp.unsafe(statement)),
  ).rejects.toMatchObject({ code: "42501" });
}
async function rejects(tx: TransactionSql, statement: string, pattern: RegExp) {
  await expect(tx.savepoint((sp) => sp.unsafe(statement))).rejects.toThrow(
    pattern,
  );
}
async function asDrizzleApp(
  fn: (tx: PostgresJsDatabase<typeof schema>) => Promise<void>,
) {
  try {
    await drizzle(sql, { schema }).transaction(async (tx) => {
      await tx.execute(query`SET LOCAL ROLE suhail_app`);
      await fn(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}
beforeAll(async () => {
  sql = cliConnection("DATABASE_URL_TEST");
  const [version] = await sql`show server_version_num`;
  expect(Number(version.server_version_num)).toBeGreaterThanOrEqual(170000);
  expect(Number(version.server_version_num)).toBeLessThan(180000);
  // Explicitly refuse pre-existing application data. The test URL is never
  // replaced with runtime or migrations credentials.
  const [existing] =
    await sql`select count(*)::int n from information_schema.tables where table_schema = 'app'`;
  if (existing.n !== 0)
    throw new Error(
      "DATABASE_URL_TEST must be an empty disposable PostgreSQL 17 database",
    );
  await sql`set client_min_messages = warning`;
  await applyMigrations(sql);
  expect((await sql`select to_regclass('auth.users') name`)[0].name).toBeNull();
  await seedDatabase(sql);
  const counts = await sql`select
    (select count(*)::int from app.exchange) exchanges,
    (select count(*)::int from app.methodology) methodologies,
    (select count(*)::int from app.methodology_version) versions,
    (select count(*)::int from app.methodology_criterion) criteria,
    (select count(*)::int from app.editorial_setting) settings`;
  await seedDatabase(sql);
  expect(
    await sql`select
    (select count(*)::int from app.exchange) exchanges,
    (select count(*)::int from app.methodology) methodologies,
    (select count(*)::int from app.methodology_version) versions,
    (select count(*)::int from app.methodology_criterion) criteria,
    (select count(*)::int from app.editorial_setting) settings`,
  ).toEqual(counts);
  expect(counts[0]).toEqual({
    exchanges: 2,
    methodologies: 2,
    versions: 2,
    criteria: 10,
    settings: 1,
  });
  // Test-only Supabase stub: never created by migrations.
  await sql`create schema auth`;
  await sql`create table auth.users (id uuid primary key)`;
  f = await fixtureRows(sql);
});
afterAll(async () => {
  await sql?.end();
});

describe("D-17/D-92/D-93 SQL hardening", () => {
  it("refuses prerequisite writes from a stale snapshot isolation level", async () => {
    await asRole("postgres", async (tx) => {
      await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`;
      await rejects(
        tx,
        "update app.methodology set production_enabled=false",
        /require READ COMMITTED/,
      );
    });
  });
  it.each(appendOnly)(
    "refuses owner TRUNCATE %s, including CASCADE",
    async (table) => {
      await asRole("postgres", async (tx) => {
        await rejects(
          tx,
          `TRUNCATE app.${table} CASCADE`,
          /append-only table cannot be truncated/,
        );
        expect(
          (await tx.unsafe(`select count(*)::int n from app.${table}`))[0].n,
        ).toBeGreaterThanOrEqual(0);
      });
    },
  );
  it.each(["40", "-0.001", "1.000001", "NaN", "Infinity"])(
    "refuses non-fraction segment %s on insert/update",
    async (value) => {
      await asRole("postgres", async (tx) => {
        await rejects(
          tx,
          `insert into app.business_segment(company_id,segment_name,revenue_share) values ('${f.companies[0].id}','bad-share','${value}')`,
          /business_segment_share_fraction|numeric field overflow/,
        );
        await rejects(
          tx,
          `update app.business_segment set revenue_share='${value}'`,
          /business_segment_share_fraction|numeric field overflow/,
        );
      });
    },
  );
  it.each(["0", "0.333333", "1", null])(
    "allows valid or unknown persisted share %s",
    async (value) => {
      await asRole("postgres", async (tx) => {
        await tx`insert into app.business_segment(company_id,segment_name,revenue_share) values (${f.companies[0].id},'valid-share',${value})`;
      });
    },
  );
  it("EX-A/EX-B and demo versions cannot be enabled or relabelled", async () => {
    await asRole("postgres", async (tx) => {
      await rejects(
        tx,
        "update app.methodology set production_enabled=true where short_label in ('EX-A','EX-B')",
        /production methodology gate/,
      );
      await rejects(
        tx,
        "update app.methodology_version set production_enabled=true where is_demo",
        /production methodology gate/,
      );
      await tx`update app.methodology set is_demo=false,official_or_inspired='official',production_blocked=false where short_label='EX-A'`;
      expect(
        (
          await tx`select production_blocked from app.methodology where short_label='EX-A'`
        )[0].production_blocked,
      ).toBe(true);
      await rejects(
        tx,
        "update app.methodology set production_enabled=true where short_label='EX-A'",
        /production methodology gate/,
      );
      await rejects(
        tx,
        "insert into app.methodology(name,slug,official_or_inspired,production_enabled) values ('internal','hardening-internal','internal_example',true)",
        /production methodology gate/,
      );
      await rejects(
        tx,
        "insert into app.methodology(name,slug,official_or_inspired,production_enabled) values ('unverified','hardening-official','official',true)",
        /production methodology gate/,
      );
    });
  });
  it("requires a finalized populated version, then freezes rules and guards prerequisites", async () => {
    await asRole("postgres", async (tx) => {
      const m = randomUUID(),
        v = randomUUID(),
        source = randomUUID(),
        impact = randomUUID(),
        test = randomUUID(),
        approval = randomUUID(),
        approver = randomUUID(),
        criterion = randomUUID();
      await tx`insert into app.source(id,label,source_type,document_title,source_url,is_synthetic,is_demo)
        values (${source},'ISOLATED TEST ONLY','methodology_document','Synthetic eligibility test document','https://fixture.invalid/rules',false,false)`;
      await tx`insert into app.methodology(id,name,slug,official_or_inspired,source_title,source_url,verified_by,verification_date)
        values (${m},'ISOLATED TEST ONLY',${m},'official','Synthetic eligibility test document','https://fixture.invalid/rules','test fixture','2026-10-01')`;
      await tx`insert into app.methodology_version(id,methodology_id,version,version_label,effective_date,source_ids)
        values (${v},${m},'1','ISOLATED TEST ONLY','2026-01-01',ARRAY[${source}]::uuid[])`;
      await rejects(
        tx,
        `update app.methodology set production_enabled=true where id='${m}'`,
        /production methodology gate/,
      );
      await tx`insert into app.methodology_version_report(id,methodology_version_id,kind,payload)
        values (${impact},${v},'impact','{}'::jsonb),(${test},${v},'test','{}'::jsonb)`;
      await tx`insert into app.audit_event(id,event_type,entity_name,entity_id,actor_id,summary)
        values (${approval},'approval_recorded','methodology_version',${v},${approver},'ISOLATED TEST ONLY')`;
      await tx`update app.methodology_version set impact_report_id=${impact},test_report_id=${test},approval_id=${approval},approved_by=${approver},approved_at=now() where id=${v}`;
      // Approval metadata alone cannot promote an empty finalized version.
      await expect(
        tx.savepoint(async (sp) => {
          await sp`update app.methodology_version set workflow_status='approved' where id=${v}`;
          await sp`update app.methodology set production_enabled=true where id=${m}`;
        }),
      ).rejects.toThrow(/production methodology gate/);
      await tx`insert into app.methodology_criterion(id,methodology_version_id,criterion_type,label)
        values (${criterion},${v},'business_activity','ISOLATED TEST ONLY')`;
      // A populated draft remains mutable and therefore ineligible.
      await tx`update app.methodology_version set is_public=true where id=${v}`;
      await rejects(
        tx,
        `update app.methodology set production_enabled=true where id='${m}'`,
        /production methodology gate/,
      );
      await rejects(
        tx,
        `update app.methodology_version set production_enabled=true where id='${v}'`,
        /production methodology gate/,
      );
      await tx`update app.methodology_version set workflow_status='approved' where id=${v}`;
      // Approval freezes criteria before enabling, as well as while enabled.
      await rejects(
        tx,
        `update app.methodology_criterion set label='rewrite' where id='${criterion}'`,
        /non-draft methodology criteria are immutable/,
      );
      await tx`update app.methodology set production_enabled=true where id=${m}`;
      await tx`update app.methodology_version set production_enabled=true where id=${v}`;
      for (const statement of [
        `update app.methodology set source_url=null where id='${m}'`,
        `update app.methodology set verified_by='' where id='${m}'`,
        `update app.methodology set verification_date=null where id='${m}'`,
        `update app.methodology set production_enabled=false where id='${m}'`,
        `update app.methodology_version set test_report_id=null where id='${v}'`,
        `update app.methodology_version set impact_report_id=null where id='${v}'`,
        `update app.methodology_version set approval_id=null where id='${v}'`,
        `update app.methodology_version set approved_by=null where id='${v}'`,
        `update app.methodology_version set approved_by='${randomUUID()}' where id='${v}'`,
        `update app.methodology_version set workflow_status='rules_normalized' where id='${v}'`,
        `update app.source set is_synthetic=true where id='${source}'`,
        `update app.source set confidence_tier='Estimated' where id='${source}'`,
        `delete from app.source where id='${source}'`,
      ])
        await rejects(tx, statement, /production methodology gate/);
      // Same event type alone is insufficient: an approval for a different entity/version is refused.
      const wrong = randomUUID();
      await tx`insert into app.audit_event(id,event_type,entity_name,entity_id,summary)
        values (${wrong},'approval_recorded','methodology_version',${m},'ISOLATED TEST ONLY')`;
      await rejects(
        tx,
        `update app.methodology_version set approval_id='${wrong}' where id='${v}'`,
        /production methodology gate/,
      );
      await rejects(
        tx,
        `update app.methodology_version set test_report_id='${impact}' where id='${v}'`,
        /test report must belong to version/,
      );
      await rejects(
        tx,
        `update app.methodology_version set impact_report_id='${test}' where id='${v}'`,
        /impact report must belong to version/,
      );
      await tx`update app.methodology_version set workflow_status='approved' where id=${v}`;
      for (const statement of [
        `insert into app.methodology_criterion(methodology_version_id,criterion_type,label) values ('${v}','business_activity','rewrite')`,
        `update app.methodology_criterion set label='rewrite' where id='${criterion}'`,
        `delete from app.methodology_criterion where id='${criterion}'`,
      ])
        await rejects(
          tx,
          statement,
          /non-draft methodology criteria are immutable/,
        );
      await rejects(
        tx,
        "TRUNCATE app.methodology_criterion CASCADE",
        /non-draft methodology criteria are immutable|append-only table cannot be truncated/,
      );
      await rejects(
        tx,
        `update app.methodology_version set source_ids='{}' where id='${v}'`,
        /non-draft methodology content is immutable/,
      );
      await rejects(
        tx,
        `update app.methodology_version set changelog='rewrite' where id='${v}'`,
        /non-draft methodology content is immutable/,
      );
    });
  });
});

describe("schema and reference fixtures", () => {
  it("has exactly the registered app tables, all with RLS and safe roles/defaults", async () => {
    const rows =
      await sql`select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app' and c.relkind='r' order by relname`;
    expect(rows.map((r) => r.relname)).toEqual([...tables].sort());
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    const roles =
      await sql`select rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb from pg_roles where rolname in ('suhail_public','suhail_app')`;
    expect(roles).toHaveLength(2);
    for (const role of roles)
      expect(Object.values(role).slice(1)).toEqual([
        false,
        false,
        false,
        false,
        false,
      ]);
    expect(
      (
        await sql`select has_schema_privilege('suhail_public','app','CREATE') allowed`
      )[0].allowed,
    ).toBe(false);
    await asRole("postgres", async (tx) => {
      await tx`create table app.future_private (id int)`;
      await denied(
        tx,
        "SET LOCAL ROLE suhail_public; SELECT * FROM app.future_private",
      );
    });
    const [acl] =
      await sql`select nspacl::text acl from pg_namespace where nspname='app'`;
    expect(acl.acl).not.toMatch(/[,{]=/);
    for (const table of tables) {
      const [grants] = await sql`select
        has_table_privilege('suhail_app',${"app." + table},'SELECT') read,
        has_table_privilege('suhail_app',${"app." + table},'INSERT') insert,
        has_table_privilege('suhail_app',${"app." + table},'UPDATE') update,
        has_table_privilege('suhail_app',${"app." + table},'DELETE') delete`;
      expect(grants).toEqual({
        read: true,
        insert: table !== "unmet_search",
        update: table !== "unmet_search" && !appendOnly.includes(table),
        delete: table !== "unmet_search" && !appendOnly.includes(table),
      });
    }
  });
  it("seeds precise §8 demo criteria and real exchanges without changing existing rows", async () => {
    const exchanges =
      await sql`select code,mic,country,timezone,default_currency,regulator,is_demo from app.exchange order by code`;
    expect(exchanges).toEqual([
      {
        code: "NASDAQ",
        mic: "XNAS",
        country: "US",
        timezone: "America/New_York",
        default_currency: "USD",
        regulator: "SEC",
        is_demo: false,
      },
      {
        code: "NYSE",
        mic: "XNYS",
        country: "US",
        timezone: "America/New_York",
        default_currency: "USD",
        regulator: "SEC",
        is_demo: false,
      },
    ]);
    for (const example of ["A", "B"] as const) {
      const [v] =
        await sql`select * from app.methodology_version where version_label=${"EX-" + example + " v1.0"}`;
      expect(v).toMatchObject({
        workflow_status: "draft",
        is_public: true,
        is_demo: true,
        production_enabled: false,
      });
      const rows =
        await sql`select * from app.methodology_criterion where methodology_version_id=${v.id} order by sort_order`;
      const fixtures = criteriaFixtures(example);
      rows.forEach((row, n) => {
        for (const [key, value] of Object.entries(fixtures[n])) {
          expect(
            ["threshold", "borderline_margin"].includes(key) &&
              row[key] !== null
              ? Number(row[key])
              : row[key],
          ).toEqual(value);
        }
      });
      if (example === "A")
        expect(v.purification_treatment).toEqual({
          formula:
            "non-permissible revenue ÷ total revenue × dividend received",
          inputs: [
            "non_permissible_revenue",
            "total_revenue",
            "dividend_received",
          ],
          example_ratio: 0.03,
          confidence_tier: "Estimated",
          verified: false,
        });
      else expect(v.purification_treatment).toBeNull();
    }
    const before =
      await sql`select id,updated_at from app.methodology_criterion order by id`;
    await seedDatabase(sql);
    expect(
      await sql`select id,updated_at from app.methodology_criterion order by id`,
    ).toEqual(before);
    const [setting] = await sql`select * from app.editorial_setting`;
    expect(setting).toMatchObject({
      allow_ineligible_editor_pick: false,
      is_demo: false,
      default_shariah_methodology_version_id: f.publicVersion,
    });
  });
  it("keeps exact enums, precision, synthetic text and Phase 1 omissions", async () => {
    const columns =
      await sql`select table_name,column_name,data_type,numeric_precision,numeric_scale,udt_name from information_schema.columns where table_schema='app'`;
    for (const [table, column, precision] of [
      ["financial_fact", "value", 30],
      ["methodology_criterion", "threshold", 12],
      ["pick", "starting_price", 30],
    ]) {
      expect(
        columns.find((r) => r.table_name === table && r.column_name === column),
      ).toMatchObject({ numeric_precision: precision, numeric_scale: 6 });
    }
    expect(
      columns.find(
        (r) =>
          r.table_name === "screening_run" &&
          r.column_name === "financial_snapshot_id",
      )?.data_type,
    ).toBe("text");
    expect(
      columns.find(
        (r) => r.table_name === "edition" && r.column_name === "edition_id",
      )?.data_type,
    ).toBe("text");
    expect(
      columns.find(
        (r) => r.table_name === "pick" && r.column_name === "edition_id",
      )?.data_type,
    ).toBe("uuid");
    expect(
      columns
        .filter((r) => r.column_name === "source_ids")
        .every((r) => r.udt_name === "_uuid"),
    ).toBe(true);
    expect(
      columns.filter(
        (r) =>
          [
            "universe_snapshot_id",
            "universe_size",
            "eligible_count",
            "scored_count",
            "excluded_count",
            "score_model_version_id",
            "score_model_version_label",
            "ai_model",
          ].includes(r.column_name) && r.table_name === "edition",
      ),
    ).toEqual([]);
    expect(
      columns.filter(
        (r) =>
          [
            "why_selected",
            "total_score",
            "lens_score",
            "factor_breakdown",
            "score_model_version_label",
            "lens_key",
            "lens_description",
          ].includes(r.column_name) ||
          (r.table_name === "pick" && r.column_name.startsWith("research_")),
      ),
    ).toEqual([]);
    const states =
      await sql`select enumlabel from pg_enum join pg_type on pg_type.oid=enumtypid join pg_namespace n on n.oid=typnamespace where typname='input_state' and n.nspname='app' order by enumsortorder`;
    expect(states.map((r) => r.enumlabel)).toEqual([
      "reported",
      "derived",
      "estimated",
      "unknown",
      "missing",
    ]);
    const [fact] = await drizzle(sql, { schema })
      .select()
      .from(schema.financialFact);
    expect(typeof fact.value).toBe("number");
  });
  it("reapplies custom security migrations safely and preserves fixture rows", async () => {
    await asRole("postgres", async (tx) => {
      const before =
        await tx`select id,updated_at from app.methodology_criterion order by id`;
      for (const file of [
        "drizzle/0001_security.sql",
        "drizzle/0002_integrity.sql",
        "drizzle/0003_evidence_shape.sql",
      ]) {
        for (const statement of readFileSync(file, "utf8").split(
          "--> statement-breakpoint",
        ))
          await tx.unsafe(statement);
      }
      expect(
        await tx`select id,updated_at from app.methodology_criterion order by id`,
      ).toEqual(before);
      await tx`set local role suhail_public`;
      expect(await tx`select * from app.public_settings`).toEqual([
        { default_shariah_methodology_version_id: f.publicVersion },
      ]);
      await denied(tx, "select notes from app.source");
    });
  });
});

describe("public grants and row policies", () => {
  it.each(privateTables)("denies private table %s", async (table) => {
    await asRole("suhail_public", (tx) =>
      denied(tx, `select ${table === "unmet_search" ? "normalized_query" : "id"} from app.${table}`),
    );
  });
  it.each(publicTables)(
    "permits explicit id SELECT and denies public writes on %s",
    async (table) => {
      await asRole("suhail_public", async (tx) => {
        await tx.unsafe(`select id from app.${table}`);
        await denied(tx, `insert into app.${table} default values`);
        await denied(tx, `update app.${table} set is_demo=true`);
        await denied(tx, `delete from app.${table}`);
      });
    },
  );
  it.each(privateTables)("denies public inserts on %s too", async (table) => {
    await asRole("suhail_public", (tx) =>
      denied(tx, `insert into app.${table} default values`),
    );
  });
  it.each(tables)("application can SELECT %s", async (table) => {
    await asRole("suhail_app", async (tx) => {
      await tx.unsafe(`select * from app.${table}`);
    });
  });
  it("filters every public table through the correct parent(s)", async () => {
    const expected: Record<string, string[]> = {
      company: [f.companies[0].id],
      security: [f.securities[0]],
      financial_period: [f.periods[0]],
      financial_fact: [f.facts[0]],
      business_segment: [f.segments[0]],
      price_bar: [f.prices[0]],
      screening_run: [f.runs[0]],
      screening_criterion_result: [f.results[0]],
      screening_unknown: [f.unknowns[0]],
      explanation_object: [f.explanations[0]],
      edition: [f.editions[1], f.editions[2]],
      pick: [f.picks[1], f.picks[2]],
      edition_revision: [f.revisions[1], f.revisions[2]],
      analyst_profile: [f.profiles.find((p) => p.active)!.id],
    };
    await asRole("suhail_public", async (tx) => {
      for (const [table, ids] of Object.entries(expected)) {
        const rows = await tx.unsafe(`select id from app.${table}`);
        expect(rows.map((r) => r.id).sort(), table).toEqual([...ids].sort());
      }
      expect(
        (await tx`select id from app.methodology`).map((r) => r.id),
      ).not.toContain(f.privateMethodology);
      expect(
        (await tx`select id from app.methodology_version`).map((r) => r.id),
      ).not.toContain(f.privateVersion);
      expect(
        (await tx`select id from app.methodology_criterion`).map((r) => r.id),
      ).not.toContain(f.privateCriterion);
      expect(await tx`select id from app.exchange`).toHaveLength(2);
    });
  });
  it("reveals sources only through readable provenance, including evidence and public methodology", async () => {
    await asRole("suhail_public", async (tx) => {
      const rows = await tx`select id from app.source`;
      expect(rows.map((r) => r.id).sort()).toEqual(
        [
          f.sources[0],
          f.sources[3],
          f.sources[6],
          f.sources[9],
          f.sources[10],
          f.pickOnlySource,
          f.evidenceOnlySource,
        ].sort(),
      );
      await denied(tx, "select notes from app.source");
      await denied(tx, "select created_by from app.source");
      await denied(tx, "select * from app.source");
      await tx`select id,created_at,updated_at,is_demo,label,source_type,provider,document_title,document_reference,source_url,retrieved_at,reporting_period,confidence_tier,is_synthetic from app.source`;
    });
  });
  it("tests every email exclusion individually as the public role", async () => {
    const emails =
      await sql`select table_name,column_name from information_schema.columns where table_schema='app' and (column_name='email' or column_name like '%\\_email' escape '\\') order by table_name,column_name`;
    expect(emails.map((r) => `${r.table_name}.${r.column_name}`)).toEqual([
      "audit_event.actor_email",
      "edition.published_by_email",
      "edition_revision.created_by_email",
      "editorial_approval.approver_email",
      "editorial_setting.updated_by_email",
      "pick.editor_author_email",
      "users.email",
    ]);
    for (const email of emails)
      await asRole("suhail_public", (tx) =>
        denied(tx, `select ${email.column_name} from app.${email.table_name}`),
      );
  });
  it("exposes exactly one setting column despite direct table denial", async () => {
    const columns =
      await sql`select column_name from information_schema.columns where table_schema='app' and table_name='public_settings'`;
    expect(columns.map((r) => r.column_name)).toEqual([
      "default_shariah_methodology_version_id",
    ]);
    expect(
      (
        await sql`select reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app' and c.relname='public_settings'`
      )[0].reloptions,
    ).toContain("security_barrier=true");
    await asRole("suhail_public", async (tx) => {
      expect(await tx`select * from app.public_settings`).toEqual([
        { default_shariah_methodology_version_id: f.publicVersion },
      ]);
      await denied(
        tx,
        "select default_shariah_methodology_version_id from app.editorial_setting",
      );
    });
  });
});

describe("immutability and relational integrity", () => {
  it.each(appendOnly)(
    "denies app mutation and owner trigger escape for %s",
    async (table) => {
      await asRole("suhail_app", async (tx) => {
        await denied(tx, `update app.${table} set is_demo=true`);
        await denied(tx, `delete from app.${table}`);
      });
      await asRole("postgres", async (tx) => {
        await rejects(
          tx,
          `update app.${table} set is_demo=true`,
          /append-only/,
        );
        await rejects(tx, `delete from app.${table}`, /append-only/);
      });
    },
  );
  it("locks non-draft content and all criteria mutations, allowing only version metadata", async () => {
    await asRole("suhail_app", async (tx) => {
      await tx`update app.methodology_version set workflow_status='source_verified' where id=${f.publicVersion}`;
      const [criterion] =
        await tx`select id from app.methodology_criterion where methodology_version_id=${f.publicVersion} limit 1`;
      for (const operation of [
        `update app.methodology_criterion set threshold=1 where id='${criterion.id}'`,
        `delete from app.methodology_criterion where id='${criterion.id}'`,
        `insert into app.methodology_criterion (methodology_version_id,criterion_type,label) values ('${f.publicVersion}','business_activity','X')`,
        `update app.methodology_criterion set methodology_version_id='${f.privateVersion}' where id='${criterion.id}'`,
      ])
        await rejects(tx, operation, /criteria are immutable/);
      const [privateCriterion] =
        await tx`select id from app.methodology_criterion where methodology_version_id=${f.privateVersion}`;
      await rejects(
        tx,
        `update app.methodology_criterion set methodology_version_id='${f.publicVersion}' where id='${privateCriterion.id}'`,
        /criteria are immutable/,
      );
      for (const field of [
        "version",
        "version_label",
        "methodology_name",
        "notes",
        "created_by_name",
      ]) {
        await rejects(
          tx,
          `update app.methodology_version set ${field}='Changed' where id='${f.publicVersion}'`,
          /content is immutable/,
        );
      }
      await rejects(
        tx,
        `update app.methodology_version set source_ids='{}' where id='${f.publicVersion}'`,
        /content is immutable/,
      );
      await rejects(
        tx,
        `delete from app.methodology_version where id='${f.publicVersion}'`,
        /immutable/,
      );
      await rejects(
        tx,
        `update app.methodology_version set workflow_status='draft' where id='${f.publicVersion}'`,
        /return to draft/,
      );
      const [testReport] =
        await tx`insert into app.methodology_version_report (methodology_version_id,kind,payload) values (${f.publicVersion},'test','{}') returning id`;
      // Visibility remains editable only after this version is no longer default.
      await tx`update app.editorial_setting set default_shariah_methodology_version_id=null where default_shariah_methodology_version_id=${f.publicVersion}`;
      await tx`update app.methodology_version set workflow_status='rules_normalized',workflow_history='[]',is_public=false,impact_report_id=${f.report},test_report_id=${testReport.id},approval_id=${f.audit},approved_by=${f.user},approved_at=now(),updated_at=now() where id=${f.publicVersion}`;
      const [v] =
        await tx`select * from app.methodology_version where id=${f.publicVersion}`;
      expect(v).toMatchObject({
        workflow_status: "rules_normalized",
        approval_id: f.audit,
        approved_by: f.user,
        is_public: false,
      });
    });
  });
  it("checks approval type, report linkage, FKs, unique indexes and editor Arabic fields", async () => {
    await asRole("suhail_app", async (tx) => {
      const [audit] =
        await tx`insert into app.audit_event (event_type,summary) values ('data_ingest','Fixture') returning id`;
      await rejects(
        tx,
        `update app.methodology_version set approval_id='${audit.id}' where id='${f.publicVersion}'`,
        /approval_recorded/,
      );
      await rejects(
        tx,
        `update app.methodology_version set test_report_id='${f.report}' where id='${f.publicVersion}'`,
        /test report/,
      );
      const violations = [
        `insert into app.security (ticker,slug,company_id) values ('X','bad-fk','${randomUUID()}')`,
        "insert into app.exchange (code,name) values ('NASDAQ','Duplicate')",
        `insert into app.methodology_version (methodology_id,version) values ('${f.publicMethodology}','1.0')`,
        `insert into app.financial_period (company_id,fiscal_year,fiscal_period_label) values ('${f.companies[0].id}',2026,'FY2026')`,
        `insert into app.financial_period (company_id,fiscal_year,fiscal_period_label,is_latest) values ('${f.companies[0].id}',2025,'Other',true)`,
        `insert into app.financial_fact (company_id,period_id,line_item) values ('${f.companies[0].id}','${f.periods[0]}','total_assets')`,
        `insert into app.edition (edition_id,revision_number,week_start,week_end) values ('fixture-0',1,'2026-01-01','2026-01-07')`,
        `insert into app.pick (edition_id,security_id,slot_key,pick_type) values ('${f.editions[0]}','${f.securities[0]}','editor','editor')`,
      ];
      for (const statement of violations)
        await expect(
          tx.savepoint((sp) => sp.unsafe(statement)),
        ).rejects.toMatchObject({
          code: expect.stringMatching(/^235(?:03|05|14)$/),
        });
      const [ex] = await tx`select id from app.exchange limit 1`;
      await tx`insert into app.security (ticker,slug,exchange_id) values ('UNIQUE','unique-1',${ex.id})`;
      await rejects(
        tx,
        `insert into app.security (ticker,slug,exchange_id) values ('UNIQUE','unique-2','${ex.id}')`,
        /unique/,
      );
      // Historical superseded facts remain possible.
      await tx`insert into app.financial_fact (company_id,period_id,line_item,is_current) values (${f.companies[0].id},${f.periods[0]},'total_assets',false)`;
    });
    await asDrizzleApp(async (db) => {
      const editor = {
        edition_id: f.editions[0],
        security_id: f.securities[0],
        slot_key: "editor",
        pick_type: "editor" as const,
        editor_thesis_ar: "Fixture",
        editor_why_now_ar: "Fixture",
        editor_valuation_context_ar: "Fixture",
        editor_conflict_disclosure_ar: "Fixture",
        risks_ar: ["Fixture"],
      };
      await db.insert(schema.pick).values(editor);
      for (const key of [
        "editor_thesis_ar",
        "editor_why_now_ar",
        "editor_valuation_context_ar",
        "editor_conflict_disclosure_ar",
        "risks_ar",
      ]) {
        await expect(
          db.transaction(async (sp) =>
            sp.insert(schema.pick).values({ ...editor, [key]: null }),
          ),
        ).rejects.toMatchObject({
          cause: expect.objectContaining({
            constraint_name: "pick_editor_ar_required",
          }),
        });
      }
    });
  });
  it("updates timestamps on mutable records, but never immutable rows", async () => {
    await asRole("suhail_app", async (tx) => {
      await tx`update app.company set updated_at='2000-01-01' where id=${f.companies[0].id}`;
      expect(
        new Date(
          (
            await tx`select updated_at from app.company where id=${f.companies[0].id}`
          )[0].updated_at,
        ).getUTCFullYear(),
      ).toBeGreaterThan(2000);
    });
    const triggers =
      await sql`select event_object_table from information_schema.triggers where trigger_schema='app' and trigger_name='touch_updated_at'`;
    expect(
      [...new Set(triggers.map((r) => r.event_object_table))].sort(),
    ).toEqual(tables.filter((t) => t !== "unmet_search" && !appendOnly.includes(t)).sort());
  });
  it("enforces bilingual evidence structure for direct SQL writers", async () => {
    await asRole("suhail_app", async (tx) => {
      for (const invalid of [
        {},
        [{}],
        [{ claim_ar: "Fixture", source_id: "not-uuid", value: 1 }],
        [{ claim_ar: 1, source_id: f.sources[0], value: 1 }],
        [
          {
            claim_ar: "Fixture",
            claim_en: 1,
            source_id: f.sources[0],
            value: 1,
          },
        ],
      ]) {
        await expect(
          tx.savepoint(
            (sp) =>
              sp`update app.pick set editor_evidence=${JSON.stringify(invalid)}::jsonb where id=${f.picks[0]}`,
          ),
        ).rejects.toThrow(/editor evidence/);
      }
      await tx`update app.pick set editor_evidence=${JSON.stringify([{ claim_ar: "Fixture", claim_en: null, source_id: f.sources[0], value: null }])}::jsonb where id=${f.picks[0]}`;
    });
  });
});

describe("application historical reference insertion", () => {
  it("checks all ID arrays and bilingual evidence, rejecting absent IDs before insert", async () => {
    await asDrizzleApp(async (db) => {
      for (const key of [
        "source_ids",
        "picks_added",
        "picks_changed",
        "picks_retained",
      ] as const) {
        await expect(
          validateHistoricalReferences(db, { [key]: [randomUUID()] }),
        ).rejects.toThrow(/Missing historical/);
      }
      await expect(
        validateHistoricalReferences(db, {
          editor_evidence: [
            { claim_ar: "Fixture", source_id: randomUUID(), value: 1 },
          ],
        }),
      ).rejects.toThrow(/Missing historical source/);
      await validateHistoricalReferences(db, {
        source_ids: [f.sources[0]],
        picks_added: [f.picks[0]],
        picks_changed: [f.picks[1]],
        picks_retained: [f.picks[2]],
        editor_evidence: [
          {
            claim_ar: "Fixture",
            claim_en: "Fixture",
            source_id: f.sources[1],
            value: null,
          },
        ],
      });
      await validateHistoricalReferences(db, {
        source_ids: [f.sources[0].toUpperCase()],
        picks_added: [f.picks[0].toUpperCase()],
      });
      for (const operation of [
        () =>
          insertPick(db, {
            edition_id: f.editions[0],
            security_id: f.securities[0],
            slot_key: "validation",
            source_ids: [randomUUID()],
          }),
        () =>
          insertEdition(db, {
            edition_id: "validation",
            week_start: "2026-01-01",
            week_end: "2026-01-07",
            source_ids: [randomUUID()],
          }),
        () =>
          insertEditionRevision(db, {
            edition_id: f.editions[0],
            reason: "Fixture",
            picks_added: [randomUUID()],
          }),
        () =>
          insertEditionRevision(db, {
            edition_id: f.editions[0],
            reason: "Fixture",
            picks_changed: [randomUUID()],
          }),
        () =>
          insertEditionRevision(db, {
            edition_id: f.editions[0],
            reason: "Fixture",
            picks_retained: [randomUUID()],
          }),
        () =>
          insertMethodologyVersion(db, {
            methodology_id: f.publicMethodology,
            version: "validation",
            source_ids: [randomUUID()],
          }),
        () =>
          insertScreeningCriterionResult(db, {
            screening_run_id: f.runs[0],
            criterion_type: "business_activity",
            result: "unknown",
            source_ids: [randomUUID()],
          }),
        () =>
          insertPick(db, {
            edition_id: f.editions[0],
            security_id: f.securities[0],
            slot_key: "validation",
            editor_evidence: [
              { claim_ar: "Fixture", source_id: randomUUID(), value: 1 },
            ],
          }),
      ])
        await expect(operation()).rejects.toThrow(/Missing historical/);
      const [inserted] = await insertPick(db, {
        edition_id: f.editions[0],
        security_id: f.securities[0],
        slot_key: "validated",
        source_ids: [f.sources[0]],
        editor_evidence: [
          {
            claim_ar: "Fixture",
            claim_en: "Fixture",
            source_id: f.sources[1],
            value: 1,
          },
        ],
      });
      expect(inserted).toHaveProperty("id");
    });
  });
});

describe("account deletion, privacy and historical preservation", () => {
  it("owns a safely configured, application-only deletion function", async () => {
    const [fn] =
      await sql`select pg_get_userbyid(proowner) owner,prosecdef,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and proname='delete_own_account'`;
    expect(fn).toMatchObject({
      owner: "postgres",
      prosecdef: true,
      proconfig: ['search_path=""'],
    });
    await asRole("suhail_public", (tx) =>
      denied(tx, `select app.delete_own_account('${f.user}')`),
    );
    const [allowed] =
      await sql`select has_function_privilege('suhail_app','app.delete_own_account(uuid)','EXECUTE') yes`;
    expect(allowed.yes).toBe(true);
  });
  it("deletes auth/app users and NULLs mutable references without touching any historical row", async () => {
    await asRole("suhail_app", async (tx) => {
      // Setup stub as owner; app intentionally has no auth-table permissions.
      await tx`set local role postgres`;
      await tx`insert into auth.users (id) values (${f.user})`;
      await tx`update app.methodology_version set workflow_status='source_verified' where id=${f.publicVersion}`;
      const snapshots: Record<string, unknown> = {};
      for (const table of [
        ...appendOnly,
        "methodology_version",
        "methodology_criterion",
      ]) {
        snapshots[table] = await tx.unsafe(
          `select * from app.${table} order by id`,
        );
      }
      await tx`set local role suhail_app`;
      await tx`select app.delete_own_account(${f.user})`;
      expect(
        await tx`select id from app.users where id=${f.user}`,
      ).toHaveLength(0);
      expect(
        (
          await tx`select created_by from app.company where id=${f.companies[0].id}`
        )[0].created_by,
      ).toBeNull();
      expect(
        (
          await tx`select created_by,published_by from app.edition where id=${f.editions[1]}`
        )[0],
      ).toEqual({ created_by: null, published_by: null });
      expect(
        (
          await tx`select user_id,created_by from app.analyst_profile where id=${f.profiles.find((p) => p.active)!.id}`
        )[0],
      ).toEqual({ user_id: null, created_by: null });
      for (const table of [
        ...appendOnly,
        "methodology_version",
        "methodology_criterion",
      ]) {
        const rows = await tx.unsafe(
          `select * from app.${table} ${table === "audit_event" ? "where event_type <> 'user_account_deleted'" : ""} order by id`,
        );
        expect(rows, table).toEqual(snapshots[table]);
      }
      const [event] =
        await tx`select * from app.audit_event where event_type='user_account_deleted'`;
      expect(event).toMatchObject({
        entity_id: f.user,
        actor_id: f.user,
        actor_email: null,
        details: null,
        summary: "user_account_deleted",
      });
      await tx`set local role postgres`;
      expect(
        await tx`select id from auth.users where id=${f.user}`,
      ).toHaveLength(0);
    });
  });
  it("rejects admin deletion and works if auth schema is absent", async () => {
    await asRole("suhail_app", async (tx) => {
      await tx`update app.users set role='admin' where id=${f.user}`;
      await rejects(
        tx,
        `select app.delete_own_account('${f.user}')`,
        /demoted/,
      );
      await tx`update app.users set role='user' where id=${f.user}`;
      await tx`set local role postgres`;
      await tx`alter schema auth rename to test_auth_hidden`;
      await tx`set local role suhail_app`;
      await tx`select app.delete_own_account(${f.user})`;
      expect(
        await tx`select id from app.users where id=${f.user}`,
      ).toHaveLength(0);
    });
  });
  it.each(["user_registered", "consent_recorded", "user_account_deleted"])(
    "enforces user-ID-only privacy for %s",
    async (event) => {
      await asRole("suhail_app", async (tx) => {
        await tx`insert into app.audit_event (event_type,entity_name,entity_id,summary,actor_id) values (${event},'users',${f.user},${event},${f.user})`;
        for (const extra of ["actor_email", "summary", "details"]) {
          const statement =
            extra === "details"
              ? `insert into app.audit_event (event_type,entity_name,entity_id,summary,details) values ('${event}','users','${f.user}','${event}','{"email":"private@example.test"}')`
              : `insert into app.audit_event (event_type,entity_name,entity_id,summary${extra === "actor_email" ? ",actor_email" : ""}) values ('${event}','users','${f.user}',${extra === "summary" ? "'private@example.test'" : `'${event}','private@example.test'`})`;
          await rejects(tx, statement, /user ID only/);
        }
      });
    },
  );
  it("has no immutable user FKs and documents each historical identity", async () => {
    const fkRows =
      await sql`select conrelid::regclass::text table_name from pg_constraint where contype='f' and confrelid='app.users'::regclass`;
    expect(
      fkRows.every(
        (r) =>
          ![
            ...appendOnly,
            "methodology_version",
            "methodology_criterion",
          ].includes(r.table_name.replace("app.", "")),
      ),
    ).toBe(true);
    const historical =
      await sql`select c.relname,a.attname,col_description(c.oid,a.attnum) comment from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='app' and a.attname in ('created_by','actor_id','approver_id','approved_by','author_id') and a.attnum>0`;
    for (const row of historical.filter((r) =>
      [...appendOnly, "methodology_version", "methodology_criterion"].includes(
        r.relname,
      ),
    ))
      expect(row.comment).toContain("D-50");
    for (const file of [
      "drizzle/0000_fat_human_torch.sql",
      "drizzle/0001_security.sql",
      "drizzle/0002_integrity.sql",
    ])
      expect(readFileSync(file, "utf8")).not.toMatch(
        /CREATE (SCHEMA auth|TABLE auth\.users)|PASSWORD\s+'/i,
      );
  });
});
