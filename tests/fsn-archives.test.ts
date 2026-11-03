import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { SecClient } from "../src/ingest/sec/client";
import { resolveFsn } from "../src/ingest/sec/fsn/resolve";
import { fsnFixture, fsnResponse, fsnTargets } from "./fsn-fixture";

afterEach(() => vi.unstubAllEnvs());
const month = "https://www.sec.gov/files/dera/data/financial-statement-notes-data-sets/2026_10_notes.zip";
const quarter = month.replace("2026_10", "2026q4");
const target = () => {
  const t = structuredClone(fsnTargets[0]);
  t.mapped.period.reported_date = "2026-10-30";
  return t;
};
function client(status: (url: string) => number, requested: string[]) {
  vi.stubEnv("SEC_USER_AGENT", "Synthetic fixture tests test@example.invalid");
  return new SecClient({ retries: 0, fetcher: async input => {
    const url = String(input); requested.push(url);
    if (!url.endsWith(".zip")) return new Response(fsnFixture("catalog.html"));
    const code = status(url);
    return code === 200 ? fsnResponse() : new Response(null, { status: code });
  } });
}
describe("filing-month archive publication", () => {
  it("tries the October monthly archive even before its link is listed", async () => {
    const requests: string[] = [];
    await resolveFsn([target()], client(() => 200, requests));
    expect(requests.filter(url => url.endsWith(".zip"))).toEqual([month]);
  });
  it("falls back to the quarter only when the month is unpublished", async () => {
    const requests: string[] = [];
    await resolveFsn([target()], client(url => url === month ? 404 : 200, requests));
    expect(requests.filter(url => url.endsWith(".zip"))).toEqual([month, quarter]);
  });
  it("shares missing probes within a run, reports both dates, and retries next run", async () => {
    const requests: string[] = [], c = client(() => 404, requests);
    const t = target(), other = { ...t, ticker: "COST" };
    const result = await resolveFsn([t, other], c);
    for (const ticker of [t.ticker, other.ticker]) expect(result.get(ticker)?.reason)
      .toBe("archive not yet published (tried 2026_10, 2026q4); retry on the next run");
    expect(requests.filter(url => url.endsWith(".zip"))).toEqual([month, quarter]);
    await resolveFsn([t], c);
    expect(requests.filter(url => url.endsWith(".zip"))).toEqual([month, quarter, month, quarter]);
  });
  it.each([403, 429, 500])("does not mislabel HTTP %s as unpublished", async status => {
    const requests: string[] = [];
    const result = await resolveFsn([target()], client(() => status, requests));
    expect(result.get(target().ticker)?.reason).toBe(`SEC HTTP ${status}`);
    expect(requests.filter(url => url.endsWith(".zip"))).toEqual([month]);
  });
  it("keeps an explicit dataset override exclusive", async () => {
    const requests: string[] = [];
    await resolveFsn([target()], client(() => 404, requests), "2026_07");
    expect(requests.filter(url => url.endsWith(".zip"))).toEqual([month.replace("2026_10", "2026_07")]);
  });
});
