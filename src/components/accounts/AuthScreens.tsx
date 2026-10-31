"use client";

import { LockKeyhole, ArrowUpRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { localePath, safeNext } from "@/lib/auth/paths";
import { googleOAuthUrl } from "@/lib/auth/oauth-url";
import type { Locale } from "./types";
import { reviewText } from "./types";

type SignInProps = {
  locale: Locale;
  next?: string | null;
  valueStatement: string;
  providerError?: string | null;
};

export function SignInScreen({ locale, next, valueStatement, providerError }: SignInProps) {
  const [connecting, setConnecting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const providerMessage = failure || providerError ? reviewText(locale, failure || providerError || "") : "";
  const signInPath = localePath(locale, "/auth/sign-in") + (safeNext(next) ? `?next=${encodeURIComponent(next!)}` : "");
  async function startGoogle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (connecting) return;
    setFailure(null);
    if (window.self !== window.top) {
      setFailure("Google sign-in needs a separate browser tab. Open sign-in in a new tab, then continue with Google.");
      return;
    }
    setConnecting(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(localePath(locale, "/auth/start"), {
        method: "POST", body: form, credentials: "same-origin", redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("oauth_start_failed");
      const data: {url?: unknown} = await response.json();
      const destination = googleOAuthUrl(data.url, process.env.NEXT_PUBLIC_SUPABASE_URL);
      window.location.assign(destination);
      // A browser/sandbox can refuse navigation without throwing; unload cancels this timer.
      window.setTimeout(() => {
        setConnecting(false);
        setFailure("Google navigation did not complete. Open sign-in in a new tab and try again.");
      }, 15000);
    } catch {
      setConnecting(false);
      setFailure("Google sign-in could not be started. Check your connection and try again in a new tab. If it still fails, contact the site owner to check Google provider and callback settings.");
    }
  }
  const copy = {
    eyebrow: reviewText(locale, "RESEARCH, WITH ITS REASONS"),
    title: reviewText(locale, "Sign in"),
    consent: reviewText(locale, "By continuing, you agree to the"),
    terms: reviewText(locale, "Terms of Use"),
    privacy: reviewText(locale, "Privacy Policy"),
    and: reviewText(locale, "and"),
    continue: reviewText(locale, "Continue with Google"),
    connecting: reviewText(locale, "Connecting to Google"),
  };

  return (
    <main className="min-h-[100dvh] bg-background px-5 py-10 text-foreground sm:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{reviewText(locale, "ACCOUNT ACCESS")}</span>
        </header>
        <section className="my-auto grid items-center gap-12 py-16 lg:grid-cols-[1fr_0.84fr] lg:gap-24">
          <div className="max-w-2xl">
            <p className="mb-5 flex items-center gap-2 text-xs text-accent">
              <span className="h-px w-9 bg-primary" />
              {copy.eyebrow}
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight sm:text-6xl">
              {copy.title}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">{valueStatement}</p>
            <div className="mt-10 flex items-center gap-3 text-sm text-muted-foreground">
              <LockKeyhole aria-hidden="true" size={17} strokeWidth={1.6} />
              <span>{reviewText(locale, "One Google account. No password to manage.")}</span>
            </div>
          </div>
          <div className="relative">
            <div aria-hidden="true" className="absolute -inset-5 border border-border/50" />
            <div className="relative border border-border bg-card p-7 sm:p-10">
              <div className="mb-8 flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{reviewText(locale, "SUHAIL ACCOUNT")}</p>
                  <div className="mt-3 h-1 w-12 bg-primary" />
                </div>
                <span className="font-mono text-xs text-muted-foreground" dir="ltr">01 / 01</span>
              </div>
              <p className="max-w-sm text-sm leading-7 text-muted-foreground">
                {copy.consent}{" "}
                <a className="text-foreground underline underline-offset-4" href={localePath(locale, "/terms")}>
                  {copy.terms}
                </a>{" "}
                {copy.and}{" "}
                <a className="text-foreground underline underline-offset-4" href={localePath(locale, "/privacy")}>
                  {copy.privacy}
                </a>
                .
              </p>
              <form action={localePath(locale, "/auth/start")} method="post" onSubmit={startGoogle} aria-busy={connecting}>
                <input type="hidden" name="next" value={next ?? ""} />
                <button
                  type="submit"
                  disabled={connecting}
                  className="mt-7 flex min-h-12 w-full items-center justify-between gap-4 bg-primary px-5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <span className="flex items-center gap-3">
                    <GoogleMark />
                    {connecting ? copy.connecting : copy.continue}
                  </span>
                  <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.6} />
                </button>
              </form>
              <noscript>{reviewText(locale, "Enable JavaScript to continue with Google.")}</noscript>
              {connecting && <p className="mt-4 text-sm" role="status">{copy.connecting}</p>}
              {providerMessage && (
                <p className="mt-4 border-s-2 border-foreground ps-3 text-sm text-foreground" role="alert">
                  {providerMessage}
                  <a className="mt-2 block underline underline-offset-4" href={signInPath} target="_blank" rel="noopener noreferrer">
                    {reviewText(locale, "Open sign-in in a new tab")}
                  </a>
                </p>
              )}
              <p className="mt-6 text-xs leading-6 text-muted-foreground">
                {reviewText(locale, "Your public research remains open to everyone.")}
              </p>
            </div>
          </div>
        </section>
        <footer className="flex items-center border-t border-border pt-5 text-xs text-muted-foreground">
          <span>{reviewText(locale, "Suhail · Public research")}</span>
        </footer>
      </div>
    </main>
  );
}

export function ConsentScreen({
  locale,
  next,
}: {
  locale: Locale;
  next?: string | null;
  backTo?: string | null;
}) {
  return (
    <main className="min-h-[100dvh] bg-background px-5 py-12 text-foreground sm:px-8">
      <div className="mx-auto max-w-2xl">
        <section className="mt-20 border border-border bg-card p-7 sm:p-10">
          <p className="text-xs text-muted-foreground">{reviewText(locale, "ACCOUNT / CONSENT")}</p>
          <h1 className="mt-4 text-3xl font-semibold">{reviewText(locale, "Review your agreement")}</h1>
          <p className="mt-5 leading-8 text-muted-foreground">
            {reviewText(locale, "Your agreement needs to be renewed before you continue using your account.")}
          </p>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <a className="underline underline-offset-4" href={localePath(locale, "/terms")}>
              {reviewText(locale, "Terms of Use")}
            </a>
            <a className="underline underline-offset-4" href={localePath(locale, "/privacy")}>
              {reviewText(locale, "Privacy Policy")}
            </a>
          </div>
          <form action={localePath(locale, "/auth/consent/accept")} method="post" className="mt-9">
            <input type="hidden" name="decision" value="accept" />
            <input type="hidden" name="next" value={next ?? ""} />
            <button className="min-h-11 w-full bg-primary px-5 text-sm font-medium text-primary-foreground sm:w-auto" type="submit">
              {reviewText(locale, "Accept and continue")}
            </button>
          </form>
          <form action={localePath(locale, "/auth/consent/accept")} method="post" className="mt-3">
            <input type="hidden" name="decision" value="decline" />
            <input type="hidden" name="next" value={next ?? ""} />
            <button className="min-h-11 w-full border border-border px-5 text-sm sm:w-auto" type="submit">
              {reviewText(locale, "Decline and sign out")}
            </button>
          </form>
          <p className="mt-7 text-xs text-muted-foreground">{reviewText(locale, "Policy acceptance is recorded on your account.")}</p>
        </section>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="size-[18px]" fill="none">
      <path d="M17.64 9.2c0-.63-.06-1.23-.16-1.8H9v3.4h4.84a4.14 4.14 0 0 1-1.8 2.72v2.22h2.92c1.71-1.57 2.68-3.88 2.68-6.54Z" fill="currentColor" opacity=".72" />
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.16l-2.92-2.22c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.29A9 9 0 0 0 9 18Z" fill="currentColor" opacity=".55" />
      <path d="M3.97 10.77a5.4 5.4 0 0 1 0-3.54V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.29Z" fill="currentColor" opacity=".82" />
      <path d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.29C4.68 5.16 6.66 3.58 9 3.58Z" fill="currentColor" />
    </svg>
  );
}
