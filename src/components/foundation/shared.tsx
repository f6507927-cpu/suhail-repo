import type { ReactNode } from "react";

/**
 * Arabic drafts are intentionally shown as English review copy until a human
 * approves the translation. Keep the surrounding component's locale intact.
 */
export function LocalizedText({ children }: { children: ReactNode }) {
  if (typeof children === "string" && children.startsWith("⟦AR-REVIEW⟧ ")) {
    return (
      <span lang="en" dir="ltr" className="block text-start [unicode-bidi:isolate]">
        {children}
      </span>
    );
  }

  return <>{children}</>;
}

/** D-150: presentation only; the original pending dictionary/evidence stays intact. */
export function stripPublicReviewMarker(text: string) {
  return text.replace(/⟦AR-REVIEW⟧\s*/g, "");
}

/** Public fallbacks stay English and bidi-isolated without displaying review tokens. */
export function PublicLocalizedText({ children }: { children: ReactNode }) {
  if (typeof children === "string" && children.includes("⟦AR-REVIEW⟧")) {
    return (
      <span lang="en" dir="ltr" className="block text-start [unicode-bidi:isolate]">
        {stripPublicReviewMarker(children)}
      </span>
    );
  }
  return <>{children}</>;
}

export type Surface = "dark" | "light";
