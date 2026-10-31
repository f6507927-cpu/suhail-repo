import "server-only";
import { getSecEnv } from "../../env/sec";
import type { CompanyFacts, Retrieval } from "./types";

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * D-05: process-wide token bucket, capacity ONE, refill 8 tokens/second.
 * No initial burst of eight followed by eight more in the same second.
 * Each network attempt (including retries) must acquire a token.
 * NOT a distributed limiter: see the founder checkpoint report before adding
 * callers in separate web workers, autoscale instances or scheduled processes.
 */
export class SecTokenBucket {
  private next = 0;
  private queue: Promise<void> = Promise.resolve();
  acquire(): Promise<void> {
    const turn = this.queue.then(async () => {
      // Real timers may fire early or round fractional milliseconds down.
      // Recheck the monotonic deadline rather than permitting an early token.
      while (this.next > performance.now())
        await sleep(Math.ceil(this.next - performance.now()));
      this.next = performance.now() + 125;
    });
    this.queue = turn.catch(() => {});
    return turn;
  }
}
const processScope = globalThis as typeof globalThis & { __suhailSecBucket?: SecTokenBucket };
const sharedBucket = processScope.__suhailSecBucket ??= new SecTokenBucket();

export interface TickerExchange {
  fields: string[];
  data: (string | number | null)[][];
}
export interface Submissions {
  cik: string;
  name: string;
  sicDescription: string;
  fiscalYearEnd: string;
  filings: { recent: Record<string, (string | number)[]>; files: unknown[] };
}
export class SecRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "SecRequestError";
  }
}
function paddedCik(cik: string | number): string {
  const value = String(cik);
  if (!/^\d{1,10}$/.test(value) || Number(value) === 0) throw new SecRequestError("CIK must contain 1–10 digits and be positive");
  return value.padStart(10, "0");
}
export class SecClient {
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly fetcher: typeof fetch;
  constructor(options: { timeoutMs?: number; retries?: number; fetcher?: typeof fetch } = {}) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.retries = options.retries ?? 3;
    this.fetcher = options.fetcher ?? fetch;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 60_000 ||
      !Number.isInteger(this.retries) || this.retries < 0 || this.retries > 5)
      throw new SecRequestError("SEC timeout must be 1–60000 ms and retries 0–5");
  }
  tickers() {
    return this.request<TickerExchange>("https://www.sec.gov/files/company_tickers_exchange.json");
  }
  submissions(cik: string | number) {
    return this.request<Submissions>(`https://data.sec.gov/submissions/CIK${paddedCik(cik)}.json`);
  }
  companyfacts(cik: string | number) {
    return this.request<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${paddedCik(cik)}.json`);
  }
  notesCatalog() {
    return this.request<string>("https://www.sec.gov/data-research/sec-markets-data/financial-statement-notes-data-sets", true);
  }
  notesArchive<T>(url: string, consume: (response: Response) => Promise<T>) {
    if (!/^https:\/\/www\.sec\.gov\/files\/dera\/data\/financial-statement-notes-data-sets\/\d{4}(?:_\d{2}|q[1-4])_notes(?:_\d+)?\.zip$/.test(url))
      throw new SecRequestError("Invalid SEC Notes archive URL");
    // Large archives need a separate bounded transfer budget; JSON stays at 15s.
    return this.request<T>(url, false, consume, 600_000);
  }
  /** Public filing inspection uses exactly the same budget, timeout and retries. */
  filing(cik: string | number, accession: string, document: string) {
    if (!/^\d{10}-\d{2}-\d{6}$/.test(accession) || !/^[a-zA-Z0-9_.-]+\.htm[l]?$/.test(document))
      throw new SecRequestError("Invalid SEC filing reference");
    return this.request<string>(`https://www.sec.gov/Archives/edgar/data/${Number(paddedCik(cik))}/${accession.replaceAll("-", "")}/${document}`, true);
  }
  private async request<T>(url: string, text = false, consume?: (response: Response) => Promise<T>, timeoutMs = this.timeoutMs): Promise<{ data: T; retrieval: Retrieval }> {
    const { SEC_USER_AGENT } = getSecEnv();
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      await sharedBucket.acquire();
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          (async () => {
            const response = await this.fetcher(url, {
              headers: { "User-Agent": SEC_USER_AGENT, Accept: consume ? "application/zip" : text ? "text/html" : "application/json" },
              signal: controller.signal, redirect: "error",
            });
            if (!response.ok) {
              await response.body?.cancel();
              throw new SecRequestError(`SEC HTTP ${response.status}`, response.status);
            }
            return consume ? await consume(response) : (text ? await response.text() : await response.json()) as T;
          })(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              controller.abort();
              reject(new SecRequestError("SEC request timed out"));
            }, timeoutMs);
          }),
        ]);
        return { data: result, retrieval: { url, retrieved_at: new Date().toISOString(),
          is_synthetic: false, is_demo: false } };
      } catch (error) {
        const status = error instanceof SecRequestError ? error.status : undefined;
        const retryable = status === 429 || (status !== undefined && status >= 500 && status <= 599);
        if (!retryable || attempt === this.retries) {
          if (error instanceof SecRequestError) throw error;
          // Never echo headers or request credentials in errors.
          throw new SecRequestError(consume ? "SEC archive request failed or returned invalid ZIP data" : "SEC request failed or returned invalid JSON");
        }
      } finally {
        clearTimeout(timeout);
      }
      const cap = Math.min(8_000, 500 * 2 ** attempt);
      await sleep(cap * (0.5 + Math.random() * 0.5));
    }
    throw new SecRequestError("SEC retry limit exhausted");
  }
}
