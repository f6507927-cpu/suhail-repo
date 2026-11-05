import type { ReactNode } from "react";
import styles from "./StockVerdict.module.css";

/** UI-8: all evidence stays in server HTML; each record section opens separately. */
export function StockRecordSection({ sectionKey, id, title, children, className = "" }: {
  sectionKey: string; id: string; title: ReactNode; children: ReactNode; className?: string;
}) {
  return <details className={styles.recordSection} data-record-section={sectionKey}>
    <summary className={styles.sectionHeading}><h2 id={id}>{title}</h2></summary>
    <section className={`${styles.section} ${className}`} data-section={sectionKey} aria-labelledby={id}>
      {children}
    </section>
  </details>;
}
