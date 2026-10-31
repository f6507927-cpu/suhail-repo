import { useTranslations } from "next-intl";
import { LocalizedText } from "./shared";

export function Disclaimer({
  variant = "short",
  className = "",
}: {
  variant?: "short" | "full";
  className?: string;
}) {
  const t = useTranslations("disclaimer");
  return (
    <p className={className}>
      <LocalizedText>{t(variant)}</LocalizedText>
    </p>
  );
}
