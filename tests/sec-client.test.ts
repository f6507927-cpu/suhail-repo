import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

type Scope = typeof globalThis & { __suhailSecBucket?: unknown };
beforeEach(() => {
  vi.resetModules();
  delete (globalThis as Scope).__suhailSecBucket;
  vi.useFakeTimers();
  vi.stubEnv("SEC_USER_AGENT", "Suhail SEC client tests test@example.invalid");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  delete (globalThis as Scope).__suhailSecBucket;
});
const response = (status = 200) => new Response(JSON.stringify({ test: true }), { status });

describe("bounded server-only SEC client", () => {
  it("shares the existing 8/s budget and User-Agent across JSON, catalog, archive and retried archive requests", async () => {
    const { SecClient } = await import("../src/ingest/sec/client");
    const starts: number[] = [];
    let zipAttempts = 0;
    const fetcher = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      starts.push(performance.now());
      expect(options?.headers).toMatchObject({ "User-Agent": "Suhail SEC client tests test@example.invalid" });
      if (String(url).endsWith(".zip")) return new Response("fixture", { status: ++zipAttempts === 1 ? 503 : 200 });
      return String(url).includes("companyfacts") ? response() : new Response("catalog fixture");
    });
    const client = new SecClient({ fetcher });
    const requests = Promise.all([
      client.companyfacts("320193"), client.notesCatalog(),
      client.notesArchive("https://www.sec.gov/files/dera/data/financial-statement-notes-data-sets/2026_07_notes.zip", r => r.text()),
    ]);
    await vi.runAllTimersAsync();
    await expect(requests).resolves.toHaveLength(3);
    expect(starts).toHaveLength(4);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(125);
    expect(() => client.notesArchive("https://other.invalid/archive.zip", r => r.text())).toThrow("Invalid SEC Notes");
  });
  it("retrieves public filing text without permitting arbitrary hosts or paths", async () => {
    const { SecClient } = await import("../src/ingest/sec/client");
    const fetcher = vi.fn(async () => new Response("<html>Filing evidence</html>"));
    const client = new SecClient({ fetcher });
    const result = await client.filing("320193", "0000320193-25-000079", "aapl-20250927.htm");
    expect(result.data).toBe("<html>Filing evidence</html>");
    expect(result.retrieval.url).toBe("https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm");
    expect(fetcher.mock.calls[0]).toBeDefined();
    expect(fetcher).toHaveBeenCalledWith(result.retrieval.url, expect.objectContaining({
      redirect: "error", headers: expect.objectContaining({ Accept: "text/html" }),
    }));
    for (const path of ["../private.htm", "https://example.test/a.htm", "a.htm?token=private", "a/b.htm"]) {
      expect(() => client.filing("320193", "0000320193-25-000079", path)).toThrow("Invalid SEC filing reference");
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("uses all fixed URLs, padded CIK, lazy identifying header and retrieval metadata", async () => {
    const { SecClient } = await import("../src/ingest/sec/client");
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response());
    const c = new SecClient({ fetcher });
    const result = Promise.all([c.tickers(), c.submissions(320193), c.companyfacts("0000789019")]);
    await vi.runAllTimersAsync();
    const results = await result;
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://www.sec.gov/files/company_tickers_exchange.json",
      "https://data.sec.gov/submissions/CIK0000320193.json",
      "https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json",
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.headers).toMatchObject({ "User-Agent": "Suhail SEC client tests test@example.invalid" });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.redirect).toBe("error");
    }
    expect(results[0].retrieval).toMatchObject({ is_synthetic: false, is_demo: false });
    expect(results[0].retrieval.retrieved_at).toMatch(/^\d{4}-/);
  });
  it("shares a strict 8/s budget across instances, endpoints and concurrent requests", async () => {
    const { SecClient } = await import("../src/ingest/sec/client");
    const starts: number[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => { starts.push(performance.now()); return response(); });
    const clients = [new SecClient({ fetcher }), new SecClient({ fetcher })];
    const result = Promise.all(Array.from({ length: 24 }, (_, i) => i % 3 === 0 ?
      clients[i % 2].tickers() : i % 3 === 1 ? clients[i % 2].submissions(1) : clients[i % 2].companyfacts(1)));
    await vi.runAllTimersAsync();
    await result;
    expect(starts).toHaveLength(24);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(125);
    for (const t of starts) expect(starts.filter(n => n >= t && n < t + 1000).length).toBeLessThanOrEqual(8);
  });
  it.each([429, 500, 503, 599])("retries %s with capped jittered exponential backoff", async status => {
    const { SecClient } = await import("../src/ingest/sec/client");
    const starts: number[] = [];
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      starts.push(performance.now());
      return response(starts.length <= 3 ? status : 200);
    });
    const request = new SecClient({ fetcher }).companyfacts(1);
    await vi.runAllTimersAsync();
    await request;
    expect(starts).toEqual([0, 375, 1125, 2625]);
  });
  it("caps retry attempts and maximum exponential delay", async () => {
    const { SecClient } = await import("../src/ingest/sec/client");
    vi.spyOn(Math, "random").mockReturnValue(1);
    const starts: number[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => { starts.push(performance.now()); return response(429); });
    const check = expect(new SecClient({ retries: 5, fetcher }).companyfacts(1)).rejects.toThrow("SEC HTTP 429");
    await vi.runAllTimersAsync();
    await check;
    expect(starts).toEqual([0, 500, 1500, 3500, 7500, 15500]);
  });
  it("retries share the bucket with other instances rather than bypassing the cap", async () => {
    const { SecClient } = await import("../src/ingest/sec/client");
    vi.spyOn(Math, "random").mockReturnValue(0);
    const starts: number[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      starts.push(performance.now()); return response(starts.length === 1 ? 429 : 200);
    });
    const a = new SecClient({ fetcher });
    const b = new SecClient({ fetcher });
    const done = Promise.all([a.companyfacts(1), ...Array.from({ length: 10 }, () => b.tickers())]);
    await vi.runAllTimersAsync();
    await done;
    expect(starts).toHaveLength(12);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(125);
  });
  it.each([400, 403, 404])("does not retry permanent HTTP %s failures", async status => {
    const { SecClient } = await import("../src/ingest/sec/client");
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response(status));
    const check = expect(new SecClient({ fetcher }).tickers()).rejects.toThrow(`SEC HTTP ${status}`);
    await vi.runAllTimersAsync();
    await check;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["headers", "body"])("bounds waiting for %s even if the transport ignores abort", async part => {
    const { SecClient } = await import("../src/ingest/sec/client");
    let signal: AbortSignal | null | undefined;
    const never = new Promise<never>(() => {});
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_, init) => {
      signal = init?.signal;
      if (part === "headers") return never;
      return { ok: true, json: () => never } as unknown as Response;
    });
    const check = expect(new SecClient({ fetcher, timeoutMs: 500 }).tickers()).rejects.toThrow("SEC request timed out");
    await vi.advanceTimersByTimeAsync(500);
    await check;
    expect(signal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["network", "json"])("fails explicitly on %s errors without leaking request details", async kind => {
    const { SecClient } = await import("../src/ingest/sec/client");
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      if (kind === "network") throw new Error("private transport details");
      return new Response("not JSON");
    });
    const check = expect(new SecClient({ fetcher }).tickers()).rejects.toThrow("SEC request failed or returned invalid JSON");
    await vi.runAllTimersAsync();
    await check;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("requires SEC_USER_AGENT before making any request", async () => {
    vi.stubEnv("SEC_USER_AGENT", undefined);
    const { SecClient } = await import("../src/ingest/sec/client");
    const fetcher = vi.fn<typeof fetch>();
    await expect(new SecClient({ fetcher }).tickers()).rejects.toThrow("SEC_USER_AGENT");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("refuses unbounded timeout/retry settings and malformed CIKs", async () => {
    const { SecClient } = await import("../src/ingest/sec/client");
    for (const timeoutMs of [Infinity, NaN, 0, -1, 60001, 1.5]) expect(() => new SecClient({ timeoutMs })).toThrow();
    for (const retries of [Infinity, NaN, -1, 6, 1.5]) expect(() => new SecClient({ retries })).toThrow();
    for (const cik of ["", "1/../../", "12345678901", 0, -1, 1.5])
      expect(() => new SecClient().companyfacts(cik)).toThrow("CIK");
  });
});
