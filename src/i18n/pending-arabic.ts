// D-172/D-173/D-174: English sources whose Arabic awaits founder review.
// The marked literals put each source in docs/ARABIC_REVIEW.md (pnpm ar-review:list);
// runtime helpers never construct or detect the marker. Until approved, Arabic
// pages show the English source (D-162). Move a source out when it is approved.
export const pendingArabicSources = [
  "⟦AR-REVIEW⟧ Music",
  "⟦AR-REVIEW⟧ Hotels",
  "⟦AR-REVIEW⟧ Cinema, film and television",
  "⟦AR-REVIEW⟧ Cash, including restricted cash (balance sheet)",
  "⟦AR-REVIEW⟧ Short-term investments and securities",
  "⟦AR-REVIEW⟧ Long-term investments and securities",
] as const;
