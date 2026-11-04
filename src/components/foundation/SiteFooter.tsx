import { useTranslations } from "next-intl";
import { FullDisclaimerLink } from "./FullDisclaimerLink";
import { Disclaimer } from "./Disclaimer";
import { reviewText } from "../accounts/types";
import styles from "./SiteFooter.module.css";

export function SiteFooter({ locale }: { locale: "ar" | "en" }) {
  const controls = useTranslations("controls");
  const prefix = locale === "en" ? "/en" : "";

  return (
    <footer className={styles.footer} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className={styles.wrap}>
        <div className={styles.legalRow}>
          <div className={styles.legalCopy}>
            <Disclaimer className={styles.shortDisclaimer} />
            <FullDisclaimerLink />
            <section id="full-disclaimer" className={styles.fullDisclosure} tabIndex={-1} aria-label={controls("fullDisclaimer")}>
              <Disclaimer variant="full" className={styles.fullDisclaimer} />
            </section>
          </div>
          <nav className={styles.legalLinks}>
            <a href={`${prefix}/terms`}>{reviewText(locale, "Terms of Use")}</a>
            <a href={`${prefix}/privacy`}>{reviewText(locale, "Privacy Policy")}</a>
          </nav>
        </div>
        <div className={styles.wordmark} lang="ar" dir="rtl">سهيل</div>
      </div>
    </footer>
  );
}
