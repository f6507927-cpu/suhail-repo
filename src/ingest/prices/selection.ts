export type StoredClose = {
  id: string; created_at: Date | string; date: string; month_end_for: string | null;
  close: number | null; currency: string | null; source_id: string | null;
  price_provider?: string; source_label?: string | null; source_url?: string | null;
};
/** D-153: manual correction order is unchanged *within* the manual tier. */
export function compareStoredCloses(a: StoredClose, b: StoredClose) {
  return Number(a.price_provider === "API Ninjas") - Number(b.price_provider === "API Ninjas") ||
    +new Date(b.created_at) - +new Date(a.created_at) || b.id.localeCompare(a.id);
}
export function selectStoredMonth<T extends StoredClose>(prices: T[], month: string) {
  return prices.filter(p => p.month_end_for === month && p.date.slice(0, 7) === month.slice(0, 7) &&
    p.date <= month).sort(compareStoredCloses)[0];
}
export function latestStoredClose<T extends StoredClose>(prices: T[]) {
  const eligible = prices.filter(p => p.month_end_for &&
    /^\d{4}-\d{2}-\d{2}$/.test(p.month_end_for) &&
    new Date(`${p.month_end_for}T00:00Z`).getUTCDate() ===
      new Date(Date.UTC(Number(p.month_end_for.slice(0, 4)), Number(p.month_end_for.slice(5, 7)), 0)).getUTCDate() &&
    p.date.slice(0, 7) === p.month_end_for.slice(0, 7) && p.date <= p.month_end_for);
  const month = eligible.map(p => p.month_end_for!).sort().at(-1);
  if (!month) return null;
  const selected = selectStoredMonth(eligible, month);
  return selected?.source_id && selected.close !== null && Number.isFinite(selected.close) &&
    selected.close > 0 && selected.currency === "USD" ? selected : null;
}
