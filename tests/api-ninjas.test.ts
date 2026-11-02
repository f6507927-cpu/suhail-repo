import { describe, expect, it, vi } from "vitest";
import { assertWindow, easternDate, monthWindow, sessionClose } from "../src/ingest/prices/calendar";
import { fetchClose, validateClose, type Target } from "../src/ingest/prices/api-ninjas";
import { dryRun, runMonth, type RunOptions, type RunStore } from "../src/ingest/prices/run";
import { latestStoredClose, selectStoredMonth, type StoredClose } from "../src/ingest/prices/selection";

const target: Target = { id: "a", ticker: "AAPL", exchange: "NASDAQ", currency: "USD" };
const window = monthWindow("2026-09");
const now = () => new Date("2026-10-01T12:00Z");
const response = (extra = {}) => ({ ticker: "AAPL", exchange: "NASDAQ", currency: "USD", price: 123.456,
  updated: +window.close / 1000, previous_close: 9999, change: 99, volume: 100, ...extra });
function fixture(http = vi.fn().mockImplementation(async () => new Response(JSON.stringify(response())))) {
  const calls = new Map<string, number>(), claims = new Set<string>();
  const store: RunStore = {
    reserveCall: vi.fn(async (month, cap) => {
      if ((calls.get(month) ?? 0) >= cap) return false;
      calls.set(month, (calls.get(month) ?? 0) + 1); return true;
    }),
    targets: vi.fn(async () => [target]),
    claim: vi.fn(async (t, _date, month) => {
      const key = `${t.id}/${month}`;
      if (claims.has(key)) return false;
      claims.add(key); return true;
    }),
    save: vi.fn(async () => {}), unavailable: vi.fn(async () => {}),
  };
  const options: RunOptions = { key: "mock-key-not-real", month: "2026-09", clock: now, http, log: vi.fn() };
  return { store, options, calls, claims, http };
}
describe("D-153 fail-closed exchange calendar", () => {
  it.each([
    ["2026-01", "2026-01-30T21:00:00.000Z", "2026-02-02T21:00:00.000Z"],
    ["2026-02", "2026-02-27T21:00:00.000Z", "2026-03-02T21:00:00.000Z"],
    ["2026-03", "2026-03-31T20:00:00.000Z", "2026-04-01T20:00:00.000Z"],
    ["2026-05", "2026-05-29T20:00:00.000Z", "2026-06-01T20:00:00.000Z"],
    ["2026-07", "2026-07-31T20:00:00.000Z", "2026-08-03T20:00:00.000Z"],
    ["2026-10", "2026-10-30T20:00:00.000Z", "2026-11-02T21:00:00.000Z"],
    ["2026-12", "2026-12-31T21:00:00.000Z", "2027-01-04T21:00:00.000Z"],
    ["2027-05", "2027-05-28T20:00:00.000Z", "2027-06-01T20:00:00.000Z"],
  ])("%s uses actual month-end and following session", (month, close, next) => {
    const w = monthWindow(month); expect(w.close.toISOString()).toBe(close); expect(w.nextClose.toISOString()).toBe(next);
  });
  it.each(["2025-01-09", "2026-04-03", "2026-07-03", "2027-06-18", "2027-12-24",
    "2026-01-19", "2026-02-16", "2026-05-25", "2026-06-19", "2026-09-07", "2026-11-26",
    "2026-12-25", "2026-10-31"])("does not invent a session on %s", date => expect(sessionClose(date)).toBeNull());
  it.each([["2025-07-03", "17:00"], ["2025-11-28", "18:00"], ["2026-11-27", "18:00"],
    ["2026-12-24", "18:00"]])("early close %s", (date, time) =>
    expect(sessionClose(date)?.toISOString()).toBe(`${date}T${time}:00.000Z`));
  it("allows explicit exceptional closures and early month-end closes", () => {
    const w = monthWindow("2026-09", { "2026-09-30": "closed", "2026-09-29": 13 });
    expect(w.date).toBe("2026-09-29"); expect(w.close.toISOString()).toBe("2026-09-29T17:00:00.000Z");
  });
  it("extends through the first following close, respecting holidays, DST and exceptional sessions", () => {
    expect(monthWindow("2026-09").endClose.toISOString()).toBe("2026-10-02T20:00:00.000Z");
    expect(monthWindow("2026-10").endClose.toISOString()).toBe("2026-11-03T21:00:00.000Z");
    expect(monthWindow("2026-12").endClose.toISOString()).toBe("2027-01-05T21:00:00.000Z");
    const w = monthWindow("2026-09", { "2026-10-01": 13, "2026-10-02": "closed" });
    expect(w.nextClose.toISOString()).toBe("2026-10-01T17:00:00.000Z");
    expect(w.endClose.toISOString()).toBe("2026-10-05T20:00:00.000Z");
  });
  it.each(["2024-12", "2027-12", "2028-01", "2026-00", "2026-13", "September"])("refuses %s", month =>
    expect(() => monthWindow(month)).toThrow());
  it("rejects both exact boundaries, permits only the open interval", () => {
    for (const date of [window.close, window.endClose, new Date(+window.close - 1)])
      expect(() => assertWindow(window, date)).toThrow();
    expect(() => assertWindow(window, new Date(+window.close + 1))).not.toThrow();
    expect(() => assertWindow(window, window.nextClose)).not.toThrow();
    expect(() => assertWindow(window, new Date(+window.endClose - 1))).not.toThrow();
  });
  it("charges Eastern calendar month, not UTC", () =>
    expect(easternDate(new Date("2026-10-01T01:00Z"))).toBe("2026-09-30"));
});
describe("D-153 strict free close adapter", () => {
  it("retains only close and verification provenance, never live/change/history fields", () => {
    const accepted = validateClose(response(), target, window, now());
    expect(accepted).toEqual({ close: 123.456, date: "2026-09-30", monthEnd: "2026-09-30",
      updated: window.close, retrieved: now(), fieldUsed: "price",
      sourceUrl: "https://api.api-ninjas.com/v1/stockprice?ticker=AAPL" });
  });
  it("uses previous_close only for the exact first following session close, retaining the month-end trading date", () => {
    const retrieved = new Date(+window.nextClose + 1000);
    const accepted = validateClose(response({ updated: +window.nextClose / 1000, previous_close: 122.345,
      price: 900 }), target, window, retrieved);
    expect(accepted).toEqual({ close: 122.345, fieldUsed: "previous_close", date: window.date,
      monthEnd: window.monthEnd, updated: window.nextClose, retrieved,
      sourceUrl: "https://api.api-ninjas.com/v1/stockprice?ticker=AAPL" });
  });
  it.each([undefined, null, 0, -1, NaN, Infinity, "123", 1.1234567, 1e24])(
    "applies the same amount validation to previous_close=%s", previous_close => {
      expect(() => validateClose(response({ updated: +window.nextClose / 1000, previous_close }),
        target, window, new Date(+window.nextClose + 1000))).toThrow();
    });
  it.each([-1, 1])("rejects a following-day timestamp %s second away from the actual close", offset => {
    expect(() => validateClose(response({ updated: +window.nextClose / 1000 + offset }),
      target, window, new Date(+window.nextClose + 2000))).toThrow();
  });
  it("rejects future and second-following-session timestamps, even with a usable previous_close", () => {
    expect(() => validateClose(response({ updated: +window.nextClose / 1000 }), target, window, now())).toThrow();
    expect(() => validateClose(response({ updated: +window.endClose / 1000 }),
      target, window, new Date(+window.endClose + 1000))).toThrow();
  });
  it.each([
    { ticker: "MSFT" }, { exchange: "NYSE" }, { currency: "EUR" }, { currency: undefined },
    { price: 0 }, { price: -1 }, { price: NaN }, { price: Infinity }, { price: "123" },
    { price: 1.1234567 }, { price: 1e24 }, { price: undefined, previous_close: 123 },
    { updated: undefined }, { updated: "1790798400" }, { updated: +window.close },
    { updated: +window.close / 1000 - 1 }, { updated: +window.close / 1000 + 1 },
    { updated: +window.close / 1000 - 86400 }, { updated: +window.nextClose / 1000 },
    { updated: 1e99 }, { error: "malformed secret payload" },
  ])("rejects unsupported fields %j", extra =>
    expect(() => validateClose(response(extra), target, window, now())).toThrow());
  it("rejects early-close payloads stamped at regular close", () => {
    const w = monthWindow("2026-09", { "2026-09-30": 13 });
    expect(() => validateClose(response(), target, w, now())).toThrow();
    expect(validateClose(response({ updated: +w.close / 1000 }), target, w, now()).date).toBe(w.date);
  });
  it("makes a single GET with no redirects/retries", async () => {
    const f = fixture(); await fetchClose("mock", target, window, now, f.http);
    expect(f.http).toHaveBeenCalledOnce();
    expect(f.http.mock.calls[0][0]).toBe("https://api.api-ninjas.com/v1/stockprice?ticker=AAPL");
    expect(f.http.mock.calls[0][1]).toMatchObject({ method: "GET", redirect: "error", cache: "no-store" });
  });
});
describe("D-153 durable orchestration with fake persistence only", () => {
  it("disabled paths do not even inspect persistence or HTTP", async () => {
    const f = fixture(); f.options.key = undefined;
    await dryRun(f.options, f.store, target); await runMonth(f.options, f.store);
    for (const fn of Object.values(f.store)) expect(fn).not.toHaveBeenCalled();
    expect(f.http).not.toHaveBeenCalled();
  });
  it("invalid windows never call, claim or write", async () => {
    const f = fixture(); f.options.clock = () => window.endClose;
    await expect(runMonth(f.options, f.store)).rejects.toThrow("Next trading");
    await expect(dryRun(f.options, f.store, target)).rejects.toThrow("Next trading");
    expect(f.store.claim).not.toHaveBeenCalled(); expect(f.store.reserveCall).not.toHaveBeenCalled();
    expect(f.http).not.toHaveBeenCalled();
  });
  it("parallel and restarted runs cannot refetch a claimed target", async () => {
    const f = fixture(); await Promise.all([runMonth(f.options, f.store), runMonth(f.options, f.store)]);
    await runMonth(f.options, f.store);
    expect(f.http).toHaveBeenCalledOnce(); expect(f.store.save).toHaveBeenCalledOnce();
  });
  it("held manual or CSV evidence skips the call and budget", async () => {
    const f = fixture(); f.store.claim = vi.fn(async () => false);
    await runMonth(f.options, f.store); expect(f.http).not.toHaveBeenCalled();
    expect(f.store.reserveCall).not.toHaveBeenCalled();
  });
  it("cap is shared across parallel dry runs and call month resets", async () => {
    const f = fixture(); f.options.cap = 1;
    await Promise.allSettled([dryRun(f.options, f.store, target), dryRun(f.options, f.store, target)]);
    expect(f.http).toHaveBeenCalledOnce(); expect(f.calls.get("2026-10")).toBe(1);
    f.options.clock = () => new Date("2026-09-30T22:00Z");
    await dryRun(f.options, f.store, target); expect(f.calls.get("2026-09")).toBe(1);
  });
  it.each([401, 403, 429])("real HTTP %s stops and records sanitized unavailability", async status => {
    const f = fixture(vi.fn().mockResolvedValue(new Response('{"error":"secret raw provider body"}', { status })));
    f.store.targets = vi.fn(async () => [target, { ...target, id: "b" }]);
    await runMonth(f.options, f.store);
    expect(f.http).toHaveBeenCalledOnce(); expect(f.calls.get("2026-10")).toBe(1);
    expect(f.store.unavailable).toHaveBeenCalledWith(`Provider HTTP ${status}`);
    expect(f.store.save).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(f.options.log).mock.calls)).not.toContain("secret");
  });
  it("quota errors with nonstandard status stop, too", async () => {
    const f = fixture(vi.fn().mockResolvedValue(new Response('{"error":"quota exceeded"}', { status: 400 })));
    await runMonth(f.options, f.store); expect(f.store.unavailable).toHaveBeenCalledWith("Provider HTTP 400");
  });
  it.each(["timeout", "malformed", "stale", "provider"])("%s attempts spend budget but save no price", async mode => {
    const http = mode === "timeout" ? vi.fn().mockRejectedValue(new Error("secret key"))
      : vi.fn().mockResolvedValue(new Response(mode === "malformed" ? "invalid"
        : JSON.stringify(response(mode === "stale" ? { updated: 1 } : { error: "unavailable" }))));
    const f = fixture(http); await runMonth(f.options, f.store);
    expect(f.calls.get("2026-10")).toBe(1); expect(f.store.save).not.toHaveBeenCalled();
    expect(f.store.unavailable).not.toHaveBeenCalled();
  });
  it("save errors do not escape into other targets or clear history", async () => {
    const f = fixture(); f.store.targets = vi.fn(async () => [target, { ...target, id: "b" }]);
    f.store.save = vi.fn().mockRejectedValue(new Error("database secret"));
    await runMonth(f.options, f.store); expect(f.store.save).toHaveBeenCalledTimes(2);
  });
  it.each([200, 401, 403, 429, 500])("dry-run %s has exactly the budget-only write allowlist", async status => {
    const f = fixture(vi.fn().mockImplementation(async () => new Response(
      status === 200 ? JSON.stringify(response()) : '{"error":"rejected"}', { status })));
    await dryRun(f.options, { reserveCall: f.store.reserveCall }, target).catch(() => {});
    expect(f.store.reserveCall).toHaveBeenCalledOnce(); expect(f.calls.get("2026-10")).toBe(1);
    for (const name of ["claim", "save", "unavailable", "targets"] as const) expect(f.store[name]).not.toHaveBeenCalled();
    if (status === 200) expect(vi.mocked(f.options.log).mock.calls[0][0]).toContain("Prices: API Ninjas https://api-ninjas.com");
  });
  it("cap exhaustion does not call HTTP or change dry-run provider status", async () => {
    const f = fixture(); f.store.reserveCall = vi.fn(async () => false);
    await expect(dryRun(f.options, f.store, target)).rejects.toThrow();
    expect(f.http).not.toHaveBeenCalled(); expect(f.store.unavailable).not.toHaveBeenCalled();
  });
  it("a response completing outside the window cannot be saved", async () => {
    const f = fixture();
    f.http.mockImplementation(async () => {
      f.options.clock = () => window.endClose;
      return new Response(JSON.stringify(response()));
    });
    await runMonth(f.options, f.store);
    expect(f.calls.get("2026-10")).toBe(1); expect(f.store.save).not.toHaveBeenCalled();
  });
  it.each(["price", "previous_close"] as const)("dry run reports field=%s without price/source writes", async field => {
    const f = fixture();
    f.options.clock = () => new Date(+window.nextClose + 1000);
    f.http.mockImplementation(async () => new Response(JSON.stringify(response({
      updated: +(field === "price" ? window.close : window.nextClose) / 1000,
      previous_close: 122.345,
    }))));
    const accepted = await dryRun(f.options, { reserveCall: f.store.reserveCall }, target);
    expect(accepted?.fieldUsed).toBe(field);
    expect(f.options.log).toHaveBeenCalledWith(expect.stringContaining(`field=${field}`));
    for (const name of ["claim", "save", "unavailable", "targets"] as const)
      expect(f.store[name]).not.toHaveBeenCalled();
  });
  it("stores the previous close with the original month-end date in the extended window", async () => {
    const f = fixture();
    f.options.clock = () => new Date(+window.endClose - 1);
    f.http.mockImplementation(async () => new Response(JSON.stringify(response({
      updated: +window.nextClose / 1000, previous_close: 122.345,
    }))));
    await runMonth(f.options, f.store);
    expect(f.store.save).toHaveBeenCalledWith(target, expect.objectContaining({
      close: 122.345, fieldUsed: "previous_close", date: window.date, monthEnd: window.monthEnd,
    }));
  });
  it("a reservation crossing an Eastern month boundary cannot make an uncounted call", async () => {
    const f = fixture(); f.options.clock = () => new Date("2026-10-01T03:59:59Z");
    f.store.reserveCall = vi.fn(async () => {
      f.options.clock = () => new Date("2026-10-01T04:00:00Z"); return true;
    });
    await expect(dryRun(f.options, f.store, target)).rejects.toThrow();
    expect(f.http).not.toHaveBeenCalled();
  });
});
describe("D-153 shared month-level precedence", () => {
  const manual: StoredClose = { id: "m", created_at: "2026-09-01", date: "2026-08-31",
    month_end_for: "2026-08-31", close: 10, currency: "USD", source_id: "manual" };
  const provider = { ...manual, id: "p", created_at: "2026-10-01", price_provider: "API Ninjas", close: 99 };
  it("later provider does not displace manual/CSV; manual reversals keep correction ordering", () => {
    expect(selectStoredMonth([provider, manual], "2026-08-31")).toBe(manual);
    const correction = { ...manual, id: "correction", created_at: "2026-10-02", close: 20 };
    expect(selectStoredMonth([provider, manual, correction], "2026-08-31")).toBe(correction);
    const reversal = { ...manual, id: "reversal", created_at: "2026-10-03" };
    expect(selectStoredMonth([provider, correction, reversal], "2026-08-31")).toBe(reversal);
  });
  it("newer provider month is not hidden by an older manual month", () => {
    const newer = { ...provider, date: "2026-09-30", month_end_for: "2026-09-30" };
    expect(latestStoredClose([manual, newer])).toBe(newer);
  });
  it("does not infer attestations or substitute a provider over an unknown manual correction", () => {
    expect(latestStoredClose([{ ...manual, month_end_for: null }])).toBeNull();
    expect(latestStoredClose([provider, { ...manual, close: null }])).toBeNull();
  });
});
