import type { ReactNode } from "react";
export type Locale = "ar" | "en";
// Only client UI is replaced in this RSC-only harness. Real layout/page, proxy,
// SDK, guards and methodology loader execute; no application bypass is added.
export function AdminShell({ children }: { children: ReactNode }) {
  return <main>{children}</main>;
}
export function DeferredAdminSection() { return <p>Deferred fixture section</p>; }
export function AdminMethodologies({ data }: { data: Record<string, unknown[]> }) {
  return <div id="methodology-fixture">{Object.entries(data).map(([key, rows]) =>
    <p key={key}>{key}: {rows.length}</p>)}</div>;
}
export async function methodologyAction() { throw new Error("Not a fixture action"); }
export async function getTranslations() { return (key: string) => key; }
