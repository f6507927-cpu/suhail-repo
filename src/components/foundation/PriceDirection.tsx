import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

export function PriceDirection({
  direction,
  children,
  className = "",
}: {
  direction: "up" | "down";
  children: ReactNode;
  className?: string;
}) {
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  return (
    <span
      className={`price-${direction} inline-flex items-center gap-1 ${className}`}
    >
      <Icon aria-hidden="true" size={15} strokeWidth={1.6} />
      {children}
    </span>
  );
}
