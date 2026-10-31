import { goldenInput, segment } from "./synthetic";

/** D-90: five additional fake-company EX-A golden evidence cases. */
export const evidenceCases = [
  "prohibited_primary", "estimated_input", "stale_period",
  "missing_numerator", "prohibited_primary_tie",
] as const;
export type EvidenceCase = typeof evidenceCases[number];

export function evidenceGoldenInput(example: EvidenceCase) {
  const i = goldenInput("A", "pass");
  const name = {
    prohibited_primary: "Epsilon", estimated_input: "Zeta", stale_period: "Eta",
    missing_numerator: "Theta", prohibited_primary_tie: "Iota",
  }[example];
  i.securityId = `fixture-${name.toLowerCase()}-security`;
  i.period.id = `fixture-${name.toLowerCase()}-period`;
  i.period.label = `Fixture ${name} Co annual`;
  switch (example) {
    case "prohibited_primary":
      i.segments[0].activityCategory = "alcohol";
      i.segments[1].activityCategory = "technology";
      break;
    case "estimated_input": {
      const investments = i.facts.find((f) => f.lineItem === "interest_bearing_investments")!;
      investments.inputState = "estimated";
      investments.confidenceTier = "Estimated";
      break;
    }
    case "stale_period":
      i.period.periodEnd = "2025-04-08"; // Exactly 551 days before supplied 2026-10-11.
      break;
    case "missing_numerator":
      i.facts = i.facts.filter((f) => f.lineItem !== "interest_bearing_investments");
      break;
    case "prohibited_primary_tie":
      // 25 equal 4% primary segments, one prohibited. NPR = 4% (pass), so the
      // business tie alone triggers review rather than a 50% revenue failure.
      i.segments = Array.from({ length: 25 }, (_, index) => segment({
        segmentName: `Fixture tied segment ${String(index + 1).padStart(2, "0")}`,
        activityCategory: index === 0 ? "alcohol" : "technology",
        revenueAmount: 4, revenueShare: 0.04,
        sourceId: `fixture-tie-source-${index + 1}`,
      }));
      break;
  }
  return i;
}
