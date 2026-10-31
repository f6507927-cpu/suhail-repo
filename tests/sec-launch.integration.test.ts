import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { Sql } from "postgres";
import { cliConnection } from "../scripts/db/connection";
import { applyMigrations } from "../scripts/db/migrate";
import * as schema from "../src/db/schema";
import { company, financialFact, security } from "../src/db/schema/market";
import { addSecurity, mutateFinancial } from "../src/lib/financial/service";
import { persistAnnual } from "../src/lib/financial/persistence";
import { ingestSecurity, type Mutation } from "../src/ingest/sec/ingest";
import { SecClient } from "../src/ingest/sec/client";
import { mapAnnual } from "../src/ingest/sec/annual";
import type { Fixture } from "../src/ingest/sec/types";
import type { Tx } from "../src/lib/auth/audit";
import { applyLaunchEvidence, launchTickerReport } from "../src/lib/launch/evidence";
import { launchInputs } from "../src/lib/launch/contracts";
vi.mock("server-only", () => ({}));
vi.mock("../src/env/sec", () => ({ getSecEnv: () => ({ SEC_USER_AGENT: "Offline regression contact@example.test" }) }));
let active: Tx | undefined;
vi.mock("../src/db/app", () => ({
  dbApp: new Proxy({}, {
    get(_target, property) {
      if (!active) throw new Error("Disposable transaction is required; no external database fallback");
      const value = Reflect.get(active, property);
      return typeof value === "function" ? value.bind(active) : value;
    },
  }),
}));
const tickers = ["AAPL", "MSFT", "AVGO", "CSCO", "QCOM", "NFLX", "COST", "HD", "AMD", "TXN", "PEP", "LLY", "ORCL", "JNJ", "XOM"];
let connection: Sql;
const rollback = new Error("rollback disposable issuer regression");
beforeAll(async () => {
  connection = cliConnection("DATABASE_URL_TEST"); // strictly loopback, never Supabase
  await applyMigrations(connection);
});
afterAll(async () => { await connection?.end(); });
describe("captured launch issuers through actual ingestion/persistence", () => {
  it.each(tickers)("%s imports twice without duplicates and retains analyst correction across .4 → .6", async ticker => {
    const fixture: Fixture = JSON.parse(readFileSync(`tests/fixtures/sec/launch/${ticker}.json`, "utf8"));
    const before: ReturnType<typeof mapAnnual> = JSON.parse(readFileSync(`tests/fixtures/sec/launch/${ticker}-before.json`, "utf8"));
    const transport = vi.fn(async () => new Response(JSON.stringify(fixture.companyfacts), { status: 200 }));
    const client = new SecClient({ fetcher: transport });
    try {
      await drizzle(connection, { schema }).transaction(async tx => {
        await tx.execute(sql`set local role suhail_app`);
        active = tx;
        const mutate: Mutation = work => work(tx, null);
        const id = await addSecurity(tx, null, { ticker, cik: String(fixture.companyfacts.cik).padStart(10, "0"),
          name: fixture.companyfacts.entityName, exchange: "NYSE", sector: "", fiscalYearEnd: "" });
        const [s] = await tx.select().from(security).where(eq(security.id, id));
        await persistAnnual(tx, null, s.company_id!, before);
        const line = ["ORCL", "JNJ"].includes(ticker) ? "interest_bearing_debt" : "prohibited_income";
        const [original] = await tx.select().from(financialFact).where(and(
          eq(financialFact.company_id, s.company_id!), eq(financialFact.line_item, line), eq(financialFact.is_current, true)));
        const corrected = await mutateFinancial(tx, null, { operation: "override", securityId: id, data: {
          factId: original.id, value: "123", input_state: "estimated", confidence_tier: "Estimated",
          periodId: original.period_id, period_start: before.period.period_start, period_end: before.period.period_end,
          reason: "Disposable local correction-protection assertion",
          source: { label: "Synthetic local analyst evidence", source_type: "internal" },
        } });
        const first = await ingestSecurity(id, mutate, client);
        expect(first.inserted).toBeGreaterThan(0);
        expect(first.retained).toBe(1);
        const allBeforeRepeat = await tx.select().from(financialFact);
        expect(await ingestSecurity(id, mutate, client)).toMatchObject({ inserted: 0, promoted: 0 });
        expect(await tx.select().from(financialFact)).toHaveLength(allBeforeRepeat.length);
        const [current] = await tx.select().from(financialFact).where(and(
          eq(financialFact.company_id, s.company_id!), eq(financialFact.line_item, line), eq(financialFact.is_current, true)));
        expect(current).toMatchObject({ id: corrected, value: 123, protected_current: true });
        const incoming = allBeforeRepeat.find(f => f.line_item === line && f.calculation_version === "calc-2026.10.6");
        expect(incoming).toMatchObject({ is_current: false, origin: "sec" });
        expect((await tx.select().from(security).where(eq(security.id, id)))[0].last_ingest_error).toBeNull();
        expect(transport).toHaveBeenCalledTimes(2);
        if (ticker === "XOM") {
          // This is a synthetic local launch-evidence assertion, NOT the
          // founder's missing original row or a real price attestation.
          const rows = launchInputs(readFileSync("tests/fixtures/launch/inputs-filled.csv", "utf8"),
            readFileSync("data/launch/universe.csv", "utf8"));
          const row = rows.find(r => r.ticker === "XOM")!;
          await applyLaunchEvidence(tx, null, id, row);
          const report = await launchTickerReport(tx, id, row, "2026-10-22");
          expect(report.closes.every(c => c.close !== null)).toBe(true);
          expect(report.missing).not.toContain("business_segments");
          expect(report.prohibited_income.value).toBe(123); // Protected correction retained.
        }
        expect((await tx.select().from(company).where(eq(company.id, s.company_id!)))[0].cik).toBe(String(fixture.companyfacts.cik).padStart(10, "0"));
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
    finally { active = undefined; }
  });
});
