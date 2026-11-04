"use client";

import { reviewText } from "@/components/accounts/types";
import { LocalizedText } from "@/components/foundation/shared";

type Props = {
  rows: { query: string; count: number; requests?: number }[];
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
          <div className="overflow-x-auto">
            <table className="w-full border-y border-border text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs text-muted-foreground">
                  <th scope="col" className="py-3 pe-4 font-medium"><LocalizedText>{reviewText(locale, "Normalized query")}</LocalizedText></th>
                  <th scope="col" className="px-3 py-3 text-end font-medium"><LocalizedText>{reviewText(locale, "Searches")}</LocalizedText></th>
                  <th scope="col" className="ps-3 py-3 text-end font-medium"><LocalizedText>{reviewText(locale, "Requests")}</LocalizedText></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topRows.map((row) => (
                  <tr key={row.query}>
                    <td className="py-3 pe-4">
                      <bdi dir="auto" className="block min-w-0 break-words text-start [unicode-bidi:isolate]">{row.query}</bdi>
                    </td>
                    <td className="px-3 py-3 text-end">
                      <bdi dir="ltr" className="font-mono tabular-nums text-muted-foreground [unicode-bidi:isolate]">{row.count}</bdi>
                    </td>
                    <td className="ps-3 py-3 text-end">
                      <bdi dir="ltr" className="font-mono tabular-nums text-muted-foreground [unicode-bidi:isolate]">{row.requests ?? 0}</bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              <LocalizedText>{reviewText(locale, "Search counts are anonymous; requests count distinct users.")}</LocalizedText>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
