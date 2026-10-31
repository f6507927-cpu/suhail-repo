// D-49 / D-70: draft versions are real acceptance identifiers, not approved legal text.
export const CURRENT_TERMS_VERSION = "draft-2026-10-11";
export const CURRENT_PRIVACY_VERSION = "draft-2026-10-11";
export function currentConsent(user: {terms_version: string | null; privacy_version: string | null; accepted_at: Date | null}) {
  return user.terms_version === CURRENT_TERMS_VERSION && user.privacy_version === CURRENT_PRIVACY_VERSION && user.accepted_at !== null;
}
