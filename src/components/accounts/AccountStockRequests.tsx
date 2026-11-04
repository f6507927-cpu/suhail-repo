"use client";

import { useEffect, useRef, useState } from "react";
import { formatTimestamp } from "@/lib/format";
import type { StockRequestRow } from "@/lib/stock-request-input";
import type { Locale } from "./types";
import { stockRequestText } from "@/i18n/stock-request-copy";

type Props = { locale: Locale; requests: StockRequestRow[] };

export function AccountStockRequests({ locale, requests }: Props) {
  const [visibleRequests, setVisibleRequests] = useState(requests);
  const [pendingQueries, setPendingQueries] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const controllers = useRef(new Map<string, AbortController>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const activeControllers=controllers.current;
    return () => {
      mounted.current = false;
      for (const controller of activeControllers.values()) controller.abort();
      activeControllers.clear();
    };
  }, []);

  const removeRequest = async (query: string) => {
    if (controllers.current.has(query)) return;
    const controller = new AbortController();
    controllers.current.set(query, controller);
    setPendingQueries((current) => new Set(current).add(query));
    setErrors((current) => ({ ...current, [query]: false }));
    let timedOut = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        (async () => {
          const response = await fetch("/api/stock-requests", {
          method: "DELETE",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          body: JSON.stringify({ query }),
          signal: controller.signal,
          });
          const payload = await response.json().catch(() => ({})) as { status?: string };
          return { ok: response.status === 200, payload };
        })(),
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(() => {
            timedOut = true;
            controller.abort();
            reject(new Error("stock_request_remove_timeout"));
          }, 8000);
          controller.signal.addEventListener("abort", () => {
            clearTimeout(deadline);
            reject(new Error("stock_request_remove_cancelled"));
          }, { once: true });
        }),
      ]);
      if (!result.ok || result.payload.status !== "removed") throw new Error("stock_request_remove_failed");
      if (mounted.current && !controller.signal.aborted) {
        setVisibleRequests((current) => current.filter((row) => row.normalized_query !== query));
      }
    } catch {
      if (mounted.current && (!controller.signal.aborted || timedOut)) {
        setErrors((current) => ({ ...current, [query]: true }));
      }
    } finally {
      clearTimeout(deadline);
      if (controllers.current.get(query) === controller) controllers.current.delete(query);
      if (mounted.current) {
        setPendingQueries((current) => {
          const next = new Set(current);
          next.delete(query);
          return next;
        });
      }
    }
  };

  return (
    <section className="grid gap-6 border-b border-border py-9 md:grid-cols-[minmax(0,1fr)_1.15fr]" dir={locale === "ar" ? "rtl" : "ltr"} aria-labelledby="account-stock-requests-heading">
      <div>
        <h2 id="account-stock-requests-heading" className="font-medium">{stockRequestText(locale, "yourRequests")}</h2>
      </div>
      {visibleRequests.length === 0 ? (
        <p className="text-sm text-muted-foreground" role="status">{stockRequestText(locale, "empty")}</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {visibleRequests.map((request) => {
            const pending = pendingQueries.has(request.normalized_query);
            return (
              <li key={request.normalized_query} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                <div className="min-w-0">
                  <bdi dir="auto" className="block break-words font-mono text-sm [unicode-bidi:isolate]">{request.normalized_query}</bdi>
                  <time dateTime={request.created_at} className="mt-1 block text-xs text-muted-foreground">
                    <bdi dir="ltr" className="font-mono tabular-nums">{formatTimestamp(request.created_at,locale,{year:"numeric",month:"long",day:"numeric"})}</bdi>
                  </time>
                  {errors[request.normalized_query] && (
                    <p className="mt-1 text-xs text-foreground" role="alert">{stockRequestText(locale, "error")}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void removeRequest(request.normalized_query)}
                  className="inline-flex min-h-11 shrink-0 items-center px-3 text-sm text-foreground underline underline-offset-4 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-busy={pending}
                >
                  {stockRequestText(locale, "remove")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
