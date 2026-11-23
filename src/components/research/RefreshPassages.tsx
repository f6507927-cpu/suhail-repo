import type { PacketChange } from "@/ai/research/changes";
import type { Locale } from "../accounts/types";
import { reviewText } from "./research-ui";

export type Passage = { location: string; ar: string; en: string; cites?: string[]; covers?: string[] };
function references(slot: Passage | undefined) {
  return new Set(slot ? [...(slot.cites ?? []), ...(slot.covers ?? []),
    ...[...`${slot.ar}\n${slot.en}`.matchAll(/\{\{(?:fig|cite):([^{}]+)\}\}/g)].map(match => match[1])] : []);
}
function markedText(before: string, after: string) {
  const old = before.split(/(\s+)/u), next = after.split(/(\s+)/u);
  let start = 0, end = 0;
  while (start < Math.min(old.length, next.length) && old[start] === next[start]) start++;
  while (end < Math.min(old.length, next.length) - start &&
    old[old.length - 1 - end] === next[next.length - 1 - end]) end++;
  const removed = old.slice(start, old.length - end).join("");
  const added = next.slice(start, next.length - end).join("");
  return <>{next.slice(0, start).join("")}{added && <mark className="bg-primary/15 text-foreground">{added}</mark>}
    {removed && <del className="text-muted-foreground">{removed}</del>}{end > 0 && next.slice(-end).join("")}</>;
}
export function RefreshPassages({ locale, changes, previous, current, label }: {
  locale: Locale; changes: PacketChange[]; previous: Passage[]; current: Passage[]; label: (location: string) => string;
}) {
  const old = new Map(previous.map(slot => [slot.location, slot]));
  const next = new Map(current.map(slot => [slot.location, slot]));
  const entries = [...new Set([...next.keys(), ...old.keys()])].flatMap(location => {
    const before = old.get(location), after = next.get(location);
    const refs = new Set([...references(before), ...references(after)]);
    const evidence = changes.filter(change => refs.has(change.item_id));
    return evidence.length || before?.ar !== after?.ar || before?.en !== after?.en ? [{ location, before, after, evidence }] : [];
  });
  return <section aria-labelledby="refresh-passages-title" className="mb-6 border border-border bg-card p-4 sm:p-6">
    <h2 id="refresh-passages-title" className="text-xl font-semibold">{reviewText(locale, "Changed passages")}</h2>
    <p className="mt-2 text-sm text-muted-foreground">{reviewText(locale, "Compared with the last approved draft. Full-text validation still applies.")}</p>
    {entries.length ? <ul className="mt-3 space-y-3">{entries.map(({ location, before, after, evidence }) =>
      <li key={location} className="border-s-2 border-primary bg-secondary/30 p-3" data-refresh-passage>
        <h3 className="mb-2 text-sm font-medium">{reviewText(locale, label(location))}</h3>
        {(["ar", "en"] as const).map(lang => <p key={lang} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}
          className="break-words text-sm leading-7">{markedText(before?.[lang] ?? "", after?.[lang] ?? "")}</p>)}
        {!!evidence.length && <p className="mt-2 break-all text-xs text-muted-foreground">{reviewText(locale, "Changed evidence")}:{" "}
          <bdi dir="ltr" className="font-mono">{evidence.map(change => change.item_id).join(", ")}</bdi></p>}
      </li>)}</ul> : <p className="mt-3 text-sm">{reviewText(locale, "No passages changed.")}</p>}
    <details className="mt-3 border-t border-border">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{reviewText(locale, "Packet changes")} ({changes.length})</summary>
      <ul className="space-y-2">{changes.map(change => <li key={change.item_id} className="border border-border p-3 text-sm">
        <bdi dir="ltr" className="break-all font-mono">{change.item_id}</bdi>
        <p className="mt-1 break-words"><bdi>{displayValue(change.old_value)}</bdi> → <bdi>{displayValue(change.new_value)}</bdi></p>
      </li>)}</ul>
    </details>
  </section>;
}
function displayValue(value: PacketChange["old_value"]) {
  return value === null ? "—" : typeof value === "boolean" ? String(value) :
    `${value.value === null ? "—" : String(value.value)} · ${value.date} · ${value.source.label}`;
}
