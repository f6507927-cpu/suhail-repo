import { Shield, UserRound, LogOut } from "lucide-react";
import { localePath } from "@/lib/auth/paths";
import { initials, reviewText, type Locale, type Role } from "./types";

type AccountIdentity = {
  fullName: string;
  role: Role;
};

export function AccountIdentityControl({
  locale,
  identity,
}: {
  locale: Locale;
  identity: AccountIdentity | null;
}) {
  if (!identity) {
    return (
      <a
        href={localePath(locale, "/auth/sign-in")}
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <UserRound aria-hidden="true" size={17} strokeWidth={1.6} />
        {reviewText(locale, "Sign in")}
      </a>
    );
  }

  const canAdmin = identity.role === "admin" || identity.role === "editor";
  return (
    <div className="relative flex items-center gap-2" dir={locale === "ar" ? "rtl" : "ltr"}>
      <details className="group relative">
        <summary
          aria-label={reviewText(locale, "Open account menu")}
          className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full border border-border bg-secondary text-sm font-semibold text-foreground outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          {initials(identity.fullName)}
        </summary>
        <div className="absolute end-0 top-[calc(100%+0.65rem)] z-50 w-64 rounded-md border border-border bg-card p-2 text-card-foreground shadow-xl">
          <div className="border-b border-border px-3 py-2">
            <div className="truncate text-sm font-medium">{identity.fullName || reviewText(locale, "Account")}</div>
          </div>
          <a
            href={localePath(locale, "/account")}
            className="mt-1 flex min-h-10 items-center gap-2 rounded px-3 text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <UserRound aria-hidden="true" size={16} strokeWidth={1.6} />
            {reviewText(locale, "Account")}
          </a>
          {canAdmin && (
            <a
              href={localePath(locale, "/admin")}
              className="flex min-h-10 items-center gap-2 rounded px-3 text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Shield aria-hidden="true" size={16} strokeWidth={1.6} />
              {reviewText(locale, "Admin")}
            </a>
          )}
          <form action={localePath(locale, "/auth/sign-out")} method="post">
            <button
              type="submit"
              className="flex min-h-10 w-full items-center gap-2 rounded px-3 text-start text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut aria-hidden="true" size={16} strokeWidth={1.6} />
              {reviewText(locale, "Sign out")}
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
