import { decimal } from "../../engine/math";
import type { ResearchPacket } from "./contracts";

export const STALE_REASONS = ["new_filing", "status_changed", "price_moved", "aged"] as const;
export type StaleReason = typeof STALE_REASONS[number];
export type FilingDates = Pick<ResearchPacket["periods"][number], "period_end" | "reported_date">;
type Close = { period: string; value: number; currency: string };
type Run = Pick<ResearchPacket["screenings"][number], "methodology" | "immutable_hash" | "status">;
export function packetClose(packet: ResearchPacket): Close | null {
  const latest = packet.items.filter(item => item.kind === "price" && item.period && typeof item.value === "number")
    .reduce<typeof packet.items[number] | null>((best, item) => !best || item.period! > best.period! ? item : best, null);
  return latest && { period: latest.period!, value: latest.value as number, currency: latest.unit };
}
export function exceedsPriceMove(before: number, after: number, percent: number) {
  if (before <= 0 || after <= 0 || percent <= 0 || ![before, after, percent].every(Number.isFinite)) return false;
  const a = decimal(before), b = decimal(after), t = decimal(percent);
  const scale = Math.max(a.scale, b.scale);
  const base = a.coefficient * 10n ** BigInt(scale - a.scale);
  const delta = b.coefficient * 10n ** BigInt(scale - b.scale) - base;
  // Compare unrounded values; equality does not exceed the configured threshold.
  return (delta < 0n ? -delta : delta) * 100n * 10n ** BigInt(Math.max(t.scale, 0)) >
    base * t.coefficient * 10n ** BigInt(Math.max(-t.scale, 0));
}
export function detectStaleness(packet: ResearchPacket, latest: {
  filings: readonly FilingDates[]; runs: readonly Run[]; close: Close | null;
}, settings: { price_move_threshold_percent: number | null; publication_age_days: number | null },
approvedAt: Date, now: Date): StaleReason[] {
  const reasons: StaleReason[] = [];
  // Legacy packets contain annual periods only. P3 snapshots also carry sourced
  // filing dates, so approving a refresh acknowledges a newer interim filing.
  const known = [...packet.periods, ...(packet.filings ?? [])];
  if (latest.filings.some(filing => !known.some(p => p.period_end >= filing.period_end)
    || !known.some(p => p.reported_date >= filing.reported_date))) reasons.push("new_filing");
  const runs = new Map(packet.screenings.map(run => [run.methodology, run]));
  if (latest.runs.length !== runs.size || latest.runs.some(run => {
    const previous = runs.get(run.methodology);
    return previous?.status !== run.status || previous.immutable_hash !== run.immutable_hash;
  })) reasons.push("status_changed");
  const before = packetClose(packet), after = latest.close, threshold = settings.price_move_threshold_percent;
  if (before && after && threshold !== null && before.currency === after.currency && after.period >= before.period &&
    exceedsPriceMove(before.value, after.value, threshold)) reasons.push("price_moved");
  if (settings.publication_age_days != null && +now - +approvedAt > settings.publication_age_days * 86_400_000) reasons.push("aged");
  return reasons;
}

export const PASSING = "passes_selected_methodology";
export function analystViewRequired(latest: { status: string; version_id: string; stop_id: string | null } | undefined,
  flag?: { analyst_view_review_required: boolean; cleared_version_id: string | null; cleared_stop_id: string | null }) {
  return latest?.status !== PASSING || !!flag?.analyst_view_review_required ||
    (latest.stop_id !== null && !(flag?.cleared_version_id === latest.version_id && flag.cleared_stop_id === latest.stop_id));
}
