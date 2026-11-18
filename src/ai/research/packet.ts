import { canonicalize, compareCodePoints, hash } from "../../engine/canonical";
import type { JsonValue } from "../../engine/types";
import { PACKET_VERSION, clockSchema, packetInputSchema, type PacketItem, type ResearchPacket, type Source } from "./contracts";
import { decimalCalculation } from "./decimal";
import { assertPacketPrivacy } from "./privacy";

export const FINANCIAL_FIELDS = [
  "total_revenue", "net_income", "gross_profit", "operating_income",
  "interest_bearing_debt", "total_equity", "operating_cash_flow",
  "investing_cash_flow", "financing_cash_flow", "market_cap",
] as const;
const derivedSource: Source = { id: "code:research-packet-1", label: "Suhail deterministic calculation",
  url: null, accession: null, is_synthetic: false, production_blocked: false };
function safeSource(source: Source) {
  if (source.is_synthetic || source.production_blocked) throw new Error("Ineligible research source");
}
function unique(keys: string[], label: string) {
  if (new Set(keys).size !== keys.length) throw new Error(`Duplicate ${label}`);
}
function json(value: unknown): JsonValue { return JSON.parse(JSON.stringify(value)) as JsonValue; }
export function packetHash(packet: Omit<ResearchPacket, "packet_hash"> | ResearchPacket) {
  // D-189: clocks never alter an unchanged evidence hash.
  const { built_at: _clock, packet_hash: _hash, ...evidence } = packet as ResearchPacket;
  void _clock; void _hash;
  return hash(json(evidence));
}
/** D-189: plain whitelisted rows only; no IO, ambient clock, or synthetic bypass. */
export function buildResearchPacket(rows: unknown, clock: string): ResearchPacket {
  clockSchema.parse(clock);
  const input = packetInputSchema.parse(rows);
  assertPacketPrivacy(input);
  const items: PacketItem[] = [];
  const put = (item: PacketItem) => {
    safeSource(item.source);
    if (item.date > clock.slice(0, 10)) throw new Error("Evidence is newer than packet clock");
    items.push(item);
  };
  const identity = input.security;
  safeSource(identity.source);
  for (const [field, value] of Object.entries({ name: identity.name, ticker: identity.ticker, sic: identity.sic, activity: identity.activity }))
    put({ id: `id.${field}`, kind: "identity", value, unit: "text", date: identity.date, period: null,
      source: identity.source, confidence_tier: identity.confidence_tier,
      unavailable: value === null ? `${field} not recorded` : null, derivation: null });
  unique(input.periods.map(p => p.id), "period");
  const annual = input.periods.filter(p => p.annual).sort((a, b) => compareCodePoints(b.period_end, a.period_end)).slice(0, 2);
  unique(annual.map(p => p.period_end), "annual period end");
  for (const p of annual) {
    if (p.reported_date > clock.slice(0, 10)) throw new Error("Future annual filing");
    unique(p.facts.map(f => f.field), "current fact");
    for (const field of FINANCIAL_FIELDS) {
      const f = p.facts.find(f => f.field === field);
      const value = f?.value ?? null;
      put({ id: `fin.${field}.${p.id}`, kind: "financial", value, unit: f?.unit ?? "unavailable", date: f?.date ?? p.period_end, period: p.id,
        source: f?.source ?? derivedSource, confidence_tier: f?.confidence_tier ?? "Calculated",
        unavailable: value === null ? f?.unavailable_reason ?? "No stored value" : null, derivation: null });
    }
  }
  if (!annual.length) put({ id: "fin.annual", kind: "financial", value: null, unit: "date", date: identity.date,
    period: null, source: derivedSource, confidence_tier: "Calculated", unavailable: "No annual period", derivation: null });
  if (annual.length < 2) put({ id: "fin.prior_annual", kind: "financial", value: null, unit: "date", date: identity.date,
    period: null, source: derivedSource, confidence_tier: "Calculated", unavailable: "No prior annual period", derivation: null });
  const runs = input.runs.filter(r => r.production_enabled)
    .sort((a, b) => Date.parse(b.run_at) - Date.parse(a.run_at) || compareCodePoints(b.immutable_hash, a.immutable_hash));
  unique(runs.map(r => `${r.methodology}:${Date.parse(r.run_at)}`), "stored run timestamp");
  const selected = [...new Map([...runs].reverse().map(r => [r.methodology, r])).values()]
    .sort((a, b) => compareCodePoints(a.methodology, b.methodology));
  for (const r of selected) {
    safeSource(r.source);
    if (Date.parse(r.run_at) > Date.parse(clock)) throw new Error("Future screening run");
    const fields: [string, string | number | null, string][] = [
      ["status", r.status, "status"], ["version", r.version, "text"], ["label", r.methodology_label, "text"],
      ["engine_version", r.engine_version, "text"], ["calculation_version", r.calculation_version, "text"],
      ["immutable_hash", r.immutable_hash, "text"], ["data_as_of", r.data_as_of, "date"],
    ];
    unique(r.criteria.map(c => c.id), "criterion");
    unique(r.unknowns.map(u => u.id), "screening unknown");
    for (const c of r.criteria) for (const field of ["result", "ratio", "threshold", "numerator", "denominator"] as const)
      fields.push([`${c.id}.${field}`, c[field], field === "result" ? "result"
        : field === "numerator" ? c.numerator_unit : field === "denominator" ? c.denominator_unit : c.unit]);
    for (const u of r.unknowns) fields.push([`unknown.${u.id}`, u.explanation, "text"]);
    for (const reason of r.reasons) {
      const id = hash(json({ kind: reason.kind, criterionId: reason.criterionId, field: reason.field, reasonCode: reason.reasonCode }));
      fields.push([`reason.${id}`, JSON.stringify(canonicalize(json(reason))), "text"]);
    }
    for (const [field, value, unit] of fields)
      put({ id: `scr.${r.methodology}.${field}`, kind: "screening", value, unit, date: r.data_as_of, period: null,
        source: r.source, confidence_tier: r.confidence_tier,
        unavailable: value === null ? "Not present in stored run" : null, derivation: null });
  }
  if (!selected.length) put({ id: "scr.status", kind: "screening", value: null, unit: "status", date: identity.date,
    period: null, source: derivedSource, confidence_tier: "Calculated", unavailable: "No production-enabled methodology run", derivation: null });
  unique(input.prices.map(p => p.month_end_for), "month-end close");
  for (const p of input.prices) put({ id: `px.close.${p.month_end_for}`, kind: "price", value: p.close, unit: p.currency,
    date: p.date, period: p.month_end_for, source: p.source, confidence_tier: p.confidence_tier, unavailable: null, derivation: null });
  if (!input.prices.length) put({ id: "px.close", kind: "price", value: null, unit: "USD", date: identity.date,
    period: null, source: derivedSource, confidence_tier: "Calculated", unavailable: "No stored month-end close", derivation: null });
  // D-189/D-215: explicit closed list; no invented cash flows or free-form formulas.
  const latest = annual[0], prior = annual[1];
  const fid = (field: string, id?: string) => `fin.${field}.${id ?? "missing"}`;
  const derive = (id: string, inputs: string[], formula: string, op: "ratio" | "growth" | "identity", multiplier = 1) => {
    const values = inputs.map(id => items.find(i => i.id === id));
    const missing = values.some(i => !i || i.unavailable || typeof i.value !== "number" || i.value === 0)
      || new Set(values.filter(Boolean).map(i => i!.unit)).size > 1;
    const a = values[0]?.value as number, b = values[1]?.value as number;
    const value = missing ? null : op === "identity" ? a : decimalCalculation(a, b, op, multiplier);
    put({ id: `drv.${id}`, kind: "derived", value, unit: multiplier === 100 ? "percent" : op === "identity" ? values[0]?.unit ?? "unavailable" : "ratio",
      date: latest?.period_end ?? identity.date, period: latest?.id ?? null, source: derivedSource,
      confidence_tier: values.some(i => i?.confidence_tier === "Estimated") ? "Estimated" : "Calculated",
      unavailable: missing ? "Missing or zero derivation input" : null,
      derivation: { formula, inputs, rounding: op === "identity" ? "stored value unchanged" : "6 decimal places, half away from zero" } });
  };
  derive("revenue_growth", [fid("total_revenue", latest?.id), fid("total_revenue", prior?.id)], "(current revenue - prior revenue) / prior revenue * 100", "growth", 100);
  for (const [id, field] of [["net_margin", "net_income"], ["gross_margin", "gross_profit"], ["operating_margin", "operating_income"]] as const)
    derive(id, [fid(field, latest?.id), fid("total_revenue", latest?.id)], `${field} / total_revenue * 100`, "ratio", 100);
  derive("debt_to_equity", [fid("interest_bearing_debt", latest?.id), fid("total_equity", latest?.id)], "interest_bearing_debt / total_equity", "ratio");
  for (const field of ["operating_cash_flow", "investing_cash_flow", "financing_cash_flow"])
    derive(field, [fid(field, latest?.id)], `stored ${field}`, "identity");
  items.sort((a, b) => compareCodePoints(a.id, b.id));
  unique(items.map(i => i.id), "packet item");
  const packet: ResearchPacket = {
    packet_schema_version: PACKET_VERSION, built_at: clock, packet_hash: "",
    security: { id: identity.id, ticker: identity.ticker, name: identity.name, covered: identity.covered, in_universe: identity.in_universe },
    items, sections: { identity: [], financial: [], screening: [], price: [], derived: [] },
    screenings: selected.map(r => ({ methodology: r.methodology, label: r.methodology_label, version: r.version,
      status: r.status, data_as_of: r.data_as_of, run_at: r.run_at, immutable_hash: r.immutable_hash,
      engine_version: r.engine_version, calculation_version: r.calculation_version, reasons: r.reasons })),
    periods: annual.map(({ id, period_end, reported_date }) => ({ id, period_end, reported_date })),
  };
  for (const item of items) packet.sections[item.kind].push(item.id);
  packet.packet_hash = packetHash(packet);
  assertPacketPrivacy(packet);
  return canonicalize(json(packet)) as unknown as ResearchPacket;
}
