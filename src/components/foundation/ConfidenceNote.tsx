import { useTranslations } from "next-intl";
import { LocalizedText } from "./shared";

export function ConfidenceNote({ className = "" }: { className?: string }) {
  const t = useTranslations("status");
  return (
    <p className={className}>
      <LocalizedText>{t("confidenceNote")}</LocalizedText>
    </p>
  );
}
