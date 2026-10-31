import { z } from "zod";
import { activityCategory } from "../../db/schema/core";
import { metadataSchema, versionSchema, criterionSchema, analystCasesSchema, type AnalystCase } from "../methodology/contracts";

export const TICKERS = "AAPL MSFT NVDA AMZN TSLA AVGO ADBE CRM ORCL AMD INTC CSCO QCOM TXN NFLX COST WMT HD PG KO PEP JNJ LLY XOM JPM".split(" ");
export const CLOSE_FIELDS = ["close_2026_07_31", "close_2026_08_31", "close_2026_09_30"] as const;
export const MONTH_ENDS = ["2026-07-31", "2026-08-31", "2026-09-30"] as const;
export const HEADER = ["ticker", ...CLOSE_FIELDS, "price_source_label", "price_source_url", "activity_category", "category_basis", "prohibited_income", "prohibited_income_source", "prohibited_income_note"];
const decimal = z.string().regex(/^\d{1,24}(?:\.\d{1,6})?$/, "Required nonnegative decimal, maximum six decimal places");
const inputSchema = z.object({
  ticker: z.enum(TICKERS as [string, ...string[]]),
  close_2026_07_31: decimal.refine(v => Number(v) > 0, "Required positive close"),
  close_2026_08_31: decimal.refine(v => Number(v) > 0, "Required positive close"),
  close_2026_09_30: decimal.refine(v => Number(v) > 0, "Required positive close"),
  price_source_label: z.string().trim().min(1).max(500),
  price_source_url: z.url().refine(v => /^https?:\/\//.test(v), "HTTP(S) URL required"),
  activity_category: z.enum(activityCategory.enumValues),
  category_basis: z.string().trim().min(1).max(4000),
  prohibited_income: decimal.or(z.literal("")),
  prohibited_income_source: z.string().max(500),
  prohibited_income_note: z.string().max(4000),
}).strict().superRefine((row, ctx) => {
  if (row.prohibited_income !== "") for (const field of ["prohibited_income_source", "prohibited_income_note"] as const)
    if (!row[field].trim()) ctx.addIssue({ code: "custom", path: [field], message: "Required with a supplied prohibited-income amount" });
});
export type LaunchRow = z.infer<typeof inputSchema>;
export class LaunchInputError extends Error {}

/** Small strict RFC4180 reader: quoted commas/newlines and doubled quotes. */
export function csv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, endedQuote = false;
  const input = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { quoted = false; endedQuote = true; }
      else cell += ch;
    } else if (ch === "," || ch === "\n") {
      row.push(cell); cell = ""; endedQuote = false;
      if (ch === "\n") { rows.push(row); row = []; }
    } else if (ch === '"' && !cell && !endedQuote) quoted = true;
    else if (ch === '"' || endedQuote) throw new LaunchInputError("Malformed quoted CSV field");
    else cell += ch;
  }
  if (quoted) throw new LaunchInputError("Unterminated quoted CSV field");
  if (cell || row.length || endedQuote) rows.push([...row, cell]);
  return rows;
}
export function launchInputs(text: string, universe: string): LaunchRow[] {
  const errors: string[] = [];
  const u = csv(universe);
  if (u[0]?.join() !== "ticker" || JSON.stringify(u.slice(1).map(r => r.join())) !== JSON.stringify(TICKERS))
    errors.push("universe: must contain exactly the founder's ordered 25 tickers");
  const [header, ...rows] = csv(text);
  if (header?.join() !== HEADER.join()) errors.push("inputs: header must match the launch contract exactly");
  if (rows.length !== 25) errors.push("inputs: exactly 25 rows required");
  const result: LaunchRow[] = [];
  rows.forEach((row, index) => {
    if (row.length !== HEADER.length) errors.push(`row ${index + 2}: expected ${HEADER.length} fields`);
    if (row[0] !== TICKERS[index]) errors.push(`row ${index + 2}.ticker: expected ${TICKERS[index] ?? "no extra row"}`);
    const parsed = inputSchema.safeParse(Object.fromEntries(HEADER.map((k, i) => [k, row[i]])));
    if (!parsed.success) {
      const fields = new Set<string>();
      for (const e of parsed.error.issues) {
        const field = e.path.join(".");
        if (!fields.has(field)) errors.push(`row ${index + 2}.${field}: ${e.message}`);
        fields.add(field);
      }
    }
    else result.push(parsed.data);
  });
  if (errors.length) throw new LaunchInputError(errors.join("\n"));
  return result;
}

const caseValues = z.object({
  asOf: z.string().date(), periodEnd: z.string().date(),
  activity_category: z.enum(activityCategory.enumValues),
  interest_bearing_debt: z.number().finite(), market_value_basis: z.number().finite(),
  prohibited_income: z.number().finite(), total_revenue: z.number().finite(),
}).strict();
const criterionKeys = ["primary_activity", "debt", "income"] as const;
const launchSchema = z.object({
  metadata: metadataSchema,
  version: versionSchema,
  criteria: z.array(z.object({ key: z.enum(criterionKeys) }).passthrough()).length(3),
  case_defaults: caseValues,
  cases: z.array(z.object({
    name: z.string(), overrides: caseValues.partial(),
    expected: z.record(z.enum(criterionKeys), z.enum(["pass", "fail", "unknown", "borderline"])),
    status: z.enum(["passes_selected_methodology", "fails_selected_methodology", "requires_review", "insufficient_data"]),
  }).strict()).min(1),
}).strict();
export function launchDefinition(input: unknown) {
  const parsed = launchSchema.parse(input);
  if (parsed.metadata.official_or_inspired !== "adapted" || parsed.metadata.licensing_status !== "public_document" ||
    parsed.version.is_public || parsed.version.version !== "1.0") throw new LaunchInputError("Launch requires adapted public-document unpublished draft 1.0");
  const criteria = parsed.criteria.map(({ key, ...data }) => ({ key, data: criterionSchema.parse(data) }));
  if (new Set(criteria.map(c => c.key)).size !== 3) throw new LaunchInputError("Duplicate criterion keys");
  return { ...parsed, criteria };
}
export type LaunchDefinition = ReturnType<typeof launchDefinition>;
export function launchCases(definition: LaunchDefinition, identities: Record<string, string>): AnalystCase[] {
  return analystCasesSchema.parse(definition.cases.map(c => {
    const v = { ...definition.case_defaults, ...c.overrides };
    return {
      name: c.name,
      inputs: {
        securityId: "launch-analyst-fixture", asOf: v.asOf,
        period: { id: "launch-annual-fixture", label: "Synthetic annual analyst case", periodEnd: v.periodEnd },
        facts: (["interest_bearing_debt", "market_value_basis", "prohibited_income", "total_revenue"] as const).map(lineItem =>
          ({ lineItem, value: v[lineItem], inputState: "reported", confidenceTier: "Verified", sourceId: "synthetic-review-case" })),
        segments: [{ segmentName: "Whole company", activityCategory: v.activity_category, revenueAmount: v.total_revenue,
          revenueShare: 1, inputState: "reported", confidenceTier: "Verified", sourceId: "synthetic-review-case" }],
      },
      expected: { criteria: Object.fromEntries(Object.entries(c.expected).map(([key, value]) => [identities[key], value])), status: c.status },
    };
  })) as AnalystCase[];
}
