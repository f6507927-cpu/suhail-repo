import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LocalizedText, PublicLocalizedText } from "./shared";

export function EmptyState({
  title,
  children,
  className = "",
  publicCopy = false,
}: {
  title?: string;
  children?: ReactNode;
  className?: string;
  publicCopy?: boolean;
}) {
  const t = useTranslations("controls");
  const Text = publicCopy ? PublicLocalizedText : LocalizedText;
  return (
    <section
      className={`flex flex-col items-center justify-center gap-2 py-10 text-center ${className}`}
    >
      <h2 className="text-base font-semibold">
        <Text>{title ?? t("emptyTitle")}</Text>
      </h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        {children ?? <Text>{t("emptyBody")}</Text>}
      </p>
    </section>
  );
}
