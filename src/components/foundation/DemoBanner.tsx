import { useTranslations } from "next-intl";
import { LocalizedText } from "./shared";

export function DemoBanner({ className = "" }: { className?: string }) {
  const t = useTranslations("banner");
  return (
    <aside className={className} role="note">
      <LocalizedText>{t("demo")}</LocalizedText>
    </aside>
  );
}
