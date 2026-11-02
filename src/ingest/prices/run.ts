import { assertWindow, easternDate, monthWindow } from "./calendar";
import { ATTRIBUTION, fetchClose, ProviderError, type AcceptedClose, type Target } from "./api-ninjas";

/** D-153: dry-run capability contains one durable write only, never a real store. */
export type BudgetStore = { reserveCall(callMonth: string, cap: number): Promise<boolean> };
export type RunStore = BudgetStore & {
  targets(): Promise<Target[]>;
  claim(target: Target, date: string, monthEnd: string): Promise<boolean>;
  save(target: Target, close: AcceptedClose): Promise<void>;
  unavailable(reason: string): Promise<void>;
};
export type RunOptions = { key?: string; month: string; cap?: number; clock: () => Date;
  http: typeof fetch; log: (message: string) => void };
function windowFor(options: RunOptions) {
  const window = monthWindow(options.month);
  assertWindow(window, options.clock());
  if (!Number.isSafeInteger(options.cap ?? 500) || (options.cap ?? 500) < 1) throw new Error("Invalid call cap");
  return window;
}
async function attempt(o: RunOptions, store: BudgetStore, target: Target, window: ReturnType<typeof monthWindow>) {
  // Revalidate before every reservation/HTTP, not merely at batch startup.
  assertWindow(window, o.clock());
  const callMonth = easternDate(o.clock()).slice(0, 7);
  if (!await store.reserveCall(callMonth, o.cap ?? 500))
    throw new ProviderError("Monthly call cap exhausted", true);
  assertWindow(window, o.clock());
  if (easternDate(o.clock()).slice(0, 7) !== callMonth) throw new ProviderError("Call month changed during reservation; no request made");
  const result = await fetchClose(o.key!, target, window, o.clock, o.http);
  assertWindow(window, o.clock());
  return result;
}
export async function dryRun(o: RunOptions, store: BudgetStore, target: Target) {
  if (!o.key) { o.log("API Ninjas disabled: API_NINJAS_KEY is unset"); return; }
  const window = windowFor(o);
  try {
    const close = await attempt(o, store, target, window);
    o.log(`${target.ticker} ${close.close} USD Closing price on ${close.date} · field=${close.fieldUsed} · ${ATTRIBUTION}`);
    return close;
  } catch (e) {
    o.log(e instanceof ProviderError ? e.reason : "Window or budget failure");
    throw new Error("Dry run rejected");
  }
}
export async function runMonth(o: RunOptions, store: RunStore) {
  if (!o.key) { o.log("API Ninjas disabled: API_NINJAS_KEY is unset"); return; }
  const window = windowFor(o);
  for (const target of await store.targets()) {
    try {
      assertWindow(window, o.clock());
      if (!await store.claim(target, window.date, window.monthEnd)) {
        o.log(`${target.ticker}: stored evidence or prior claim; skipped`); continue;
      }
      const close = await attempt(o, store, target, window);
      await store.save(target, close);
      o.log(`${target.ticker} ${close.close} USD Closing price on ${close.date} · field=${close.fieldUsed} · ${ATTRIBUTION}`);
    } catch (error) {
      const reason = error instanceof ProviderError ? error.reason : "Window, budget or persistence failure";
      o.log(`${target.ticker}: ${reason}`);
      if (error instanceof ProviderError && error.stop) {
        if (reason !== "Monthly call cap exhausted") await store.unavailable(reason);
        break;
      }
    }
  }
}
