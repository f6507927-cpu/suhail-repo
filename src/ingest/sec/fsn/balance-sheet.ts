import draft from "../../../../data/methodologies/al-rajhi-adapted-1.1-draft.json";
import type { Fact } from "../../../engine/types";
import { accession, FSN_PROVIDER, type FsnArchive, type FsnTarget, type TableRow } from "./contracts";
import { numeric } from "./period";
import { assetScope, possibleFinancialAsset } from "./asset-scope";
import { CASH_SHORT_SUBTOTAL, CASH_RESTRICTED_TOTAL, EXCLUDED_EQUITY_METHOD, mappedComponent, standardBoundTag } from "./bound-tag-policy";
import { readBalanceValue } from "./balance-value";

export const balanceSheetTags = Object.values(draft.balance_sheet_tags)
  .flatMap(bucket => [...bucket.totals, ...bucket.components]);
export type ComponentName = keyof typeof draft.balance_sheet_tags;
export type BalanceComponent = {
  value: number | null; state: "reported" | "not_on_balance_sheet" | "included_in_subtotal" | "unknown";
  label: string; reason: string | null; tags: string[]; rows: TableRow[];
};
export type BalanceSheet = {
  components: Record<ComponentName, BalanceComponent>; blockers: TableRow[];
  filingLink: string; accession: string; fiscalEnd: string;
  provider: typeof FSN_PROVIDER; sourceTier: "Verified";
  excluded?: TableRow[];
};
const unknownComponent = (reason: string, rows: TableRow[] = []): BalanceComponent =>
  ({ value: null, state: "unknown", label: "unknown", reason, tags: [], rows });
export function unavailableBalanceSheet(target: FsnTarget, reason: string): BalanceSheet {
  return { components: { cash: unknownComponent(reason), short_term: unknownComponent(reason), long_term: unknownComponent(reason) },
    blockers: [], filingLink: target.mapped.period.source.source_url!, accession: accession(target), fiscalEnd: target.mapped.period.period_end,
    provider: FSN_PROVIDER, sourceTier: "Verified" };
}

/** D-154: PRE BS is evidence of absence. Never infer absence from NUM alone. */
export function assessBalanceSheet(target: FsnTarget, archive: FsnArchive, revenueAnchor: TableRow | null): BalanceSheet {
  const sub = archive.submissions.find(row => row.adsh === accession(target) && Number(row.cik) === Number(target.cik));
  const sic = numeric(sub?.sic ?? "");
  if (sic !== null && sic >= 6000 && sic <= 6299)
    return unavailableBalanceSheet(target, "not applicable: financial institution");
  const result = unavailableBalanceSheet(target, "No complete balance-sheet presentation");
  const presentation = archive.presentation?.filter(row => row.adsh === accession(target) && row.stmt === "BS") ?? [];
  if (!presentation.length) return result;
  if (!revenueAnchor) return unavailableBalanceSheet(target, "No unique NUM revenue anchor; fiscal context unproven");
  const calculations = archive.calculations?.filter(row => row.adsh === accession(target)) ?? [];
  const scope = assetScope(presentation, calculations);
  if (scope.reason) return unavailableBalanceSheet(target, scope.reason);
  const lines = scope.lines;
  result.excluded = lines.filter(row => standardBoundTag(row, EXCLUDED_EQUITY_METHOD))
    .map(row => ({ ...row, exclusion: "excluded: equity-method investment" }));
  const subtotal = lines.filter(row => standardBoundTag(row, CASH_SHORT_SUBTOTAL));
  const mappings = new Map(lines.map(row => [row, mappedComponent(target, row, presentation, calculations)]));
  const mapped = (row: TableRow) => mappings.get(row) ?? null;
  // Name checks only refuse unsafe zero inference; they NEVER select a value.
  // Only potentially financial ASSET lines block. Inventory, prepaid expenses,
  // liabilities and unrelated custom tags never establish missing securities.
  result.blockers = lines.filter(row => possibleFinancialAsset(row) &&
    !standardBoundTag(row, EXCLUDED_EQUITY_METHOD) && !standardBoundTag(row, CASH_SHORT_SUBTOTAL) && !mapped(row));
  let cashContext: string | null = null;
  for (const name of ["cash", "short_term", "long_term"] as const) {
    const mapping = draft.balance_sheet_tags[name];
    let present = lines.filter(row => mapped(row) === name);
    if (name === "cash" && subtotal.length) present = subtotal;
    else if (name === "cash" && present.some(row => row.tag === CASH_RESTRICTED_TOTAL))
      present = present.filter(row => row.tag === CASH_RESTRICTED_TOTAL);
    else if (name === "cash" && !present.some(row => row.tag === "CashAndCashEquivalentsAtCarryingValue")) {
      result.components[name] = unknownComponent("Cash and cash equivalents is required", present); continue;
    }
    const totalTags = new Set(present.filter(row => (mapping.totals as string[]).includes(row.tag)).map(row => row.tag));
    // Totals substitute their components. Do not require an unreadable child
    // value when its enclosing mapped total is already reported.
    if (name !== "cash" && totalTags.size) present = present.filter(row => totalTags.has(row.tag));
    const tags = [...new Set(present.map(row => row.tag))];
    if (name !== "cash" && result.blockers.length) {
      result.components[name] = unknownComponent("Custom or unmapped asset BS line prevents securities completeness", result.blockers);
      continue;
    }
    if (name === "short_term" && subtotal.length) {
      result.components[name] = cashContext === null ? unknownComponent("Cash/short-term subtotal is unusable", result.components.cash.rows)
        : { value: 0, state: "included_in_subtotal", label: "included in cash + short-term subtotal",
          reason: null, tags: [CASH_SHORT_SUBTOTAL], rows: result.components.cash.rows };
      continue;
    }
    if (name === "cash" && subtotal.length && lines.some(row => row.version.startsWith("us-gaap/") &&
      [CASH_RESTRICTED_TOTAL, ...draft.balance_sheet_tags.cash.components].includes(row.tag))) {
      result.components[name] = unknownComponent("Cash/short-term subtotal and restricted-cash coverage overlap is unproven", subtotal);
      continue;
    }
    if (!tags.length) {
      result.components[name] = name === "cash" ? unknownComponent("Cash and cash equivalents is required")
        : { value: 0, state: "not_on_balance_sheet", label: "not on balance sheet", reason: null, tags: [], rows: [] };
      continue;
    }
    const evidence = tags.map(tag => readBalanceValue(target, archive.numbers, present.filter(row => row.tag === tag), revenueAnchor));
    const refusal = evidence.find(item => item.reason);
    if (refusal) { result.components[name] = unknownComponent(refusal.reason!, evidence.flatMap(item => item.rows)); continue; }
    const totals = evidence.filter(item => (mapping.totals as string[]).includes(item.tag));
    const chosen = name === "cash" ? evidence : totals.length ? totals : evidence;
    if (totals.length > 1 || new Set(evidence.map(item => item.context)).size !== 1 ||
      (name !== "cash" && (cashContext === null || chosen[0].context !== cashContext))) {
      result.components[name] = unknownComponent("Ambiguous totals or inconsistent balance-sheet fiscal context", present); continue;
    }
    const value = chosen.reduce((sum, item) => sum + item.value!, 0);
    if (!Number.isFinite(value)) { result.components[name] = unknownComponent("Nonfinite asset total", present); continue; }
    result.components[name] = { value, state: "reported",
      label: name === "cash" && subtotal.length ? "reported cash + short-term subtotal" : "reported on balance sheet", reason: null,
      tags: chosen.map(item => item.tag), rows: evidence.map(item => item.row) };
    if (name === "cash") cashContext = chosen[0].context;
  }
  return result;
}

/** Draft-only engine inputs, never persisted as reported prohibited_income.
 * Callers must explicitly check protected analyst evidence before eligibility.
 */
export function balanceSheetFacts(sheet: BalanceSheet, protectedIncome = true): Fact[] {
  const policy = draft.upper_bound;
  const fields = { cash: policy.cash_line_item, short_term: policy.short_term_line_item, long_term: policy.long_term_line_item };
  const sourceId = sheet.filingLink;
  return [
    ...(["cash", "short_term", "long_term"] as const).map(name => ({
      lineItem: fields[name], value: sheet.components[name].value,
      inputState: sheet.components[name].value === null ? "unknown" as const
        : sheet.components[name].state === "reported" ? "reported" as const : "estimated" as const,
      confidenceTier: sheet.components[name].state === "reported" ? "Verified" as const : "Estimated" as const, sourceId,
    })),
    { lineItem: policy.eligibility_line_item, value: !protectedIncome &&
      Object.values(sheet.components).every(c => c.value !== null && c.state !== "unknown") ? 1 : 0,
      inputState: "reported", confidenceTier: "Verified", sourceId },
  ];
}
