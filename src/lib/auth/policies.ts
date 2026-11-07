// D-49 / D-70: draft versions are real acceptance identifiers, not approved legal text.
// D-175: draft multi-methodology §4; bumping requires re-acceptance (currentConsent).
export const CURRENT_TERMS_VERSION = "draft-2026-11-07";
export const CURRENT_PRIVACY_VERSION = "draft-2026-11-08";
export function currentConsent(user: {terms_version: string | null; privacy_version: string | null; accepted_at: Date | null}) {
  return user.terms_version === CURRENT_TERMS_VERSION && user.privacy_version === CURRENT_PRIVACY_VERSION && user.accepted_at !== null;
}
