/**
 * D-95: exact reviewed auth lifecycle/health handlers, never directory exemptions.
 * Changes require explicit review and a refreshed full-source fingerprint.
 * Inline server functions are still discovered and checked independently.
 */
export const handlerPolicies: Record<string, { sha256: string; reason: string }> = {
  "src/app/api/health/route.ts": {
    sha256: "de8ea06b582d351cd6aa658442d708c760555ddb38d4541b2f448fa23dddfb11",
    reason: "Public deployment health only; no internal data/session access.",
  },
  "src/app/[locale]/(private)/auth/start/route.ts": {
    sha256: "a70f9f09c6586f1acdcfa2f6e9fc5aa9060f8cf450736401a7caa4a640cec3e6",
    reason: "Anonymous OAuth bootstrap: CSRF, configured provider and destination validation; allowlisted failure diagnostics only; no internal reads.",
  },
  "src/app/[locale]/(private)/auth/callback/route.ts": {
    sha256: "e82ce8b584706841b510ab1b8f03c626a7653b48e27b22086e734a5ef67f6eeb",
    reason: "PKCE exchange and server getUser verification precede registration; failures cannot register.",
  },
  "src/app/[locale]/(private)/auth/recover/route.ts": {
    sha256: "5675fa5730145a867d7c8daa1e564a0d3d34937b0143781ea964046478991dbf",
    reason: "Canonical verifiedIdentity precedes idempotent registration; never guesses consent.",
  },
  "src/app/[locale]/(private)/auth/sign-out/route.ts": {
    sha256: "450516ac23376fc07f493beb5627537ec2b705449004dceacb4f5102b0c361d4",
    reason: "Same-origin logout clears session without requiring a working identity; no internal data.",
  },
  "src/app/[locale]/(private)/auth/consent/accept/route.ts": {
    sha256: "39eabc01b487c11d9f4056fd09028f7e326a959bc85d43f39b8fea4d4a64bf6a",
    reason: "Server verifiedIdentity plus CSRF; session-owned consent row lock/audit. Old consent cannot be required to renew it.",
  },
};
