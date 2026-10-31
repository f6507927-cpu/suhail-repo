import "server-only";
import { eq } from "drizzle-orm";
import { SecClient } from "./client";
import { mapAnnual } from "./annual";
import { dbApp } from "../../db/app";
import { company, security } from "../../db/schema/market";
import { audit, type Tx } from "../../lib/auth/audit";
import { persistAnnual, requireFinancial, type Actor } from "../../lib/financial/persistence";
import type { SecurityLookup } from "../../lib/financial/contracts";

export type Mutation = <T>(work: (tx: Tx, actor: Actor) => Promise<T>) => Promise<T>;
export const jobMutation: Mutation = work => dbApp.transaction(tx => work(tx, null));
export const secClient = new SecClient();
// D-118: one in-process ingest at a time; no distributed execution claim.
let queue: Promise<unknown> = Promise.resolve();
export function serialIngest<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.catch(() => undefined);
  return result;
}
export async function lookupSecurity(ticker: string, client = secClient): Promise<SecurityLookup> {
  const symbol = ticker.trim().toUpperCase();
  requireFinancial(/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(symbol), "Enter a valid ticker");
  const response = await client.tickers();
  const rows = response.data.data.map(row => Object.fromEntries(response.data.fields.map((key, i) => [key, row[i]])));
  const row = rows.find(r => String(r.ticker).toUpperCase() === symbol);
  requireFinancial(row, "Ticker was not found in SEC exchange listings");
  const exchange = String(row.exchange).toUpperCase();
  requireFinancial(exchange === "NASDAQ" || exchange === "NYSE", "Only Nasdaq and NYSE securities are supported");
  requireFinancial(/^\d{1,10}$/.test(String(row.cik)), "SEC issuer identity is invalid");
  const cik = String(row.cik).padStart(10, "0");
  const { data } = await client.submissions(cik);
  return { ticker: symbol, cik, name: String(row.name), exchange,
    sector: data.sicDescription ?? "", fiscalYearEnd: data.fiscalYearEnd ?? "" };
}
export function safeIngestError(error: unknown) {
  // Never send database/connection errors, URLs containing credentials, or raw SEC bodies.
  return error instanceof Error && error.name === "SecRequestError"
    ? error.message : "SEC ingestion failed; review the configuration and retry";
}
export function ingestSecurity(id: string, mutate: Mutation = jobMutation, client = secClient) {
  return serialIngest(async () => {
    const [s] = await dbApp.select().from(security).where(eq(security.id, id));
    requireFinancial(s?.company_id, "Security not found");
    const [c] = await dbApp.select().from(company).where(eq(company.id, s.company_id));
    requireFinancial(c?.cik, "SEC issuer identity is missing");
    try {
      // No admin-role transaction is held during SEC timeouts/backoff.
      const downloaded = await client.companyfacts(c.cik);
      const mapped = mapAnnual(downloaded.data, downloaded.retrieval);
      return await mutate(async (tx, actor) => {
        const result = await persistAnnual(tx, actor, c.id, mapped);
        await tx.update(security).set({ last_ingest_at: new Date(), last_ingest_error: null })
          .where(eq(security.company_id, c.id));
        if (result.inserted || result.promoted) await audit(tx, actor, { event_type: "data_ingest", entity_name: "security", entity_id: id,
          summary: "SEC ingestion completed", details: result });
        return result;
      });
    } catch (error) {
      const message = safeIngestError(error);
      await mutate(async (tx, actor) => {
        await tx.update(security).set({ last_ingest_error: message }).where(eq(security.id, id));
        await audit(tx, actor, { event_type: "data_ingest", entity_name: "security", entity_id: id,
          summary: "SEC ingestion failed; retry available", details: { error: message } });
      });
      throw error;
    }
  });
}
