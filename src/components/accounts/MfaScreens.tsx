"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Check, Copy, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { createBrowserAuth } from "@/lib/auth/browser";
import { localePath } from "@/lib/auth/paths";
import { abandonedTotpFactors, normalizeTotpQr, type MfaFactor } from "@/lib/auth/mfa-enrollment";
import type { Locale } from "./types";
import { reviewText } from "./types";

type Factor = MfaFactor;
export const mfaPublicHomeHref = (locale: Locale) => localePath(locale, "/");
export type MfaClient = {
  auth: {
    mfa: {
      enroll: (input: { factorType: "totp"; friendlyName: string }) => Promise<{
        data: { id: string; totp?: { qr_code?: string; secret?: string; uri?: string } } | null;
        error: { message: string } | null;
      }>;
      challengeAndVerify: (input: { factorId: string; code: string }) => Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
      listFactors: () => Promise<{
        data: { all: Factor[]; totp: Factor[]; phone: Factor[] } | null;
        error: { message: string } | null;
      }>;
      unenroll: (input: { factorId: string }) => Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
      getAuthenticatorAssuranceLevel: () => Promise<{
        data: { currentLevel: string | null; nextLevel: string | null } | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export function MfaClientPanel({
  locale,
  mode,
  next,
}: {
  locale: Locale;
  mode: "enroll" | "verify";
  next?: string;
  backTo?: string;
}) {
  const [client, setClient] = useState<MfaClient | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => createBrowserAuth())
      .then((browserAuth) => {
        if (!active) return;
        if (!browserAuth) {
          setUnavailable(true);
          return;
        }
        setClient(browserAuth as unknown as MfaClient);
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, []);
  if (client) {
    return mode === "enroll"
      ? <MfaEnrollScreen locale={locale} client={client} next={next} />
      : <MfaVerifyScreen locale={locale} client={client} next={next} />;
  }
  return (
    <MfaFrame locale={locale} marker={reviewText(locale, "ADMIN ACCESS")}>
      {unavailable ? (
        <>
          <h1 className="text-2xl font-semibold">{reviewText(locale, "Authenticator setup is unavailable")}</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {reviewText(locale, "The account provider is not configured for this browser session. Contact an administrator.")}
          </p>
        </>
      ) : (
        <div aria-hidden="true" className="space-y-4">
          <div className="h-8 w-48 animate-pulse bg-secondary" />
          <div className="h-4 w-full animate-pulse bg-secondary" />
          <div className="h-4 w-3/4 animate-pulse bg-secondary" />
        </div>
      )}
    </MfaFrame>
  );
}

export function MfaEnrollScreen({
  locale,
  client,
  next,
}: {
  locale: Locale;
  client: MfaClient;
  next?: string;
}) {
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [verified, setVerified] = useState(false);
  const [copied, setCopied] = useState(false);

  const startEnrollment = async () => {
    setPending(true);
    setMessage("");
    try {
      const factors = await client.auth.mfa.listFactors();
      if (factors.error || !factors.data) {
        setMessage(reviewText(locale, "Could not prepare authenticator enrollment. Try again."));
        return;
      }
      for (const factor of abandonedTotpFactors(factors.data.all)) {
        const cleanup = await client.auth.mfa.unenroll({ factorId: factor.id });
        if (cleanup.error) {
          setMessage(reviewText(locale, "Could not prepare authenticator enrollment. Try again."));
          return;
        }
      }
      const result = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Suhail admin access",
      });
      if (result.error || !result.data?.id) {
        setMessage(reviewText(locale, "Could not prepare authenticator enrollment. Try again."));
        return;
      }
      setFactorId(result.data.id);
      setQrCode(normalizeTotpQr(result.data.totp?.qr_code));
      setSecret(result.data.totp?.secret ?? "");
    } catch {
      setMessage(reviewText(locale, "Could not prepare authenticator enrollment. Try again."));
    } finally {
      setPending(false);
    }
  };

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!factorId || !/^\d{6,8}$/.test(code)) return;
    setPending(true);
    setMessage("");
    try {
      const result = await client.auth.mfa.challengeAndVerify({ factorId, code });
      if (result.error) {
        setMessage(reviewText(locale, "That code could not be verified. Check the time on your device and try again."));
        return;
      }
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data?.currentLevel !== "aal2") {
        setMessage(reviewText(locale, "Additional verification is still required."));
        return;
      }
      setVerified(true);
      window.location.assign(next ?? localePath(locale, "/admin"));
    } catch {
      setMessage(reviewText(locale, "Verification could not be completed. Try again."));
    } finally {
      setPending(false);
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <MfaFrame locale={locale} marker={reviewText(locale, "ADMIN ACCESS / ENROLL")}>
      <div className="flex size-12 items-center justify-center border border-border bg-secondary">
        <KeyRound aria-hidden="true" size={21} strokeWidth={1.6} />
      </div>
      <h1 className="mt-5 text-3xl font-semibold">{reviewText(locale, "Set up an authenticator")}</h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        {reviewText(locale, "Admin access requires a time-based authenticator. Your role alone does not grant access.")}
      </p>
      {!factorId ? (
        <button
          type="button"
          onClick={() => void startEnrollment()}
          disabled={pending}
          className="mt-7 flex min-h-11 items-center gap-3 bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending && <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />}
          {pending ? reviewText(locale, "Preparing secure setup") : reviewText(locale, "Begin setup")}
        </button>
      ) : (
        <div className="mt-7">
          <div className="grid gap-6 sm:grid-cols-[160px_minmax(0,1fr)]">
            <div className="flex min-h-40 items-center justify-center border border-border bg-background p-3">
              {qrCode ? (
                // Provider-owned inline QR bypasses Next image handling after SVG data-URL normalization.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrCode} alt={reviewText(locale, "Authenticator setup QR code")} width={144} height={144} onError={() => setQrCode("")} className="size-36 object-contain" />
              ) : (
                <p className="text-center text-xs text-muted-foreground">{reviewText(locale, "QR code unavailable. Use the setup key instead.")}</p>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-medium">{reviewText(locale, "Scan with your authenticator app")}</h2>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">{reviewText(locale, "If scanning is unavailable, enter this key manually.")}</p>
              </div>
              <div className="flex items-center gap-2 border border-border bg-background p-3">
                {secret ? <code className="min-w-0 flex-1 break-all font-mono text-sm" dir="ltr">{secret}</code> : <span className="text-sm">{reviewText(locale, "Setup key unavailable")}</span>}
                {secret && <button type="button" onClick={() => void copySecret()} aria-label={reviewText(locale, "Copy setup key")} className="flex size-9 shrink-0 items-center justify-center border border-border"><Copy aria-hidden="true" size={15} /></button>}
              </div>
              {copied && <p role="status" className="text-xs text-muted-foreground">{reviewText(locale, "Setup key copied")}</p>}
            </div>
          </div>
          <form onSubmit={(event) => void verify(event)} className="mt-7 border-t border-border pt-6">
            <label className="block max-w-sm text-sm">
              <span className="mb-2 block text-xs text-muted-foreground">{reviewText(locale, "Enter the six-digit code")}</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,8}"
                required
                className="min-h-12 w-full border border-input bg-background px-3 text-center font-mono text-lg tracking-[0.3em]"
                dir="ltr"
              />
            </label>
            <button disabled={pending || !/^\d{6,8}$/.test(code)} className="mt-4 flex min-h-11 items-center gap-3 bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {pending && <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />}
              {reviewText(locale, "Verify and continue")}
            </button>
          </form>
        </div>
      )}
      {message && <p role="alert" className="mt-4 text-sm text-foreground">{message}</p>}
      {verified && <p role="status" className="mt-4 flex items-center gap-2 text-sm"><Check aria-hidden="true" size={16} />{reviewText(locale, "Authenticator verified.")}</p>}
    </MfaFrame>
  );
}

export function MfaVerifyScreen({
  locale,
  client,
  next,
}: {
  locale: Locale;
  client: MfaClient;
  next?: string;
}) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const factors = await client.auth.mfa.listFactors();
      const factor = factors.data?.totp.find((item) => item.status === "verified");
      if (factors.error || !factor) {
        setMessage(reviewText(locale, "No verified authenticator is available for this account."));
        return;
      }
      const challenge = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (challenge.error) {
        setMessage(reviewText(locale, "That code could not be verified. Try again."));
        return;
      }
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data?.currentLevel !== "aal2") {
        setMessage(reviewText(locale, "Additional verification is still required."));
        return;
      }
      window.location.assign(next ?? localePath(locale, "/admin"));
    } catch {
      setMessage(reviewText(locale, "Verification could not be completed. Try again."));
    } finally {
      setPending(false);
    }
  };

  return (
    <MfaFrame locale={locale} marker={reviewText(locale, "ADMIN ACCESS / VERIFY")}>
      <div className="flex size-12 items-center justify-center border border-border bg-secondary">
        <ShieldCheck aria-hidden="true" size={21} strokeWidth={1.6} />
      </div>
      <h1 className="mt-5 text-3xl font-semibold">{reviewText(locale, "Verify your identity")}</h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        {reviewText(locale, "Enter the current code from your verified authenticator to continue to the editorial workspace.")}
      </p>
      <form onSubmit={(event) => void verify(event)} className="mt-7 max-w-sm">
        <label className="block text-sm">
          <span className="mb-2 block text-xs text-muted-foreground">{reviewText(locale, "Authenticator code")}</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,8}"
            required
            className="min-h-12 w-full border border-input bg-background px-3 text-center font-mono text-lg tracking-[0.3em]"
            dir="ltr"
          />
        </label>
        <button disabled={pending || !/^\d{6,8}$/.test(code)} className="mt-4 flex min-h-11 items-center gap-3 bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {pending && <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />}
          {pending ? reviewText(locale, "Verifying") : reviewText(locale, "Verify and continue")}
        </button>
      </form>
      {message && <p role="alert" className="mt-4 text-sm text-foreground">{message}</p>}
      <p className="mt-6 text-xs leading-6 text-muted-foreground">{reviewText(locale, "Lost your authenticator? Contact another administrator for a reset.")}</p>
    </MfaFrame>
  );
}

function MfaFrame({
  locale,
  marker,
  children,
}: {
  locale: Locale;
  marker: string;
  children: ReactNode;
}) {
  return (
    <main dir={locale === "ar" ? "rtl" : "ltr"} className="min-h-[100dvh] bg-background px-5 py-10 text-foreground sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between border-b border-border pb-5">
          <a href={mfaPublicHomeHref(locale)} className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">
            {reviewText(locale, "Suhail · Public research")}
          </a>
          <span className="text-xs text-muted-foreground">{marker}</span>
        </header>
        <section className="mx-auto mt-12 max-w-2xl border border-border bg-card p-6 text-card-foreground sm:mt-20 sm:p-10">
          {children}
        </section>
      </div>
    </main>
  );
}
