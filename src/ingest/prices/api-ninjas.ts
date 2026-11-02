import { easternDate, type MonthWindow } from "./calendar";

export const NINJAS = "API Ninjas";
export const ATTRIBUTION = "Prices: API Ninjas https://api-ninjas.com";
export const ENDPOINT = "https://api.api-ninjas.com/v1/stockprice";
export type Target = { id: string; ticker: string; exchange: string; currency: string | null };
export type AcceptedClose = { close: number; date: string; monthEnd: string; updated: Date;
  retrieved: Date; sourceUrl: string; fieldUsed: "price" | "previous_close" };
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
  if (typeof r.updated !== "number" || !Number.isSafeInteger(r.updated))
    throw new ProviderError("Unprovable provider timestamp");
  const updated = new Date(r.updated * 1000);
  // D-153 extension: only the exact first following session close proves previous_close.
  const fieldUsed = +updated === +window.close && easternDate(updated) === window.date
    ? "price" : +updated === +window.nextClose ? "previous_close" : null;
  if (!Number.isFinite(+updated) || !fieldUsed || +updated > +retrieved)
    throw new ProviderError("Timestamp does not prove the completed month-end close");
  const amount = r[fieldUsed];
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 ||
    amount >= 1e24 || Number(amount.toFixed(6)) !== amount)
    throw new ProviderError("Invalid or unsupported close amount");
  return { close: amount, fieldUsed, date: window.date, monthEnd: window.monthEnd, updated, retrieved,
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
