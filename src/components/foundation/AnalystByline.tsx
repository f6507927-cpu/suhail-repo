import type { ReactNode } from "react";

export function AnalystByline({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`byline font-medium ${className}`}>{children}</span>;
}
