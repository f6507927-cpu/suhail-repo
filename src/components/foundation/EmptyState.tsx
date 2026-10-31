import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LocalizedText } from "./shared";

export function EmptyState({
  title,
  children,
  className = "",
}: {
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("controls");
  return (
    <section
      className={`flex flex-col items-center justify-center gap-2 py-10 text-center ${className}`}
    >
      <h2 className="text-base font-semibold">
        <LocalizedText>{title ?? t("emptyTitle")}</LocalizedText>
      </h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        {children ?? <LocalizedText>{t("emptyBody")}</LocalizedText>}
      </p>
    </section>
  );
}
