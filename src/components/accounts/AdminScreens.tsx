"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  Activity,
  BookOpenText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Database,
  FileClock,
  Settings2,
  Shield,
  UsersRound,
} from "lucide-react";
import type { ActionResult, Locale, Role } from "./types";
import { reviewText } from "./types";
import { formatNumber, formatTimestamp } from "@/lib/format";
import { localePath } from "@/lib/auth/paths";
import { Lockup } from "@/components/foundation/Lockup";
import { activeAdminSection } from "@/lib/auth/admin-navigation";

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  created_at: Date | string;
  last_sign_in_at: Date | string | null;
  verified_totp: boolean;
};
type AuditEvent = {
  id: string;
  event_type: string;
  entity_name: string | null;
  entity_id: string | null;
  summary: string;
  details: unknown;
  occurred_at: Date | string;
};
type VersionOption = { id: string; version_label: string };

const navItems = [
  { href: "/admin", label: "Methodologies", icon: BookOpenText, mode: "deferred" },
  { href: "/admin/securities", label: "Securities and data", icon: Database, mode: "deferred" },
  { href: "/admin/ingestion", label: "Ingestion", icon: Activity, mode: "deferred" },
  { href: "/admin/editions", label: "Editions", icon: FileClock, mode: "deferred" },
  { href: "/admin/analysts", label: "Analysts", icon: CircleUserRound, mode: "deferred" },
  { href: "/admin/users", label: "Users", icon: UsersRound, mode: "admin" },
  { href: "/admin/audit", label: "Audit trail", icon: Shield, mode: "admin" },
  { href: "/admin/settings", label: "Settings", icon: Settings2, mode: "admin" },
] as const;

export function AdminShell({
  locale,
  role,
  currentPath,
  userLabel,
  userEmail,
  children,
}: {
  locale: Locale;
  role: "admin" | "editor";
  currentPath: string;
  userLabel: string;
  userEmail?: string | null;
  children: ReactNode;
}) {
  const visible = navItems.filter((item) => item.mode !== "admin" || role === "admin");
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-8">
        <a href={localePath(locale, "/")} aria-label={reviewText(locale, "Suhail · Public research")} className="focus-visible:outline-2 focus-visible:outline-offset-4">
          <Lockup />
        </a>
        <form action={localePath(locale, "/auth/sign-out")} method="post">
          <div className="flex items-center gap-4">
            <div className="hidden text-end sm:block">
              <div className="text-sm">{userLabel}</div>
              {userEmail && <div className="font-mono text-[10px] text-muted-foreground" dir="ltr">{userEmail}</div>}
            </div>
            <button className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" type="submit">
              {reviewText(locale, "Sign out")}
            </button>
          </div>
        </form>
      </header>
      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)] md:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-border p-4 md:min-h-[calc(100dvh-4rem)] md:border-b-0 md:border-e md:p-5">
          <p className="px-3 pb-3 pt-1 text-xs text-muted-foreground">
            {reviewText(locale, "WORKSPACE")}
          </p>
          <nav aria-label={reviewText(locale, "Admin navigation")} className="flex gap-1 overflow-x-auto md:flex-col">
            {visible.map(({ href, label, icon: Icon }) => {
              const active = activeAdminSection(currentPath) === href;
              return (
                <a
                  key={href}
                  href={localePath(locale, href)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-10 shrink-0 items-center gap-3 rounded px-3 text-sm transition-colors ${
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon aria-hidden="true" size={16} strokeWidth={1.6} />
                  {reviewText(locale, label)}
                </a>
              );
            })}
          </nav>
          <div className="mt-7 hidden border-t border-border px-3 pt-4 md:block">
            <span className="text-xs text-muted-foreground">{reviewText(locale, role)}</span>
          </div>
        </aside>
        <main className="min-w-0 p-5 sm:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}

export function DeferredAdminSection({ locale, title }: { locale: Locale; title: string }) {
  return (
    <section className="mx-auto max-w-3xl py-8">
      <p className="text-xs text-muted-foreground">{reviewText(locale, "ADMIN / DEFERRED")}</p>
      <h1 className="mt-4 text-3xl font-semibold">{reviewText(locale, title)}</h1>
      <div className="mt-8 border border-border bg-card p-7 sm:p-9">
        <div className="flex size-11 items-center justify-center rounded-full border border-border">
          <BookOpenText aria-hidden="true" size={19} strokeWidth={1.6} />
        </div>
        <h2 className="mt-5 text-lg font-medium">{reviewText(locale, "This section is not available yet")}</h2>
        <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
          {reviewText(locale, "This area is reserved for a later editorial workflow. No data can be changed here.")}
        </p>
      </div>
    </section>
  );
}

export function UsersAdminScreen({
  locale,
  initialRows,
  initialPage,
  initialTotal,
  initialQuery = "",
  changeRole,
}: {
  locale: Locale;
  initialRows: UserRow[];
  initialPage: number;
  initialTotal: number;
  initialQuery?: string;
  changeRole: (targetId: string, role: Role, note: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [nextRole, setNextRole] = useState<Role>("editor");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [message, setMessage] = useState("");
  const roleDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!selected || !roleDialog.current) return;
    const dialog = roleDialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Native modal semantics keep the background inert, contain Tab navigation
    // and support Escape, without touching role/AAL2 authorization.
    dialog.showModal();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, [selected]);

  const runSearch = (nextPage = 1) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (nextPage > 1) params.set("page", String(nextPage));
    const suffix = params.size ? `?${params.toString()}` : "";
    router.push(`/admin/users${suffix}` as never);
  };
  const saveRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current || !selected || note.trim().length < 4) return;
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      const result = await changeRole(selected.id, nextRole, note);
      if (!result.ok) {
        setMessage(reviewText(locale, "Role could not be updated. Try again."));
        return;
      }
      setSelected(null);
      setNote("");
      setMessage(reviewText(locale, "Role updated."));
      router.refresh();
    } catch {
      setMessage(reviewText(locale, "Role could not be updated. Try again."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const maxPage = Math.max(1, Math.ceil(initialTotal / 25));

  return (
    <section className="mx-auto max-w-6xl">
      <p className="text-xs text-muted-foreground">{reviewText(locale, "ADMIN / ACCESS CONTROL")}</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl font-semibold">{reviewText(locale, "Users")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{reviewText(locale, "Roles are granted deliberately and every change is recorded.")}</p>
        </div>
        <span className="text-xs text-muted-foreground"><bdi className="font-mono" dir="ltr">{formatNumber(initialTotal, locale)}</bdi> {reviewText(locale, "RECORDS")}</span>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); runSearch(1); }} className="mt-7 flex max-w-2xl gap-2">
        <label className="flex-1">
          <span className="sr-only">{reviewText(locale, "Search by name or email")}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={reviewText(locale, "Search by name or email")} className="min-h-11 w-full border border-input bg-background px-3 text-sm" />
        </label>
          <button className="min-h-11 bg-primary px-5 text-sm text-primary-foreground">
            {reviewText(locale, "Search")}
        </button>
      </form>
      {message && <p className="mt-4 text-sm text-muted-foreground" role="status">{message}</p>}
      <div className="mt-6 overflow-x-auto border border-border">
        <table className="w-full min-w-[820px] border-collapse text-start text-sm">
          <thead className="bg-secondary text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{reviewText(locale, "User")}</th>
              <th className="px-4 py-3 text-start font-medium">{reviewText(locale, "Role")}</th>
              <th className="px-4 py-3 text-start font-medium">{reviewText(locale, "TOTP")}</th>
              <th className="px-4 py-3 text-start font-medium">{reviewText(locale, "Created")}</th>
              <th className="px-4 py-3 text-start font-medium">{reviewText(locale, "Last sign-in")}</th>
              <th className="px-4 py-3 text-end font-medium">{reviewText(locale, "Action")}</th>
            </tr>
          </thead>
          <tbody>
            {initialRows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-4">
                  <div className="font-medium">{row.full_name || reviewText(locale, "Name not provided")}</div>
                  <div className="mt-1 text-xs text-muted-foreground" dir="ltr">{row.email || reviewText(locale, "No email")}</div>
                </td>
                <td className="px-4 py-4"><span className="text-xs">{reviewText(locale, row.role)}</span></td>
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center gap-2 text-xs ${row.verified_totp ? "text-foreground" : "text-muted-foreground"}`}>
                    <span className={`size-2 rounded-full ${row.verified_totp ? "bg-primary" : "bg-border"}`} />
                    {row.verified_totp ? reviewText(locale, "Verified") : reviewText(locale, "Not enrolled")}
                  </span>
                </td>
                <td className="px-4 py-4 text-xs text-muted-foreground"><bdi>{formatDate(locale, row.created_at)}</bdi></td>
                <td className="px-4 py-4 text-xs text-muted-foreground">
                  <bdi>{row.last_sign_in_at ? formatDate(locale, row.last_sign_in_at) : "—"}</bdi>
                </td>
                <td className="px-4 py-4 text-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(row);
                      setNextRole(row.role === "user" ? "editor" : "user");
                      setNote("");
                    }}
                    className="min-h-9 border border-border px-3 text-xs hover:bg-secondary"
                  >
                    {reviewText(locale, "Change role")}
                  </button>
                </td>
              </tr>
            ))}
            {initialRows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">{reviewText(locale, "No users found.")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{reviewText(locale, "Page")} {initialPage} / {maxPage}</span>
        <div className="flex gap-2">
          <button type="button" aria-label={reviewText(locale, "Previous page")} disabled={initialPage <= 1} onClick={() => runSearch(initialPage - 1)} className="flex size-10 items-center justify-center border border-border disabled:opacity-40"><ChevronLeft aria-hidden="true" size={17} /></button>
          <button type="button" aria-label={reviewText(locale, "Next page")} disabled={initialPage >= maxPage} onClick={() => runSearch(initialPage + 1)} className="flex size-10 items-center justify-center border border-border disabled:opacity-40"><ChevronRight aria-hidden="true" size={17} /></button>
        </div>
      </div>
      {selected && (
          <dialog ref={roleDialog} aria-modal="true" aria-labelledby="role-dialog-title"
            onCancel={() => setSelected(null)}
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)");
              const first = controls[0], last = controls[controls.length - 1];
              if ((!event.shiftKey && document.activeElement === last) || (event.shiftKey && document.activeElement === first)) {
                event.preventDefault();
                (event.shiftKey ? last : first)?.focus();
              }
            }}
            onClick={(event) => {
              if (event.target !== event.currentTarget) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              if (event.clientX < bounds.x || event.clientX > bounds.right || event.clientY < bounds.y || event.clientY > bounds.bottom) setSelected(null);
            }}
            className="fixed inset-0 mx-auto mb-0 mt-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto border border-border bg-card p-6 text-card-foreground backdrop:bg-black/50 sm:m-auto sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs text-muted-foreground">{reviewText(locale, "ROLE CHANGE")}</p>
                <h2 id="role-dialog-title" className="mt-2 text-xl font-semibold">{reviewText(locale, "Change account role")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{selected.full_name || selected.email}</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label={reviewText(locale, "Close")} className="text-muted-foreground"><span aria-hidden="true">×</span></button>
            </div>
            <form onSubmit={(event) => void saveRole(event)} className="mt-6 space-y-4">
              <label className="block text-sm">
                <span className="mb-2 block text-xs text-muted-foreground">{reviewText(locale, "New role")}</span>
                <span className="relative block">
                  <select value={nextRole} onChange={(event) => setNextRole(event.target.value as Role)} className="min-h-11 w-full appearance-none border border-input bg-background px-3 pe-10">
                    <option value="user">{reviewText(locale, "user")}</option>
                    <option value="editor">{reviewText(locale, "editor")}</option>
                    <option value="admin">{reviewText(locale, "admin")}</option>
                  </select>
                  <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2" />
                </span>
              </label>
              <label className="block text-sm">
                <span className="mb-2 block text-xs text-muted-foreground">{reviewText(locale, "Reason (required)")}</span>
                <textarea required minLength={4} value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="w-full border border-input bg-background p-3" />
              </label>
              <p className="text-xs leading-6 text-muted-foreground">{reviewText(locale, "Role changes are audited. A promoted user must enroll an authenticator before entering admin.")}</p>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setSelected(null)} className="min-h-10 px-4 text-sm">{reviewText(locale, "Cancel")}</button>
                <button disabled={note.trim().length < 4} aria-disabled={saving} className="min-h-10 bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50 aria-disabled:opacity-50">
                  {saving ? reviewText(locale, "Saving") : reviewText(locale, "Confirm role change")}
                </button>
              </div>
            </form>
          </dialog>
      )}
    </section>
  );
}

export function AuditAdminScreen({
  locale,
  initialRows,
  initialPage,
  initialTotal,
  initialFilters,
}: {
  locale: Locale;
  initialRows: AuditEvent[];
  initialPage: number;
  initialTotal: number;
  initialFilters?: { event?: string; entity?: string; from?: string; to?: string };
}) {
  const router = useRouter();
  const filters = initialFilters ?? { event: "", entity: "", from: "", to: "" };
  const [event, setEvent] = useState(filters.event ?? "");
  const [entity, setEntity] = useState(filters.entity ?? "");
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");
  const load = (nextPage = 1) => {
    const params = new URLSearchParams();
    if (event) params.set("event", event);
    if (entity) params.set("entity", entity);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (nextPage > 1) params.set("page", String(nextPage));
    const suffix = params.size ? `?${params.toString()}` : "";
    router.push(`/admin/audit${suffix}` as never);
  };
  const maxPage = Math.max(1, Math.ceil(initialTotal / 25));
  return (
    <section className="mx-auto max-w-6xl">
      <p className="text-xs text-muted-foreground">{reviewText(locale, "ADMIN / APPEND-ONLY")}</p>
      <div className="mt-4">
        <h1 className="text-3xl font-semibold">{reviewText(locale, "Audit trail")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{reviewText(locale, "A read-only record of privileged changes.")}</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(1); }} className="mt-7 grid gap-3 border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs text-muted-foreground">{reviewText(locale, "Event type")}<input value={event} onChange={(e) => setEvent(e.target.value)} className="mt-1 min-h-10 w-full border border-input bg-background px-2 text-sm text-foreground" /></label>
        <label className="text-xs text-muted-foreground">{reviewText(locale, "Entity")}<input value={entity} onChange={(e) => setEntity(e.target.value)} className="mt-1 min-h-10 w-full border border-input bg-background px-2 text-sm text-foreground" /></label>
        <label className="text-xs text-muted-foreground">{reviewText(locale, "From")}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 min-h-10 w-full border border-input bg-background px-2 text-sm text-foreground" /></label>
        <label className="text-xs text-muted-foreground">{reviewText(locale, "To")}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 min-h-10 w-full border border-input bg-background px-2 text-sm text-foreground" /></label>
        <button className="self-end min-h-10 bg-primary px-4 text-sm text-primary-foreground">{reviewText(locale, "Apply filters")}</button>
      </form>
      <div className="mt-5 space-y-3">
        {initialRows.map((row) => (
          <details key={row.id} className="group border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-5 p-4 sm:px-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs text-accent">{reviewText(locale, row.event_type)}</span>
                  <span className="text-xs text-muted-foreground">{row.entity_name || "—"}</span>
                </div>
                <p className="mt-2 truncate text-sm">{reviewText(locale, row.summary)}</p>
              </div>
              <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                <bdi>{formatDate(locale, row.occurred_at)}</bdi>
                <ChevronDown aria-hidden="true" size={16} className="transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="border-t border-border px-4 py-4 sm:px-5">
              <dl className="grid gap-4 text-xs sm:grid-cols-2">
                <div><dt className="text-muted-foreground">{reviewText(locale, "Entity ID")}</dt><dd className="mt-1 break-all font-mono" dir="ltr">{row.entity_id || "—"}</dd></div>
                <div><dt className="text-muted-foreground">{reviewText(locale, "Event ID")}</dt><dd className="mt-1 break-all font-mono" dir="ltr">{row.id}</dd></div>
              </dl>
              <pre className="mt-4 max-h-72 overflow-auto border border-border bg-background p-3 text-xs leading-6" dir="ltr">{safeJson(row.details)}</pre>
            </div>
          </details>
        ))}
        {initialRows.length === 0 && <p className="border border-border px-5 py-12 text-center text-sm text-muted-foreground">{reviewText(locale, "No events match these filters.")}</p>}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{reviewText(locale, "Page")} {initialPage} / {maxPage}</span>
        <div className="flex gap-2">
          <button type="button" disabled={initialPage <= 1} onClick={() => load(initialPage - 1)} className="size-10 border border-border disabled:opacity-40" aria-label={reviewText(locale, "Previous page")}>‹</button>
          <button type="button" disabled={initialPage >= maxPage} onClick={() => load(initialPage + 1)} className="size-10 border border-border disabled:opacity-40" aria-label={reviewText(locale, "Next page")}>›</button>
        </div>
      </div>
    </section>
  );
}

export function SettingsAdminScreen({
  locale,
  settings,
  versions,
  saveSettings,
}: {
  locale: Locale;
  settings: { default_shariah_methodology_version_id: string | null; allow_ineligible_editor_pick: boolean } | null;
  versions: VersionOption[];
  saveSettings: (defaultId: string | null, allow: boolean) => Promise<ActionResult>;
}) {
  const [defaultId, setDefaultId] = useState(settings?.default_shariah_methodology_version_id ?? "");
  const [allow, setAllow] = useState(settings?.allow_ineligible_editor_pick ?? false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [feedback, setFeedback] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setFeedback("");
    try {
      const result = await saveSettings(defaultId || null, allow);
      setFeedback(
        result.ok
          ? reviewText(locale, "Settings saved.")
          : reviewText(locale, "Settings could not be saved. Try again."),
      );
    } catch {
      setFeedback(reviewText(locale, "Settings could not be saved. Try again."));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  return (
    <section className="mx-auto max-w-3xl">
      <p className="text-xs text-muted-foreground">{reviewText(locale, "ADMIN / EDITORIAL CONFIGURATION")}</p>
      <h1 className="mt-4 text-3xl font-semibold">{reviewText(locale, "Settings")}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{reviewText(locale, "These settings affect editorial defaults. Changes are audited.")}</p>
      <form onSubmit={(event) => void submit(event)} className="mt-8 divide-y divide-border border border-border bg-card">
        <div className="block p-5 sm:p-7">
          <label htmlFor="settings-default-version" className="font-medium">{reviewText(locale, "Default methodology version")}</label>
          <p id="settings-default-help" className="mt-1 block text-sm text-muted-foreground">{reviewText(locale, "Only public, eligible versions are listed.")}</p>
          <select id="settings-default-version" aria-describedby="settings-default-help" value={defaultId} onChange={(event) => setDefaultId(event.target.value)} className="mt-4 min-h-11 w-full border border-input bg-background px-3 text-sm">
            <option value="">{reviewText(locale, "No default")}</option>
            {versions.map((version) => <option key={version.id} value={version.id}>{version.version_label}</option>)}
          </select>
        </div>
        <div className="flex items-start gap-4 p-5 sm:p-7">
          <input id="settings-allow-ineligible" aria-describedby="settings-allow-help" type="checkbox" checked={allow} onChange={(event) => setAllow(event.target.checked)} className="mt-1 size-4 accent-primary" />
          <span>
            <label htmlFor="settings-allow-ineligible" className="cursor-pointer font-medium">{reviewText(locale, "Allow editor picks for ineligible securities")}</label>
            <span id="settings-allow-help" className="mt-1 block text-sm leading-6 text-muted-foreground">{reviewText(locale, "Editors may publish an explicitly marked pick even when it is not eligible under the selected screening configuration.")}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-7">
          <p role="status" className="text-sm text-muted-foreground">{feedback}</p>
          <button aria-disabled={pending} className="min-h-11 bg-primary px-5 text-sm font-medium text-primary-foreground aria-disabled:opacity-50">{pending ? reviewText(locale, "Saving") : reviewText(locale, "Save settings")}</button>
        </div>
      </form>
    </section>
  );
}

function formatDate(locale: Locale, date: Date | string) {
  return formatTimestamp(date, locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return "null";
  }
}

