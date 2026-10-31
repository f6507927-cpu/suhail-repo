import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";

export function SystemError({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 text-foreground ${className}`}
    >
      <CircleAlert
        aria-hidden="true"
        size={18}
        strokeWidth={1.6}
        className="mt-0.5 shrink-0"
      />
      <span>{children}</span>
    </div>
  );
}
