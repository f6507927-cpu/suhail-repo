import { mkdir, writeFile } from "node:fs/promises";
import { cpus, totalmem } from "node:os";
import { performance } from "node:perf_hooks";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql, type SQL } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import { cliConnection } from "../scripts/db/connection";
import { applyMigrations } from "../scripts/db/migrate";
import { seedDatabase } from "../scripts/db/seed";
import { searchPublicStocks } from "../src/db/search-public";

vi.mock("server-only", () => ({}));

const sizes = [1_000, 10_000, 50_000, 100_000];
const repeats = 7;
const cases = [
  ["ticker-prefix", "S000"],
  ["ticker-exact-tail", "S100000"],
  ["english-prefix-common", "Cedar"],
  ["english-substring-common", "dar ind"],
  ["english-substring-rare", "needle orchard"],
  ["arabic-prefix-common", "أَفـاق"],
  ["arabic-substring-common", "فاق للصنا"],
  ["arabic-substring-rare", "مدرسة فتى"],
  ["english-no-match", "zz-no-match"],
  ["arabic-no-match", "زمردغيرموجود"],
  ["literal-wildcards", "%_\\"],
  ["normalized-empty", "ـّـ"],
] as const;

type Plan = {
  "Execution Time": number;
  "Planning Time": number;
  Plan: Record<string, unknown>;
};
const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];

it("benchmarks the unchanged public query on a fresh disposable PostgreSQL 17", async () => {
  // Only the existing loopback-only test connection is allowed. Refuse reused
  // databases BEFORE applying migrations or inserting anything.
  const client = cliConnection("DATABASE_URL_TEST");
  const output = "generated-artifacts/search-benchmark";
  const measurements: Record<string, unknown>[] = [];
  try {
    const [version] = await client`show server_version_num`;
    expect(Number(version.server_version_num)).toBeGreaterThanOrEqual(170000);
    expect(Number(version.server_version_num)).toBeLessThan(180000);
    const [existing] = await client`select count(*)::int n from pg_namespace
      where nspname in ('app', 'drizzle', 'auth')`;
    if (existing.n !== 0) throw new Error("Benchmark requires a fresh disposable database; restart db:test:up");
    await client`set client_min_messages = warning`;
    await applyMigrations(client);
    await seedDatabase(client);
    await mkdir(output, { recursive: true });
    const settings = await client`select name, setting, unit from pg_settings
      where name in ('server_version','shared_buffers','work_mem','effective_cache_size',
        'max_parallel_workers_per_gather','jit','lc_collate','lc_ctype')`;
    const metadata = {
      capturedAt: new Date().toISOString(),
      sizes, repeats, warmups: 1, settings,
      cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem(),
      fixture: "one company per security; 80% eligible; 3 synthetic runs per security; 50% Arabic names; no evidence rows",
      timing: "sequential warm-cache client calls, p95 nearest rank of 7; EXPLAIN separately (not a cold-cache or network SLA)",
    };
    let captured: SQL | undefined;
    let previous = 0;
    for (const size of sizes) {
      // Fixed UUIDs and bucket distribution make fixture composition repeatable.
      await client`insert into app.company(id, name, name_ar, is_demo)
        select md5('company-' || i)::uuid,
          case when i % 997 = 0 then 'Cedar needle orchard %_\\ '
            when i % 2 = 0 then 'Cedar Industries ' else 'Harbor Technology ' end || i,
          case when i % 997 = 0 then 'أَفـاق مدرسة فتى '
            when i % 2 = 0 then 'أَفـاق للصناعة ' else null end,
          i % 10 = 1
        from generate_series(${previous + 1}::int, ${size}::int) i`;
      await client`insert into app.security(id, company_id, ticker, slug,
          exchange_id, exchange_code, in_universe, listing_status, is_demo)
        select md5('security-' || i)::uuid, md5('company-' || i)::uuid,
          'S' || lpad(i::text, 6, '0'), 'bench-' || i,
          case when i % 2 = 0 then (select id from app.exchange where code='NASDAQ') end,
          'NYSE', i % 10 <> 2,
          case when i % 10 = 3 then 'delisted'::app.listing_status else 'listed'::app.listing_status end,
          i % 10 = 0
        from generate_series(${previous + 1}::int, ${size}::int) i`;
      // Deliberately synthetic minimal history, not real screening authority.
      await client`insert into app.screening_run(id, security_id, company_id,
          methodology_id, methodology_version_id, status, hash_payload, immutable_hash, generated_at)
        select md5('run-' || i || '-' || h)::uuid,
          md5('security-' || i)::uuid, md5('company-' || i)::uuid,
          v.methodology_id, v.id, 'requires_review', '{}'::jsonb,
          md5('run-' || i || '-' || h), '2026-01-01'::timestamptz + h * interval '1 day'
        from generate_series(${previous + 1}::int, ${size}::int) i
        cross join generate_series(1, 3) h
        cross join app.methodology_version v where v.methodology_name = 'Example Methodology A'`;
      for (const table of ["company", "security", "screening_run", "exchange", "methodology", "methodology_version", "editorial_setting"]) {
        await client.unsafe(`analyze app.${table}`);
      }
      previous = size;
      for (const mode of ["preview", "live"]) {
        vi.stubEnv("SITE_MODE", mode);
        await drizzle(client).transaction(async publicDb => {
          await publicDb.execute(sql`set local role suhail_public`);
          expect((await publicDb.execute(sql`select current_user role`))[0].role).toBe("suhail_public");
          // Use the transaction-bound connection for both search and EXPLAIN.
          const publicExecute = publicDb.execute.bind(publicDb);
          vi.spyOn(publicDb, "execute").mockImplementation(query => {
            if (typeof query !== "string") captured = query.getSQL();
            return publicExecute(query);
          });
          for (const [label, query] of cases) {
            const warm = await searchPublicStocks(query, publicDb);
            expect(warm.length).toBeLessThanOrEqual(10);
            const samples: number[] = [];
            for (let n = 0; n < repeats; n++) {
              const start = performance.now();
              const rows = await searchPublicStocks(query, publicDb);
              samples.push(performance.now() - start);
              expect(rows).toEqual(warm);
            }
            expect(captured).toBeDefined();
            const plans = await publicExecute(sql`explain (analyze, buffers, verbose, settings, format json) ${captured!}`);
            const plan = plans[0]["QUERY PLAN"] as Plan[];
            const measurement = {
              size, mode, label, query, rows: warm.length, samplesMs: samples,
              p50Ms: percentile(samples, 0.5), p95Ms: percentile(samples, 0.95),
              executionMs: plan[0]["Execution Time"], planningMs: plan[0]["Planning Time"],
            };
            measurements.push(measurement);
            await writeFile(`${output}/${size}-${mode}-${label}.json`, JSON.stringify(plan, null, 2) + "\n");
            console.log(`${size} ${mode} ${label}: p95 ${measurement.p95Ms.toFixed(1)} ms; rows ${warm.length}`);
          }
        });
      }
    }
    await writeFile(`${output}/summary.json`, JSON.stringify({ metadata, measurements }, null, 2) + "\n");
  } finally {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await client.end();
  }
}, 900_000);
