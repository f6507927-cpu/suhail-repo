import type { ReactNode } from "react";

export function Emphasis({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`emphasis ${className}`}>{children}</span>;
}
