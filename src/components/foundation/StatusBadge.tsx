import { useTranslations } from "next-intl";
import { AlertTriangle, Check, CircleHelp, X } from "lucide-react";
import { LocalizedText } from "./shared";

export type StatusCode =
  | "passes_selected_methodology"
  | "requires_review"
  | "fails_selected_methodology"
  | "insufficient_data";

const statusIcons = {
  passes_selected_methodology: Check,
  requires_review: AlertTriangle,
  fails_selected_methodology: X,
  insufficient_data: CircleHelp,
} as const;

const statusClasses = {
  passes_selected_methodology: "status-pass",
  requires_review: "status-review",
  fails_selected_methodology: "status-fail",
  insufficient_data: "status-insufficient",
} as const;

export function StatusBadge({
  status,
  className = "",
}: {
  status: StatusCode;
  className?: string;
}) {
  const t = useTranslations("status");
  const Icon = statusIcons[status];

  return (
    <span
      className={`${statusClasses[status]} inline-flex items-center gap-1.5 rounded-md border-2 px-3 py-1 text-sm ${className}`}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={1.6} />
      <span>
        <LocalizedText>{t(status)}</LocalizedText>
      </span>
    </span>
  );
}
