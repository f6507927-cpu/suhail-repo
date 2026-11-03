type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? String(value) : "unknown";
const clean = (value: unknown) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

/** One line per stock. This is a hypothetical BOUND preview, not stored status. */
export function upperBoundSummary(value: unknown) {
  const row = record(value), upper = record(row.upperBound), parts = record(record(row.balanceSheet).components);
  const component = (name: string) => {
    const part = record(parts[name]);
    return number(part.value) + (part.state === "not_on_balance_sheet" ? " [not on balance sheet]" : "");
  };
  const existing = typeof upper.selectedIncome === "number";
  const pass = upper.used === true && upper.passes === true && !existing;
  const reasons = [
    ...(existing ? ["Existing income takes precedence; bound not used"] : []),
    clean(upper.reason), ...Object.values(parts).map(part => clean(record(part).reason)),
    clean(row.reason),
  ].filter(Boolean);
  // A missing FSN income tag is irrelevant when the hypothetical bound passes.
  const reason = pass ? "Estimated upper bound; analyst overrides not checked"
    : [...new Set(reasons)].join("; ") || "Unknown inputs";
  const ratio = number(upper.ratio);
  return `${clean(row.ticker) || "unknown"} cash=${component("cash")} short-term=${component("short_term")} ` +
    `long-term=${component("long_term")} bound=${number(upper.bound)} ratio=${ratio}${ratio === "unknown" ? "" : "%"} ` +
    `${pass ? "pass" : "unknown"} reason=${reason}`;
}
