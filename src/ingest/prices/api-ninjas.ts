import { easternDate, type MonthWindow } from "./calendar";

export const NINJAS = "API Ninjas";
export const ATTRIBUTION = "Prices: API Ninjas https://api-ninjas.com";
export const ENDPOINT = "https://api.api-ninjas.com/v1/stockprice";
export type Target = { id: string; ticker: string; exchange: string; currency: string | null };
export type AcceptedClose = { close: number; date: string; monthEnd: string; updated: Date;
  retrieved: Date; sourceUrl: string };
export class ProviderError extends Error {
  constructor(public readonly reason: string, public readonly stop = false) { super(reason); }
}
export function validateClose(raw: unknown, target: Target, window: MonthWindow, retrieved: Date): AcceptedClose {
  if (!raw || typeof raw !== "object") throw new ProviderError("Malformed response");
  const r = raw as Record<string, unknown>;
  if (r.error) throw new ProviderError("Provider error", /quota|limit|credit|subscription|api.?key|unauthor/i.test(String(r.error)));
  if (r.ticker !== target.ticker || r.exchange !== target.exchange || r.currency !== "USD" ||
    target.currency !== "USD" || !["NYSE", "NASDAQ"].includes(target.exchange))
    throw new ProviderError("Security identity or currency mismatch");
  if (typeof r.price !== "number" || !Number.isFinite(r.price) || r.price <= 0 ||
    r.price >= 1e24 || Number(r.price.toFixed(6)) !== r.price)
    throw new ProviderError("Invalid or unsupported close amount");
  if (typeof r.updated !== "number" || !Number.isSafeInteger(r.updated))
    throw new ProviderError("Unprovable provider timestamp");
  const updated = new Date(r.updated * 1000);
  if (!Number.isFinite(+updated) || +updated !== +window.close || +updated > +retrieved ||
    easternDate(updated) !== window.date)
    throw new ProviderError("Timestamp does not prove the completed month-end close");
  return { close: r.price, date: window.date, monthEnd: window.monthEnd, updated, retrieved,
    sourceUrl: `${ENDPOINT}?ticker=${encodeURIComponent(target.ticker)}` };
}
export async function fetchClose(key: string, target: Target, window: MonthWindow,
  clock: () => Date, http: typeof fetch): Promise<AcceptedClose> {
  try {
    const response = await http(`${ENDPOINT}?ticker=${encodeURIComponent(target.ticker)}`, {
      method: "GET", headers: { "X-Api-Key": key }, redirect: "error",
      signal: AbortSignal.timeout(10000), cache: "no-store",
    });
    const raw: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const quota = raw && typeof raw === "object" && "error" in raw &&
        /quota|limit|credit/i.test(String(raw.error));
      throw new ProviderError(`Provider HTTP ${response.status}`, [401, 403, 429].includes(response.status) || !!quota);
    }
    return validateClose(raw, target, window, clock());
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("Transport or malformed-response failure");
  }
}
