import draft from "../../../../data/methodologies/al-rajhi-adapted-1.1-draft.json";
import type { Fact } from "../../../engine/types";
import { accession, FSN_PROVIDER, type FsnArchive, type FsnTarget, type TableRow } from "./contracts";
import { consolidated, matchesEnd, numeric, periodKey } from "./period";

export const balanceSheetTags = Object.values(draft.balance_sheet_tags)
  .flatMap(bucket => [...bucket.totals, ...bucket.components]);
export type ComponentName = keyof typeof draft.balance_sheet_tags;
export type BalanceComponent = {
  value: number | null; state: "reported" | "not_on_balance_sheet" | "unknown";
  label: string; reason: string | null; tags: string[]; rows: TableRow[];
};
export type BalanceSheet = {
  components: Record<ComponentName, BalanceComponent>; blockers: TableRow[];
  filingLink: string; accession: string; fiscalEnd: string;
  provider: typeof FSN_PROVIDER; sourceTier: "Verified";
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
  const result = unavailableBalanceSheet(target, "No complete balance-sheet presentation");
  const lines = archive.presentation?.filter(row => row.adsh === accession(target) && row.stmt === "BS") ?? [];
  if (!lines.length) return result;
  if (!revenueAnchor) return unavailableBalanceSheet(target, "No unique NUM revenue anchor; fiscal context unproven");
  // Name checks only refuse unsafe zero inference; they NEVER select a value.
  // Every custom BS tag is a blocker: do not guess its asset classification.
  result.blockers = lines.filter(row => !row.version.startsWith("us-gaap/") ||
    (!balanceSheetTags.includes(row.tag) && /cash|invest|securit/i.test(`${row.tag} ${row.plabel}`)));
  let cashContext: string | null = null;
  for (const name of ["cash", "short_term", "long_term"] as const) {
    const mapping = draft.balance_sheet_tags[name];
    const present = lines.filter(row => row.version.startsWith("us-gaap/") &&
      [...mapping.totals, ...mapping.components].includes(row.tag));
    const tags = [...new Set(present.map(row => row.tag))];
    if (name !== "cash" && result.blockers.length) {
      result.components[name] = unknownComponent("Custom or unmapped asset BS line prevents securities completeness", result.blockers);
      continue;
    }
    if (!tags.length) {
      result.components[name] = name === "cash" ? unknownComponent("Cash and cash equivalents is required")
        : { value: 0, state: "not_on_balance_sheet", label: "not on balance sheet", reason: null, tags: [], rows: [] };
      continue;
    }
    const evidence: { tag: string; value: number; context: string; row: TableRow }[] = [];
    let refusal: string | null = null;
    for (const tag of tags) {
      const versions = new Set(present.filter(row => row.tag === tag).map(row => row.version));
      const rows = archive.numbers.filter(row => row.adsh === accession(target) && row.tag === tag &&
        versions.has(row.version) && consolidated(row) && numeric(row.qtrs) === 0 &&
        numeric(row.durp) === 0 && numeric(row.datp) === numeric(revenueAnchor.datp) &&
        matchesEnd(row, target.mapped.period.period_end));
      const contexts = new Set(rows.map(periodKey)), values = new Set(rows.map(row => numeric(row.value)));
      if (contexts.size !== 1 || values.size !== 1 || values.has(null) || [...values][0]! < 0) {
        refusal = `Cannot read one nonnegative consolidated USD value for BS line ${tag}`; break;
      }
      evidence.push({ tag, value: [...values][0]!, context: [...contexts][0], row: rows[0] });
    }
    if (refusal) { result.components[name] = unknownComponent(refusal, present); continue; }
    const totals = evidence.filter(item => (mapping.totals as string[]).includes(item.tag));
    const chosen = totals.length ? totals : evidence;
    if (totals.length > 1 || new Set(evidence.map(item => item.context)).size !== 1 ||
      (name !== "cash" && (cashContext === null || chosen[0].context !== cashContext))) {
      result.components[name] = unknownComponent("Ambiguous totals or inconsistent balance-sheet fiscal context", present); continue;
    }
    const value = chosen.reduce((sum, item) => sum + item.value, 0);
    if (!Number.isFinite(value)) { result.components[name] = unknownComponent("Nonfinite asset total", present); continue; }
    result.components[name] = { value, state: "reported", label: "reported on balance sheet", reason: null,
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
    { lineItem: policy.eligibility_line_item, value: protectedIncome ? 0 : 1,
      inputState: "reported", confidenceTier: "Verified", sourceId },
  ];
}
