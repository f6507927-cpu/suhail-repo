import { uiOneDisplay } from "@/i18n/approved-arabic-ui-one";
/** D-153/D-157: required provider attribution, not a licence or a live-price label. */
export function ApiNinjasAttribution({ locale = "en" }: { locale?: "ar" | "en" }) {
  return <a href="https://api-ninjas.com" rel="noopener noreferrer"
    className="apiNinjasAttribution underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">
    <bdi dir="auto">{uiOneDisplay("Prices: API Ninjas", locale)}</bdi>
  </a>;
}
