export type MfaFactor = { id: string; factor_type: string; status: string };

/** Supabase returns raw SVGo XML, including a generated comment before <svg>. */
export function normalizeTotpQr(source: unknown): string {
  if (typeof source !== "string") return "";
  const prefix = /^data:image\/svg\+xml(?:;charset=utf-8|;utf-8)?,/;
  const match = prefix.exec(source);
  if (!match) return "";
  const svg = source.slice(match[0].length).trim();
  if (!/^(?:<\?xml\b[^?]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b[\s\S]*<\/svg>$/.test(svg)) return "";
  try {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    return "";
  }
}

export function abandonedTotpFactors(factors: readonly MfaFactor[]): MfaFactor[] {
  return factors.filter((factor) => factor.factor_type === "totp" && factor.status === "unverified");
}
