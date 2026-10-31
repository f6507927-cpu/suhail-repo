"use client";

import { reviewText } from "@/components/accounts/types";
import { LocalizedText } from "@/components/foundation/shared";

type Props = {
  rows: { query: string; count: number }[];
  locale: "ar" | "en";
};

export function UnmetSearchPanel({ rows, locale }: Props) {
  const topRows = rows.slice(0, 20);

  return (
    <section className="border border-border bg-card" aria-labelledby="unmet-searches-heading">
      <header className="border-b border-border px-5 py-4">
        <h2 id="unmet-searches-heading" className="text-base font-semibold">
          <LocalizedText>{reviewText(locale, "Unmet searches")}</LocalizedText>
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          <LocalizedText>{reviewText(locale, "Top 20 normalized queries · anonymous daily counts only")}</LocalizedText>
        </p>
      </header>
      <div className="p-5">
        {topRows.length === 0 ? (
          <div className="border border-dashed border-border px-5 py-8 text-center">
            <p className="text-sm font-medium">
              <LocalizedText>{reviewText(locale, "No unmet searches have been recorded yet.")}</LocalizedText>
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              <LocalizedText>{reviewText(locale, "Queries appear here when a public search returns no matches.")}</LocalizedText>
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-border border-y border-border">
            {topRows.map((row) => (
              <li key={row.query} className="flex min-h-12 items-center justify-between gap-4 py-3 text-sm">
                <bdi dir="auto" className="min-w-0 break-words text-start [unicode-bidi:isolate]">
                  {row.query}
                </bdi>
                <bdi dir="ltr" className="shrink-0 font-mono tabular-nums text-muted-foreground [unicode-bidi:isolate]">
                  {row.count}
                </bdi>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
