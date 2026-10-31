const events = ["proxy_failed", "action_failed", "rate_limited", "runtime_failed", "oauth_start_failed"] as const;
type Event = typeof events[number];
const categories = ["search", "auth", "api"] as const;
const oauthStages = ["origin_check", "form_read", "callback_build", "provider_check", "session_client", "oauth_request", "destination_check", "consent_cookie"] as const;
export type OAuthStartStage = typeof oauthStages[number];
const oauthReasons = ["auth_rejected", "auth_environment", "invalid_destination", "invalid_url", "timeout", "fetch_failed", "unexpected"] as const;
export type OAuthFailureReason = typeof oauthReasons[number];
const failureCodes = ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID"] as const;

/** No free-form strings, errors, identifiers, bodies or request objects. */
export function runtimeLog(event: Event, fields: {
  category?: string; status?: number;
  stage?: OAuthStartStage; reason?: OAuthFailureReason; failure_code?: string;
} = {}) {
  if (!events.includes(event)) return;
  const record: Record<string, string | number> = { event };
  if (categories.includes(fields.category as typeof categories[number])) record.category = fields.category!;
  if (Number.isInteger(fields.status) && fields.status! >= 100 && fields.status! <= 599) record.status = fields.status!;
  if (event === "oauth_start_failed") {
    if (oauthStages.includes(fields.stage!)) record.stage = fields.stage!;
    if (oauthReasons.includes(fields.reason!)) record.reason = fields.reason!;
    if (failureCodes.includes(fields.failure_code as typeof failureCodes[number])) record.failure_code = fields.failure_code!;
  }
  console.error(JSON.stringify(record));
}
