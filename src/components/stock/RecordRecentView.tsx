"use client";

import { useEffect } from "react";
import { addRecent, readRecent, writeRecent, type RecentStock } from "../foundation/recent-stocks";

/** Records this public stock page in the visitor's own browser only. Renders nothing. */
export function RecordRecentView({ stock }: { stock: RecentStock }) {
  const { slug, ticker, name, nameAr } = stock;
  useEffect(() => {
    writeRecent(addRecent(readRecent(), { slug, ticker, name, nameAr }));
  }, [slug, ticker, name, nameAr]);
  return null;
}
