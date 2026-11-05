import type { ReactNode } from "react";
import { isEnglishText, stripPublicReviewMarker, stripReviewMarker } from "@/i18n/display-text";
import { approvedArabicCopy } from "@/i18n/approved-arabic";
export { stripPublicReviewMarker } from "@/i18n/display-text";
const knownArabic = new Set(Object.values(approvedArabicCopy));

/** Missing translations retain the visible English source, explicitly isolated. */
export function LocalizedText({ children }: { children: ReactNode }) {
  if (typeof children === "string") {
    const text = stripReviewMarker(children);
    if (!isEnglishText(text) || Object.hasOwn(approvedArabicCopy, text) || knownArabic.has(text))
      return <>{text}</>;
    return (
      <span lang="en" dir="ltr" className="[unicode-bidi:isolate]">
        {text}
      </span>
    );
  }

  return <>{children}</>;
}

/** Public content also removes internal decision IDs; private audit text retains them. */
export function PublicLocalizedText({ children }: { children: ReactNode }) {
  return <LocalizedText>{typeof children === "string" ? stripPublicReviewMarker(children) : children}</LocalizedText>;
}

export type Surface = "dark" | "light";
