import { useLocale, useTranslations } from "next-intl";
import { LocalizedText } from "./shared";
import { uiOneDisplay } from "@/i18n/approved-arabic-ui-one";

export function EngineStatement({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("why");
  return (
    <p className={className}>
      <LocalizedText>{uiOneDisplay(t("engineDecides"), locale === "ar" ? "ar" : "en")}</LocalizedText>
    </p>
  );
}
