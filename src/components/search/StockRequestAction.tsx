"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserAuth } from "@/lib/auth/browser";
import { localePath } from "@/lib/auth/paths";
import type { AuthSession, BrowserAuth, Locale } from "@/components/accounts/types";
import { stockRequestText } from "@/i18n/stock-request-copy";

type Props = { locale: Locale; query: string };
type RequestState = "idle" | "posting" | "created" | "duplicate" | "limit" | "error";

export function StockRequestAction(props:Props) {
  // A different query owns fresh state; no synchronous effect-driven reset.
  return <StockRequestForQuery key={`${props.locale}:${props.query}`} {...props}/>;
}
function StockRequestForQuery({ locale, query }: Props) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const generation = useRef(0);
  const authRef = useRef<BrowserAuth | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const sessionUserRef=useRef<string|null>(null);

  const getBrowserAuth = useCallback(() => {
    if (!authRef.current) authRef.current = createBrowserAuth() as unknown as BrowserAuth | null;
    return authRef.current;
  }, []);

  useEffect(() => {
    const auth = getBrowserAuth();
    let active = true;
    let authEventSequence = 0;
    const sequenceAtSnapshotStart = authEventSequence;

    const syncSession = (nextSession: AuthSession | null) => {
      if (!active) return;
      const validSession=nextSession?.access_token && nextSession.user?.id ? nextSession : null;
      const userId=validSession?.user.id??null;
      if(userId!==sessionUserRef.current){
        sessionUserRef.current=userId;
        generation.current += 1;
        requestRef.current?.abort();
        requestRef.current = null;
        setRequestState("idle");
      }
      setSession(validSession);
    };

    if (!auth) {
      return () => {
        active = false;
        generation.current += 1;
        requestRef.current?.abort();
        requestRef.current = null;
      };
    }

    const { data: { subscription } } = auth.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      authEventSequence += 1;
      syncSession(nextSession);
    });
    void auth.auth.getSession().then(({ data }) => {
      if (active && authEventSequence === sequenceAtSnapshotStart) {
        syncSession(data.session);
      }
    }).catch(() => {
      if (active && authEventSequence === sequenceAtSnapshotStart) syncSession(null);
    });

    return () => {
      active = false;
      generation.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
      subscription.unsubscribe();
    };
  }, [getBrowserAuth]);

  const submitRequest = async () => {
    if (!session || requestState === "posting" || requestState === "created" || requestState === "duplicate") return;

    const requestGeneration = ++generation.current;
    const userId = session.user.id;
    const requestQuery = query;
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    let timedOut = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const isCurrent = () =>
      generation.current === requestGeneration &&
      requestRef.current === controller &&
      session?.user.id === userId &&
      query === requestQuery;

    setRequestState("posting");
    try {
      const result = await Promise.race([
        (async () => {
          const response = await fetch("/api/stock-requests", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          body: JSON.stringify({ query: requestQuery }),
          signal: controller.signal,
          });
          const payload = await response.json().catch(() => ({})) as { status?: string };
          return { status: response.status, payload };
        })(),
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(() => {
            timedOut = true;
            controller.abort();
            reject(new Error("stock_request_timeout"));
          }, 8000);
          controller.signal.addEventListener("abort", () => {
            clearTimeout(deadline);
            reject(new Error("stock_request_cancelled"));
          }, { once: true });
        }),
      ]);
      if (!isCurrent()) return;

      if (result.status === 401) {
        generation.current += 1;
        setSession(null);
        setRequestState("idle");
      } else if (result.status === 201 && result.payload.status === "created") {
        setRequestState("created");
      } else if (result.status === 200 && result.payload.status === "already_requested") {
        setRequestState("duplicate");
      } else if (result.status === 409 && result.payload.status === "limit_reached") {
        setRequestState("limit");
      } else {
        setRequestState("error");
      }
    } catch {
      if (isCurrent() && (!controller.signal.aborted || timedOut)) setRequestState("error");
    } finally {
      clearTimeout(deadline);
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  const nextPath = () => {
    if (typeof window !== "undefined" && window.location.pathname.endsWith("/search")) {
      return `${window.location.pathname}${window.location.search}`;
    }
    return `${localePath(locale, "/search")}?q=${encodeURIComponent(query)}`;
  };

  const feedback = requestState === "created"
    ? stockRequestText(locale, "saved")
    : requestState === "duplicate"
      ? stockRequestText(locale, "duplicate")
      : requestState === "limit"
        ? stockRequestText(locale, "limit")
        : requestState === "error"
          ? stockRequestText(locale, "error")
          : "";

  if (!session) {
    return (
      <div className="mt-4">
        <a
          href={`${localePath(locale,"/auth/sign-in")}?next=${encodeURIComponent(`${localePath(locale,"/search")}?q=${encodeURIComponent(query)}`)}`}
          onClick={(event) => {
            event.currentTarget.href=`${localePath(locale,"/auth/sign-in")}?next=${encodeURIComponent(nextPath())}`;
          }}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground underline-offset-4 hover:bg-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {stockRequestText(locale, "signIn")}
        </a>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2" dir={locale === "ar" ? "rtl" : "ltr"} aria-busy={requestState === "posting"}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => void submitRequest()}
          disabled={requestState === "posting" || requestState === "created" || requestState === "duplicate"}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {requestState === "created" || requestState === "duplicate"
            ? stockRequestText(locale, "requested")
            : stockRequestText(locale, "request")}
        </button>
        <p className="text-sm text-muted-foreground">{stockRequestText(locale, "priority")}</p>
      </div>
      <p className="text-sm text-muted-foreground" role={requestState==="error"?"alert":"status"} aria-live="polite" aria-atomic="true">{feedback}</p>
    </div>
  );
}
