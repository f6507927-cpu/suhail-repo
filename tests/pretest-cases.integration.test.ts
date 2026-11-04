import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Sql, TransactionSql } from "postgres";
import { cliConnection } from "../scripts/db/connection";
import { testDatabaseUrl } from "../scripts/db/test-target";

// Only synthetic rows in a dedicated disposable loopback database. No live services.
let root: Sql, db: Sql;
const name = `pretest_fixture_${randomUUID().replaceAll("-", "")}`;
const first = { name: "Existing", inputs: { value: 1 }, expected: { result: "pass" } };
const second = { name: "Missing", inputs: { value: 2 }, expected: { result: "fail" } };
beforeAll(async () => {
  root = cliConnection("DATABASE_URL_TEST");
  await root.unsafe(`create database "${name}"`);
  const url = new URL(testDatabaseUrl()); url.pathname = `/${name}`;
  vi.stubEnv("DATABASE_URL_TEST", url.toString());
  try { db = cliConnection("DATABASE_URL_TEST"); } finally { vi.unstubAllEnvs(); }
  await db.unsafe(`create schema app;
    create table app.methodology_version (
      id integer primary key, workflow_status text not null, production_enabled boolean not null default false,
      analyst_test_cases jsonb not null default '[]', content text not null default 'unchanged',
      updated_at timestamptz not null default now()
    )`);
  await db.unsafe(readFileSync("drizzle/0014_pretest_analyst_cases.sql", "utf8"));
  await db.unsafe(`create trigger fixture_version_guard before update or delete on app.methodology_version
    for each row execute function app.guard_methodology_version()`);
});
afterAll(async () => {
  await db?.end();
  if (root) { await root.unsafe(`drop database if exists "${name}"`); await root.end(); }
});
async function fixture(stage: string, work: (tx: TransactionSql) => Promise<void>, enabled = false) {
  const rollback = new Error("fixture rollback");
  try {
    await db.begin(async tx => {
      await tx`insert into app.methodology_version (id,workflow_status,production_enabled,analyst_test_cases)
        values (1,${stage},${enabled},${JSON.stringify([first])}::text::jsonb)`;
      await work(tx); throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
}
async function write(tx: TransactionSql, cases: unknown[]) {
  return tx`update app.methodology_version set analyst_test_cases=${JSON.stringify(cases)}::text::jsonb where id=1`;
}
describe("D-156 migration trigger on synthetic local PostgreSQL fixtures", () => {
  it.each(["source_verified", "rules_normalized"])("allows append at %s without changing workflow/content", async stage => fixture(stage, async tx => {
    await write(tx, [first, second]);
    const [row] = await tx`select * from app.methodology_version where id=1`;
    expect(row).toMatchObject({ workflow_status: stage, content: "unchanged", analyst_test_cases: [first, second] });
  }));
  it.each(["tests_passed", "universe_tested", "human_reviewed", "approved", "production"])(
    "refuses append at %s", async stage => fixture(stage, async tx => {
      await expect(tx.savepoint(sub => write(sub, [first, second]))).rejects.toThrow("before tests_passed");
    }));
  it.each([
    { name: "edit", cases: [{ ...first, expected: { result: "fail" } }, second] },
    { name: "remove", cases: [] },
    { name: "reorder", cases: [second, first] },
    { name: "duplicate name", cases: [first, { ...second, name: first.name }] },
    { name: "renamed identical inputs/outcomes", cases: [first, { ...first, name: "Renamed" }] },
    { name: "duplicate appended rows", cases: [first, second, second] },
    { name: "malformed appended row", cases: [first, {}] },
  ])("refuses $name", async ({ cases }) => fixture("rules_normalized", async tx => {
    await expect(tx.savepoint(sub => write(sub, cases))).rejects.toThrow();
    expect((await tx`select analyst_test_cases from app.methodology_version where id=1`)[0].analyst_test_cases).toEqual([first]);
  }));
  it("cannot combine append with workflow advance or other content changes", async () => fixture("rules_normalized", async tx => {
    await expect(tx.savepoint(sub => sub`update app.methodology_version
      set analyst_test_cases=${JSON.stringify([first, second])}::text::jsonb, workflow_status='tests_passed' where id=1`))
      .rejects.toThrow("without other changes");
    await expect(tx.savepoint(sub => sub`update app.methodology_version
      set analyst_test_cases=${JSON.stringify([first, second])}::text::jsonb, content='edited' where id=1`))
      .rejects.toThrow("without other changes");
  }));
  it("still refuses returning to draft and non-case content edits", async () => fixture("rules_normalized", async tx => {
    await expect(tx.savepoint(sub => sub`update app.methodology_version set workflow_status='draft' where id=1`))
      .rejects.toThrow("cannot return to draft");
    await expect(tx.savepoint(sub => sub`update app.methodology_version set content='edited' where id=1`))
      .rejects.toThrow("content is immutable");
  }));
  it("refuses append for production-enabled rows", async () => fixture("rules_normalized", async tx => {
    await expect(tx.savepoint(sub => write(sub, [first, second]))).rejects.toThrow("before tests_passed");
  }, true));
});
