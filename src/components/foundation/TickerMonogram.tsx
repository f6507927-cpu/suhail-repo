import "./PublicPolish.css";

/**
 * Ticker monogram: a brand-coloured rounded square with the ticker. Decorative
 * only (the ticker is always printed elsewhere), so it is hidden from assistive
 * technology. No company logos are fetched or shown.
 */
export function TickerMonogram({ ticker, size = "md", className = "" }: {
  ticker: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const text = ticker.trim().toUpperCase().slice(0, 5);
  return (
    <span
      aria-hidden="true"
      data-ticker-monogram
      data-size={size}
      data-length={Math.min(text.length, 5)}
      className={`ticker-monogram ${className}`}
      dir="ltr"
    >
      {text}
    </span>
  );
}
