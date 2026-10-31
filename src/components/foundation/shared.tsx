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

export type Surface = "dark" | "light";
