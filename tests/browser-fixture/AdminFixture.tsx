import {
  AdminShell,
  AuditAdminScreen,
  DeferredAdminSection,
  SettingsAdminScreen,
  UsersAdminScreen,
} from "../../src/components/accounts/AdminScreens";
import type { Locale } from "../../src/components/accounts/types";
import { accountFixture } from "./actions";

export function AdminFixture({ locale, mode }: { locale: Locale; mode: string }) {
  const params = new URLSearchParams(window.location.search);
  const empty = params.has("empty");
  const role = params.get("role") === "editor" ? "editor" : "admin";
  const currentPath = `/admin/${mode}`;
  const content = mode === "users" ? (
    <UsersAdminScreen
      locale={locale}
      initialRows={empty ? [] : [{
        id: "fixture-user", full_name: "Fixture User", email: null, role: "user",
        created_at: "2026-10-11T00:00:00Z", last_sign_in_at: null, verified_totp: false,
      }]}
      initialPage={Number(params.get("page") ?? 1)}
      initialTotal={empty ? 0 : 26}
      initialQuery={params.get("q") ?? ""}
      changeRole={(...args) => accountFixture.action("changeRole", ...args)}
    />
  ) : mode === "audit" ? (
    <AuditAdminScreen
      locale={locale}
      initialRows={empty ? [] : [{
        id: "fixture-event", event_type: "user_role_change", entity_name: "users",
        entity_id: "fixture-user", summary: "Fixture role change",
        details: { note: "Fixture only" }, occurred_at: "2026-10-11T00:00:00Z",
      }]}
      initialPage={Number(params.get("page") ?? 1)}
      initialTotal={empty ? 0 : 26}
      initialFilters={{
        event: params.get("event") ?? "", entity: params.get("entity") ?? "",
        from: params.get("from") ?? "", to: params.get("to") ?? "",
      }}
    />
  ) : mode === "settings" ? (
    <SettingsAdminScreen
      locale={locale}
      settings={{ default_shariah_methodology_version_id: null, allow_ineligible_editor_pick: false }}
      versions={[{ id: "fixture-version", version_label: "Fixture version" }]}
      saveSettings={(...args) => accountFixture.action("saveSettings", ...args)}
    />
  ) : <DeferredAdminSection locale={locale} title="Methodologies" />;

  return (
    <AdminShell locale={locale} role={role} currentPath={currentPath} userLabel="Fixture Admin">
      {content}
    </AdminShell>
  );
}
