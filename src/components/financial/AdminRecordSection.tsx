import type { ReactNode } from "react";
import { uiNineText } from "@/i18n/admin-presentation";
import type { Locale } from "@/components/accounts/types";
export function AdminRecordSection({ name, locale, children, first = false }: { name: string; locale: Locale; children: ReactNode; first?: boolean }) {
  return <details open={first || undefined} data-admin-record-section={name} className="min-w-0 border border-border bg-card">
    <summary className="cursor-pointer px-4 py-3 font-medium">{uiNineText(locale, name)}</summary>
    <div className="min-w-0 border-t border-border p-3">{children}</div>
  </details>;
}
