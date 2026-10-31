"use client";

import { useLocale } from "next-intl";
import { approvedArabicCopy } from "@/i18n/approved-arabic";

export default function Forbidden() {
  const locale = useLocale();
  const source = "Access is restricted to authorized roles.";
  // D-101: apply Arabic approval without changing the English denial message.
  return <main className="mx-auto max-w-lg p-8"><h1>403</h1><p>{locale === "ar" ? approvedArabicCopy[source] : source}</p></main>;
}
