import { hash } from "../../engine/canonical";
import type { JsonValue } from "../../engine/types";
import type { PacketItem, ResearchPacket } from "./contracts";
import { decimalCalculation } from "./decimal";

export interface PacketChange {
  item_id: string;
  type: "added" | "removed" | "changed";
  old_value: PacketItem | boolean | null;
  new_value: PacketItem | boolean | null;
  trigger: "new_filing" | "status_change" | "price_move" | "age";
}
function fingerprint(item: PacketItem) { return hash(JSON.parse(JSON.stringify(item)) as JsonValue); }
/** D-211: only describes changes; it never queues work or changes a screening. */
export function compareResearchPackets(oldPacket: ResearchPacket, newPacket: ResearchPacket, settings?: {
  price_move_percent: number;
  max_age_days: number;
  reference_date: string;
}): PacketChange[] {
  if (oldPacket.security.id !== newPacket.security.id) throw new Error("Cannot compare different securities");
  if (settings && (!Number.isFinite(settings.price_move_percent) || settings.price_move_percent < 0
    || !Number.isFinite(settings.max_age_days) || settings.max_age_days <= 0
    || !Number.isFinite(Date.parse(settings.reference_date)))) throw new Error("Invalid comparison settings");
  const oldItems = new Map(oldPacket.items.map(i => [i.id, i]));
  const newItems = new Map(newPacket.items.map(i => [i.id, i]));
  const result: PacketChange[] = [];
  for (const id of [...new Set([...oldItems.keys(), ...newItems.keys()])].sort()) {
    const before = oldItems.get(id), after = newItems.get(id);
    if (before && after && fingerprint(before) === fingerprint(after)) continue;
    if (settings && before?.kind === "price" && after?.kind === "price"
      && typeof before.value === "number" && before.value !== 0 && typeof after.value === "number"
      && Math.abs(decimalCalculation(after.value, before.value, "growth", 100)) <= settings.price_move_percent) continue;
    result.push({ item_id: id, type: !before ? "added" : !after ? "removed" : "changed",
      old_value: before ?? null, new_value: after ?? null,
      trigger: (after ?? before)?.kind === "price" ? "price_move"
        : (after ?? before)?.kind === "screening" ? "status_change" : "new_filing" });
  }
  if (settings) {
    const ageAt = (date: string) => (Date.parse(date) - Date.parse(settings.reference_date)) / 86_400_000 > settings.max_age_days;
    const before = ageAt(oldPacket.built_at), after = ageAt(newPacket.built_at);
    if (before !== after) result.push({ item_id: "packet.age", type: "changed", old_value: before, new_value: after, trigger: "age" });
  }
  return result;
}
