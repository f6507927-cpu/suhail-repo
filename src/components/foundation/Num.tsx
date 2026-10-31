import type { ReactNode } from "react";

export function Num({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <bdi dir="ltr" className={`font-mono tabular-nums ${className}`}>
      {children}
    </bdi>
  );
}
