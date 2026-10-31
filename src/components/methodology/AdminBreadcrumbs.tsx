import type { ReactNode } from "react";
import { reviewText, type Locale } from "@/components/accounts/types";

export function AdminBreadcrumbs({ locale, items }: {
  locale: Locale; items: { label: ReactNode; href?: string }[];
}) {
  return <nav aria-label={reviewText(locale, "Breadcrumb")} className="my-4 text-sm">
    <ol className="flex flex-wrap items-center gap-2">
      {items.map((item, index) => <li key={index} className="flex min-w-0 items-center gap-2 break-words">
        {index > 0 && <span aria-hidden="true">/</span>}
        {item.href ? <a href={item.href} className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">{item.label}</a>
          : <span aria-current="page">{item.label}</span>}
      </li>)}
    </ol>
  </nav>;
}
