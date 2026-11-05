import { useTranslations } from "next-intl";
import { LocalizedText } from "./shared";
import ar from "@/i18n/messages/ar.json";
import en from "@/i18n/messages/en.json";

export function Disclaimer({
  variant = "short",
  className = "",
  locale,
}: {
  variant?: "short" | "full";
  className?: string;
  locale?: "ar" | "en";
}) {
  const t = useTranslations("disclaimer");
  return (
    <p className={className}>
      <LocalizedText>{locale ? (locale === "ar" ? ar : en).disclaimer[variant] : t(variant)}</LocalizedText>
    </p>
  );
}
