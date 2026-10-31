interface Fact {
  id: string; company_id: string; period_id: string; line_item: string;
  origin: string; value: number | null; is_current: boolean;
  protected_current: boolean; sec_baseline_id: string | null;
}
/** Newest-first persisted SEC history; compare against SEC at correction, not the correction's value. */
export function annotateSecChanges<T extends Fact>(facts: T[]): (T & { sec_changed: boolean })[] {
  const byId = new Map(facts.map(f => [f.id, f]));
  const latest = new Map<string, T>();
  const key = (f: Fact) => `${f.company_id}/${f.period_id}/${f.line_item}`;
  for (const f of facts) if (f.origin === "sec" && !latest.has(key(f))) latest.set(key(f), f);
  return facts.map(f => {
    const incoming = latest.get(key(f)), baseline = f.sec_baseline_id ? byId.get(f.sec_baseline_id) : f;
    return { ...f, sec_changed: f.is_current && f.protected_current && !!incoming && incoming.value !== baseline?.value };
  });
}
