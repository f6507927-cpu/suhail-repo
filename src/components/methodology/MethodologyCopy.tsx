import { useTranslations } from "next-intl";
import type messages from "../../i18n/messages/en.json";
import { LocalizedText } from "../foundation";
import { formatCalendarDate } from "@/lib/format";

export function MethodologyCopy({
  id,
}: {
  id: keyof typeof messages.publicMethodology;
}) {
  const t = useTranslations("publicMethodology");
  return <LocalizedText>{t(id)}</LocalizedText>;
}

export function formatMethodologyDate(value: string | null, locale: string) {
  if (!value) return "—";
  return formatCalendarDate(value, locale === "ar" ? "ar" : "en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

