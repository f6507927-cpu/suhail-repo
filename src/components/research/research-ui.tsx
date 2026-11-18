"use client";
import type { ReactNode } from "react";
import type { Locale } from "../accounts/types";
import { reviewText } from "../accounts/types";
import styles from "../accounts/AdminUx.module.css";

export { reviewText };
export type ResearchAction = (formData: FormData) => Promise<{ ok: boolean; message?: string; id?: string }>;
export function ResearchFrame({ children }: { children: ReactNode }) {
  return <section data-admin-ux className={`${styles.root} mx-auto max-w-6xl`}>{children}</section>;
}
export function Heading({ locale, eyebrow, title, description }: { locale: Locale; eyebrow: string; title: string; description?: string }) {
  return <header className="mb-7"><p className="text-xs text-muted-foreground">{reviewText(locale, eyebrow)}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">{reviewText(locale, title)}</h1>{description && <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{reviewText(locale, description)}</p>}</header>;
}
export function Message({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <p role={error ? "alert" : "status"} className="mt-4 border-s-2 border-border bg-secondary/50 px-3 py-2 text-sm text-foreground">{children}</p>;
}
