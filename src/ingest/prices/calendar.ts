/** D-153. Explicit NYSE/NASDAQ coverage; never extrapolate weekdays outside it.
 * Exchange schedules: https://www.nyse.com/markets/hours-calendars
 * https://www.nasdaq.com/market-activity/stock-market-holiday-schedule
 * Update/review exceptional closures before any separately authorized live use.
 */
const holidays = new Set([
  "2025-01-01", "2025-01-09", "2025-01-20", "2025-02-17", "2025-04-18",
  "2025-05-26", "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25",
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
  "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);
const early = new Set(["2025-07-03", "2025-11-28", "2025-12-24",
  "2026-11-27", "2026-12-24", "2027-11-26"]);
export function easternDate(now: Date) {
  if (!Number.isFinite(+now)) throw new Error("Invalid clock");
  // eslint-disable-next-line formatting/shared -- D-153 exchange calendar arithmetic, not user-facing date formatting.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function nextDate(date: string, days: number) {
  return new Date(+new Date(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
export type Exceptions = Readonly<Record<string, "closed" | 13 | 16>>;
export function sessionClose(date: string, exceptions: Exceptions = {}): Date | null {
  if (date < "2025-01-01" || date > "2027-12-31" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) || nextDate(date, 0) !== date)
    throw new Error("Unsupported exchange calendar coverage");
  const day = new Date(`${date}T12:00Z`).getUTCDay();
  const exception = exceptions[date];
  if (exception === "closed" || (!exception && (day === 0 || day === 6 || holidays.has(date)))) return null;
  const hour = exception ?? (early.has(date) ? 13 : 16);
  // Noon UTC is unambiguous across US DST transitions. Offset comes from IANA.
  // eslint-disable-next-line formatting/shared -- D-153 IANA offset calculation; D-121 controls display formatting only.
  const localHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York",
    hour: "numeric", hourCycle: "h23" }).format(new Date(`${date}T12:00Z`)));
  return new Date(`${date}T${String(hour + 12 - localHour).padStart(2, "0")}:00:00Z`);
}
export function monthWindow(month: string, exceptions: Exceptions = {}) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Month must be YYYY-MM");
  const [year, number] = month.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
  let date = monthEnd;
  let close = sessionClose(date, exceptions);
  while (!close) { date = nextDate(date, -1); close = sessionClose(date, exceptions); }
  let following = nextDate(date, 1);
  let nextClose = sessionClose(following, exceptions);
  while (!nextClose) { following = nextDate(following, 1); nextClose = sessionClose(following, exceptions); }
  return { monthEnd, date, close, nextClose };
}
export type MonthWindow = ReturnType<typeof monthWindow>;
export function assertWindow(window: MonthWindow, now: Date) {
  if (!Number.isFinite(+now) || +now <= +window.close) throw new Error("Month-end session has not completed");
  if (+now >= +window.nextClose) throw new Error("Next trading session has closed; current endpoint cannot backfill");
}
