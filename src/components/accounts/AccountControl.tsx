"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { createBrowserAuth } from "@/lib/auth/browser";
import { localePath } from "@/lib/auth/paths";
import { LogOut, Shield, UserRound } from "lucide-react";
import type { AccountProfile, AuthSession, BrowserAuth, Locale } from "./types";
import { initials, reviewText } from "./types";

type Props = { locale: Locale };

export function AccountControl({ locale }: Props) {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const generation = useRef(0);
  const authRef = useRef<BrowserAuth | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const resyncRef = useRef<((session: AuthSession | null) => Promise<void>) | null>(null);
  const getBrowserAuth = useCallback(() => {
    if (!authRef.current) authRef.current = createBrowserAuth() as unknown as BrowserAuth | null;
    return authRef.current;
  }, []);
  const copy = {
    signIn: reviewText(locale, "Sign in"),
    account: reviewText(locale, "Account"),
    admin: reviewText(locale, "Admin"),
    signOut: reviewText(locale, "Sign out"),
    signingOut: reviewText(locale, "Signing out"),
    signOutError: reviewText(locale, "Could not sign out. Please try again."),
  };

  useEffect(() => {
    const auth = getBrowserAuth();
    if (!auth) {
      setProfile(null);
      setError(null);
      setBusy(false);
      return;
    }
    let active = true;
    let authEventSequence = 0;

    const syncSession = async (session: AuthSession | null) => {
      const requestGeneration = ++generation.current;
      requestRef.current?.abort();
      requestRef.current = null;
      setProfile(null);
      setError(null);
      setBusy(true);
      if (!session?.access_token || !session.user?.id) {
        setBusy(false);
        return;
      }

      const requestController = new AbortController();
      requestRef.current = requestController;
      let timedOut = false;
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        const profileRequest = async () => {
          const response = await fetch("/api/account/profile", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          signal: requestController.signal,
          headers: { "Cache-Control": "no-store" },
          });
          if (!response.ok) throw new Error("profile_unavailable");
          return (await response.json()) as AccountProfile | { profile: AccountProfile };
        };
        // The deadline covers headers AND body consumption, including transports
        // that don't settle promptly on abort. Cancellation never owns a newer
        // generation's timer or state.
        const payload = await Promise.race([
          profileRequest(),
          new Promise<never>((_resolve, reject) => {
            deadline = setTimeout(() => {
              timedOut = true;
              requestController.abort();
              reject(new Error("profile_timeout"));
            }, 8000);
            requestController.signal.addEventListener("abort", () => {
              clearTimeout(deadline);
              reject(new Error("profile_cancelled"));
            }, { once: true });
          }),
        ]);
        const candidate = "profile" in payload ? payload.profile : payload;
        if (
          typeof candidate?.id !== "string" ||
          candidate.id !== session.user.id ||
          (candidate.role !== "admin" && candidate.role !== "editor" && candidate.role !== "user")
        ) {
          throw new Error("profile_session_mismatch");
        }
        const safeProfile: AccountProfile = {
          id: candidate.id,
          full_name: typeof candidate.full_name === "string" ? candidate.full_name : null,
          role: candidate.role,
        };
        if (active && !requestController.signal.aborted && generation.current === requestGeneration) setProfile(safeProfile);
      } catch {
        if (active && (timedOut || !requestController.signal.aborted) && generation.current === requestGeneration) {
          setError(reviewText(locale, "Profile is temporarily unavailable."));
        }
      } finally {
        clearTimeout(deadline);
        if (requestRef.current === requestController) requestRef.current = null;
        if (active && generation.current === requestGeneration) setBusy(false);
      }
    };
    resyncRef.current = syncSession;

    const sequenceAtSnapshotStart = authEventSequence;
    const { data: { subscription } } = auth.auth.onAuthStateChange((_event, session) => {
      authEventSequence += 1;
      void syncSession(session as AuthSession | null);
    });
    void auth.auth.getSession().then(({ data }) => {
      if (active && authEventSequence === sequenceAtSnapshotStart) {
        void syncSession(data.session as AuthSession | null);
      }
    }).catch(() => {
      if (active && authEventSequence === sequenceAtSnapshotStart) {
        setProfile(null);
        setBusy(false);
      }
    });

    return () => {
      active = false;
      generation.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
      resyncRef.current = null;
      subscription.unsubscribe();
    };
  }, [getBrowserAuth, locale]);

  const handleSignOut = async () => {
    const auth = getBrowserAuth();
    if (!auth) return;
    generation.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    setProfile(null);
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(localePath(locale, "/auth/sign-out"), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("sign_out_failed");
      const { error: localSignOutError } = await auth.auth.signOut();
      if (localSignOutError) throw localSignOutError;
      window.location.assign(localePath(locale, "/"));
    } catch {
      setBusy(false);
      void auth.auth.getSession().then(async ({ data }) => {
        await resyncRef.current?.(data.session as AuthSession | null);
        setError(copy.signOutError);
      }).catch(() => {
        setProfile(null);
        setBusy(false);
        setError(copy.signOutError);
      });
    }
  };

  if (busy && !profile) {
    return (
      <span
        aria-label={reviewText(locale, "Checking account")}
        className="inline-block size-9 animate-pulse rounded-full bg-secondary"
      />
    );
  }

  if (!profile) {
    return (
      <div className="relative">
        <Link
          href="/auth/sign-in"
          prefetch={false}
          onClick={(event) => {
            event.preventDefault();
            const next = `${window.location.pathname}${window.location.search}`;
            router.push(`/auth/sign-in?next=${encodeURIComponent(next)}` as never);
          }}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground hover:bg-secondary"
        >
          <UserRound aria-hidden="true" size={17} strokeWidth={1.6} />
          {copy.signIn}
        </Link>
        {error && <p className="mt-2 max-w-56 text-xs text-foreground" role="status">{error}</p>}
      </div>
    );
  }

  const canAdmin = profile.role === "admin" || profile.role === "editor";
  return (
    <div className="relative flex items-center gap-2" dir={locale === "ar" ? "rtl" : "ltr"}>
      <details className="group relative">
        <summary
          aria-label={reviewText(locale, "Open account menu")}
          className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full border border-border bg-secondary text-sm font-semibold text-foreground outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          {initials(profile.full_name)}
        </summary>
        <div className="absolute end-0 top-[calc(100%+0.65rem)] z-50 w-64 rounded-md border border-border bg-card p-2 text-card-foreground shadow-xl">
          <div className="border-b border-border px-3 py-2">
            <div className="truncate text-sm font-medium">
              {profile.full_name || reviewText(locale, "Account")}
            </div>
          </div>
          <Link href="/account" className="mt-1 flex min-h-10 items-center gap-2 rounded px-3 text-sm hover:bg-secondary">
            <UserRound aria-hidden="true" size={16} strokeWidth={1.6} />
            {copy.account}
          </Link>
          {canAdmin && (
            <Link href="/admin" className="flex min-h-10 items-center gap-2 rounded px-3 text-sm hover:bg-secondary">
              <Shield aria-hidden="true" size={16} strokeWidth={1.6} />
              {copy.admin}
            </Link>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSignOut()}
            className="flex min-h-10 w-full items-center gap-2 rounded px-3 text-start text-sm hover:bg-secondary disabled:opacity-60"
          >
            <LogOut aria-hidden="true" size={16} strokeWidth={1.6} />
            {busy ? copy.signingOut : copy.signOut}
          </button>
          {error && <p className="px-3 py-2 text-xs text-foreground" role="status">{error}</p>}
        </div>
      </details>
    </div>
  );
}
