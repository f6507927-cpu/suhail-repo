import type * as market from "../../db/schema/market";
import type { analystProfile, jobRun } from "../../db/schema/accounts";

export type FinancialCommand = {
  operation: "lookup" | "add" | "ingest" | "override" | "confirm" | "accept" |
    "segment" | "deleteSegment" | "price" | "addProhibitedIncome" | "coverage" | "company" | "remove" | "runJob" | "resumeJob";
  securityId?: string;
  data?: Record<string, unknown>;
};
export type SecurityLookup = {
  ticker: string; cik: string; name: string; exchange: "NASDAQ" | "NYSE";
  sector: string; fiscalYearEnd: string;
};
export type FinancialResult = { ok: true; id?: string; lookup?: SecurityLookup } | { ok: false; error: string };
export type FinancialAdminData = {
  guidanceAsOf?: string;
  securities: (typeof market.security.$inferSelect)[];
  companies: (typeof market.company.$inferSelect)[];
  periods: (typeof market.financialPeriod.$inferSelect)[];
  facts: (typeof market.financialFact.$inferSelect & { sec_changed: boolean })[];
  segments: (typeof market.businessSegment.$inferSelect)[];
  sources: (typeof market.source.$inferSelect)[];
  prices: (typeof market.priceBar.$inferSelect)[];
  analysts: (typeof analystProfile.$inferSelect)[];
  jobs: (typeof jobRun.$inferSelect)[];
};
