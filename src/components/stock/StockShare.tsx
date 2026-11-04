"use client";

import { useState } from "react";
import { Copy } from "./StockVerdictParts";
import styles from "./StockVerdict.module.css";

export function StockShare({
  canonicalUrl,
  locale,
}: {
  canonicalUrl: string;
  locale: "ar" | "en";
}) {
  const [message, setMessage] = useState<"copied" | "failed" | "">("");
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(canonicalUrl)}`;

  async function copyLink() {
    setMessage("");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ url: canonicalUrl });
        setMessage("");
        return;
      }
      await navigator.clipboard.writeText(canonicalUrl);
      setMessage("copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("failed");
    }
  }

  return (
    <div className={styles.shareWrap} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className={styles.shareActions}>
        <a
          className={styles.shareAction}
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Copy locale={locale}>Share on WhatsApp</Copy>
        </a>
        <button className={styles.shareAction} type="button" onClick={copyLink}>
          <Copy locale={locale}>Copy link</Copy>
        </button>
      </div>
      <p className={styles.shareStatus} role="status" aria-live="polite">
        {message === "copied" ? <Copy locale={locale}>Link copied</Copy>
          : message === "failed" ? <Copy locale={locale}>Try again</Copy> : null}
      </p>
    </div>
  );
}
