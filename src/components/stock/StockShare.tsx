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
    <div className={styles.shareWrap} data-section="share" lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className={styles.shareActions}>
        <a
          className={styles.shareAction}
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <path d="M14 4h6v6M20 4 11 13M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <Copy locale={locale}>Share on WhatsApp</Copy>
        </a>
        <button className={styles.shareAction} type="button" onClick={copyLink}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <path d="M9 8h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" />
            <path d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
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
