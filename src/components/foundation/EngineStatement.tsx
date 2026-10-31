import { useTranslations } from "next-intl";
import { LocalizedText } from "./shared";

export function EngineStatement({ className = "" }: { className?: string }) {
  const t = useTranslations("why");
  return (
    <p className={className}>
      <LocalizedText>{t("engineDecides")}</LocalizedText>
    </p>
  );
}
