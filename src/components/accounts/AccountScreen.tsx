"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { Globe2, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { localePath } from "@/lib/auth/paths";
import type { ActionResult, AccountProfile, Locale } from "./types";
import { reviewText } from "./types";
import { formatTimestamp } from "@/lib/format";

type Props = {
  locale: Locale;
  profile: AccountProfile & {
    email: string | null;
    locale_pref: Locale;
    terms_version: string | null;
    privacy_version: string | null;
    accepted_at: Date | string | null;
  };
  updateLocale: (locale: Locale) => Promise<ActionResult>;
  deleteAccount: (confirmation: string) => Promise<ActionResult>;
};

export function AccountScreen({ locale, profile, updateLocale, deleteAccount }: Props) {
  const router = useRouter();
  const [selectedLocale, setSelectedLocale] = useState<Locale>(profile.locale_pref);
  const [confirmation, setConfirmation] = useState("");
  const [localeState, setLocaleState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [deleteState, setDeleteState] = useState<"idle" | "deleting" | "error">("idle");
  const [error, setError] = useState("");
  const isPrivileged = profile.role === "admin" || profile.role === "editor";
  const copy = {
    title: reviewText(locale, "Your account"),
    subtitle: reviewText(locale, "A small set of preferences and account details."),
    profile: reviewText(locale, "Profile"),
    method: reviewText(locale, "Sign-in method"),
    google: reviewText(locale, "Google"),
    language: reviewText(locale, "Interface language"),
    arabic: reviewText(locale, "Arabic"),
    english: reviewText(locale, "English"),
    save: reviewText(locale, "Save language"),
    saved: reviewText(locale, "Language saved"),
    consent: reviewText(locale, "Policy acceptance"),
    accepted: reviewText(locale, "Accepted"),
    terms: reviewText(locale, "Terms of Use"),
    privacy: reviewText(locale, "Privacy Policy"),
    deleteTitle: reviewText(locale, "Delete account"),
    deleteBody: isPrivileged
      ? reviewText(locale, "An admin or editor account cannot be deleted. Ask another admin to remove your role first.")
      : reviewText(locale, "This permanently removes your account and cannot be undone."),
    typeDelete: reviewText(locale, 'Type "DELETE" to confirm'),
    delete: reviewText(locale, "Delete my account"),
  };

  const onSaveLocale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocaleState("saving");
    setError("");
    try {
      const result = await updateLocale(selectedLocale);
      setLocaleState(result.ok ? "saved" : "error");
      if (!result.ok) {
        setError(reviewText(locale, "Language preference could not be saved. Try again."));
      } else if (selectedLocale !== locale) {
        router.replace("/account", { locale: selectedLocale });
      }
    } catch {
      setLocaleState("error");
      setError(reviewText(locale, "Language preference could not be saved. Try again."));
    }
  };

  const onDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDeleteState("deleting");
    setError("");
    try {
      const result = await deleteAccount(confirmation);
      if (result.ok) {
        window.location.assign(localePath(selectedLocale, "/"));
        return;
      }
      setDeleteState("error");
      setError(reviewText(locale, "Account deletion could not be completed. Try again."));
    } catch {
      setDeleteState("error");
      setError(reviewText(locale, "Account deletion could not be completed. Try again."));
    }
  };

  const acceptedDate = profile.accepted_at
    ? formatTimestamp(profile.accepted_at, locale, {
        dateStyle: "medium",
      })
    : reviewText(locale, "Not recorded");

  return (
    <main className="min-h-[100dvh] bg-background px-5 py-10 text-foreground sm:px-8">
      <div className="mx-auto max-w-4xl">
      <p className="text-xs text-muted-foreground">{reviewText(locale, "SUHAIL / ACCOUNT")}</p>
        <header className="mt-5 border-b border-border pb-8">
          <h1 className="text-4xl font-semibold">{copy.title}</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">{copy.subtitle}</p>
        </header>

        <section className="grid gap-10 border-b border-border py-9 md:grid-cols-[minmax(0,1fr)_1.15fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full border border-border bg-secondary">
                <UserRound aria-hidden="true" size={18} strokeWidth={1.6} />
              </span>
              <div>
                <h2 className="font-medium">{copy.profile}</h2>
                <p className="text-xs text-muted-foreground">{reviewText(locale, "Private to your account")}</p>
              </div>
            </div>
          </div>
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{reviewText(locale, "Name")}</dt>
              <dd className="mt-1">{profile.full_name || reviewText(locale, "Not provided")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{reviewText(locale, "Email")}</dt>
              <dd className="mt-1 break-all" dir="ltr">{profile.email || reviewText(locale, "Not provided")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.method}</dt>
              <dd className="mt-1">{copy.google}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{reviewText(locale, "Account role")}</dt>
              <dd className="mt-1 text-sm">{reviewText(locale, profile.role)}</dd>
            </div>
          </dl>
        </section>

        <section className="grid gap-10 border-b border-border py-9 md:grid-cols-[minmax(0,1fr)_1.15fr]">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-full border border-border bg-secondary">
              <Globe2 aria-hidden="true" size={18} strokeWidth={1.6} />
            </span>
            <div>
              <h2 className="font-medium">{copy.language}</h2>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                {reviewText(locale, "This controls the language used when you open Suhail.")}
              </p>
            </div>
          </div>
          <form onSubmit={(event) => void onSaveLocale(event)} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">
              <span className="mb-2 block text-xs text-muted-foreground">{copy.language}</span>
              <select
                value={selectedLocale}
                onChange={(event) => {
                  setSelectedLocale(event.target.value as Locale);
                  setLocaleState("idle");
                }}
                className="min-h-11 w-full border border-input bg-background px-3"
              >
                <option value="ar">{copy.arabic}</option>
                <option value="en">{copy.english}</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={localeState === "saving" || selectedLocale === profile.locale_pref}
              className="min-h-11 bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {localeState === "saving" ? reviewText(locale, "Saving") : copy.save}
            </button>
            {localeState === "saved" && <span role="status" className="text-sm text-muted-foreground">{copy.saved}</span>}
          </form>
        </section>

        <section className="grid gap-10 border-b border-border py-9 md:grid-cols-[minmax(0,1fr)_1.15fr]">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-full border border-border bg-secondary">
              <ShieldCheck aria-hidden="true" size={18} strokeWidth={1.6} />
            </span>
            <div>
              <h2 className="font-medium">{copy.consent}</h2>
              <p className="mt-1 text-sm text-muted-foreground"><bdi>{acceptedDate}</bdi></p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <p>{copy.accepted}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <a className="underline underline-offset-4" href={localePath(locale, "/terms")}>
                {copy.terms} <span className="text-muted-foreground">· {profile.terms_version || "—"}</span>
              </a>
              <a className="underline underline-offset-4" href={localePath(locale, "/privacy")}>
                {copy.privacy} <span className="text-muted-foreground">· {profile.privacy_version || "—"}</span>
              </a>
            </div>
          </div>
        </section>

        <section className="py-9">
          <div className="flex items-center gap-3">
            <Trash2 aria-hidden="true" size={18} strokeWidth={1.6} />
            <h2 className="font-medium">{copy.deleteTitle}</h2>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{copy.deleteBody}</p>
          {!isPrivileged && (
            <form onSubmit={(event) => void onDelete(event)} className="mt-5 flex max-w-xl flex-col gap-3 sm:flex-row">
              <label className="flex-1">
                <span className="sr-only">{copy.typeDelete}</span>
                <input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  className="min-h-11 w-full border border-input bg-background px-3 font-mono text-sm"
                  placeholder={copy.typeDelete}
                  aria-label={copy.typeDelete}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={confirmation !== "DELETE" || deleteState === "deleting"}
                className="min-h-11 border border-foreground px-5 text-sm text-foreground disabled:opacity-40"
              >
                {deleteState === "deleting" ? reviewText(locale, "Deleting") : copy.delete}
              </button>
            </form>
          )}
          {error && <p className="mt-3 text-sm text-foreground" role="alert">{error}</p>}
        </section>
      </div>
    </main>
  );
}
